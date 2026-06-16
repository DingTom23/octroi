import type {
  AtomicUsdc,
  CrawlPayReceipt,
  CrawlerBudgetState,
  StellarAddress,
  X402PaymentPayload,
  PaymentRequiredResponse,
  PaymentRequirement,
} from '@crawlpay/types';
import { X402_HEADERS, atomicUsdc } from '@crawlpay/types';
import { verifyReceipt } from '@crawlpay/receipt-signer';
import { InMemoryBudgetTracker, UnlimitedBudgetTracker, type BudgetTracker } from './budget';
import { MemoryFetchCache, type FetchCache, type FetchCacheEntry } from './fetch-cache';
import { StellarPaymentSigner, type PaymentSigner } from './payment-signer';
import { MemoryReceiptStore, type ReceiptStore } from './receipt-store';
import { DefaultRetryPolicy, type RetryPolicy } from './retry';
import {
  BudgetExhaustedError,
  MaxPriceExceededError,
  NoPayableOfferError,
  PaymentRejectedError,
  ReceiptVerificationError,
  type CrawlPayClientConfig,
  type ErrorEvent,
  type FetchOpts,
  type FetchResult,
  type PaymentEvent,
  type SkipEvent,
} from './types';

const DEFAULT_CACHE_SECONDS = 86_400;
const DEFAULT_BUDGET_WARNING_RATIO = 0.8;

/**
 * CrawlPayClient — the buyer-side SDK.
 *
 * Wraps the Stellar payment signer with the policy layer publishers and
 * crawlers need:
 *   - Pre-payment maxPerRequest + daily budget enforcement
 *   - 24h fetch cache (don't pay twice for the same URL)
 *   - Retry policy keyed on x402 error codes
 *   - CrawlPayReceipt verification + archival
 *   - Pluggable budget / cache / receipt store / signer / retry
 */
export class CrawlPayClient {
  readonly #config: Required<
    Pick<CrawlPayClientConfig, 'network' | 'maxPerRequest' | 'cacheSeconds' | 'budgetWarningRatio'>
  > &
    CrawlPayClientConfig;
  readonly #signer: PaymentSigner;
  readonly #budget: BudgetTracker;
  readonly #cache: FetchCache;
  readonly #receipts: ReceiptStore;
  readonly #retry: RetryPolicy;
  #lastWarnedRatio = 0;

  constructor(config: CrawlPayClientConfig) {
    this.#config = {
      ...config,
      cacheSeconds: config.cacheSeconds ?? DEFAULT_CACHE_SECONDS,
      budgetWarningRatio: config.budgetWarningRatio ?? DEFAULT_BUDGET_WARNING_RATIO,
    };
    this.#signer = config.paymentSigner ?? new StellarPaymentSigner(config.network, config.secret);
    this.#budget =
      config.budgetTracker ??
      (config.dailyBudget !== undefined
        ? new InMemoryBudgetTracker(config.dailyBudget)
        : new UnlimitedBudgetTracker());
    this.#cache = config.fetchCache ?? new MemoryFetchCache();
    this.#receipts = config.receiptStore ?? new MemoryReceiptStore();
    this.#retry = config.retryPolicy ?? new DefaultRetryPolicy();
  }

  get address(): StellarAddress {
    return this.#signer.address;
  }

  async getBudgetState(): Promise<CrawlerBudgetState> {
    return this.#budget.getState();
  }

  async getBalance() {
    return this.#signer.getBalance();
  }

  async listReceipts(filter?: Parameters<ReceiptStore['list']>[0]): Promise<CrawlPayReceipt[]> {
    return this.#receipts.list(filter);
  }

  /**
   * Fetch a URL, paying transparently if the server returns 402.
   *
   * Flow:
   *   1. Cache check
   *   2. Initial GET — if 200, treat as free
   *   3. Parse 402 offer, pick the payable x402 option
   *   4. Enforce maxPerRequest + daily budget
   *   5. Sign a Soroban auth entry, retry with X-PAYMENT
   *   6. On success, verify the X-PAYMENT-RESPONSE receipt, archive, return
   */
  async fetch<T = unknown>(url: string, opts: FetchOpts = {}): Promise<FetchResult<T>> {
    const method = opts.method ?? 'GET';

    if (!opts.noCache) {
      const cached = await this.#cache.get(url, this.#config.cacheSeconds);
      if (cached) {
        await this.#emitSkip({ url, reason: 'cache', cached: true });
        return cacheEntryToResult<T>(cached, true);
      }
    }

    let lastError: unknown = null;
    let cachedOffer: PaymentRequiredResponse | null = null;

    for (let attempt = 1; attempt <= this.#retry.maxAttempts; attempt += 1) {
      let initial: Response;
      try {
        if (!cachedOffer) {
          initial = await sendRequest(url, method, opts);
        } else {
          // Re-using the previous offer for a non-refresh retry; skip the
          // unpaid round-trip and go straight to sign + send.
          initial = new Response(JSON.stringify(cachedOffer), { status: 402 });
        }
      } catch (err) {
        lastError = err;
        await this.#emitError({ url, error: asError(err), phase: 'fetch-offer', attempt });
        const decision = this.#retry.decide('facilitator_unavailable', attempt);
        if (decision === 'abort') throw err;
        await sleep(this.#retry.backoffMs(attempt));
        continue;
      }

      // 200 from the seller without payment — unprotected resource.
      if (initial.status === 200) {
        const data = (await parseBody(initial)) as T;
        const entry: FetchCacheEntry = {
          url,
          status: 200,
          data,
          receipt: null,
          paid: atomicUsdc(0n),
          cachedAt: nowSeconds(),
        };
        await this.#cache.put(entry);
        await this.#emitSkip({ url, reason: 'free-endpoint', cached: false });
        return cacheEntryToResult<T>(entry, false);
      }

      if (initial.status !== 402) {
        throw new Error(`Unexpected status ${initial.status} from ${url}`);
      }

      // Parse offer + pick the Gateway option
      let offer: PaymentRequiredResponse;
      try {
        offer = (await parseBody(initial)) as PaymentRequiredResponse;
        cachedOffer = offer;
      } catch (err) {
        await this.#emitError({ url, error: asError(err), phase: 'parse-response', attempt });
        throw err;
      }

      const requirement = pickRequirement(offer.accepts);
      if (!requirement) throw new NoPayableOfferError(url);

      const priceAtomic = atomicUsdc(BigInt(requirement.maxAmountRequired));

      // Pre-payment policy gates
      if (priceAtomic > this.#config.maxPerRequest) {
        await this.#emitSkip({ url, reason: 'price-cap', price: priceAtomic });
        throw new MaxPriceExceededError(url, priceAtomic, this.#config.maxPerRequest);
      }

      const canSpend = await this.#budget.canSpend(priceAtomic);
      if (!canSpend) {
        const state = await this.#budget.getState();
        await this.#emitSkip({ url, reason: 'budget-cap', price: priceAtomic });
        await this.#config.onBudgetExhausted?.();
        throw new BudgetExhaustedError(url, priceAtomic, state.remainingAtomic);
      }

      // Sign + send
      const startedAt = Date.now();
      let payload: X402PaymentPayload;
      try {
        payload = await this.#signer.createPayment(requirement);
      } catch (err) {
        lastError = err;
        await this.#emitError({ url, error: asError(err), phase: 'sign', attempt });
        const decision = this.#retry.decide('invalid_payload', attempt);
        if (decision === 'abort') throw err;
        if (decision === 'refresh-offer') cachedOffer = null;
        await sleep(this.#retry.backoffMs(attempt));
        continue;
      }

      let paid: Response;
      try {
        paid = await sendRequest(url, method, opts, encodePaymentPayload(payload));
      } catch (err) {
        lastError = err;
        await this.#emitError({ url, error: asError(err), phase: 'send', attempt });
        const decision = this.#retry.decide('facilitator_unavailable', attempt);
        if (decision === 'abort') throw err;
        if (decision === 'refresh-offer') cachedOffer = null;
        await sleep(this.#retry.backoffMs(attempt));
        continue;
      }

      if (paid.status === 200) {
        await this.#budget.recordSpend(priceAtomic);
        await this.#maybeEmitBudgetWarning();

        const data = (await parseBody(paid)) as T;
        const receipt = await this.#extractReceipt(url, paid);
        if (receipt) await this.#receipts.put(receipt);
        const settlementRef = receipt?.onchainTxHash ?? receipt?.mppSessionRef?.sessionId ?? '';

        const entry: FetchCacheEntry = {
          url,
          status: 200,
          data,
          receipt,
          paid: priceAtomic,
          cachedAt: nowSeconds(),
        };
        await this.#cache.put(entry);

        const event: PaymentEvent = {
          url,
          amount: priceAtomic,
          publisherWallet: requirement.payTo,
          receipt,
          settlementRef,
          durationMs: Date.now() - startedAt,
        };
        await this.#config.onPayment?.(event);

        return { ...cacheEntryToResult<T>(entry, false), settlementRef };
      }

      // 402 with error code → consult retry policy
      if (paid.status === 402) {
        const body = (await parseBody(paid)) as { error?: string };
        const code = body.error ?? 'unexpected_error';
        const decision = this.#retry.decide(code, attempt);
        if (decision === 'abort') {
          throw new PaymentRejectedError(url, code, attempt);
        }
        if (decision === 'refresh-offer') cachedOffer = null;
        await sleep(this.#retry.backoffMs(attempt));
        continue;
      }

      throw new Error(`Unexpected status ${paid.status} after payment for ${url}`);
    }

    throw new Error(
      `Exhausted ${this.#retry.maxAttempts} attempts for ${url}` +
        (lastError instanceof Error ? `: ${lastError.message}` : ''),
    );
  }

  async #extractReceipt(url: string, response: Response): Promise<CrawlPayReceipt | null> {
    const headerValue = response.headers.get(X402_HEADERS.response.toLowerCase());
    if (!headerValue) return null;
    let receipt: CrawlPayReceipt;
    try {
      receipt = decodeReceiptHeader(headerValue);
    } catch (err) {
      await this.#emitError({
        url,
        error: asError(err),
        phase: 'verify-receipt',
        attempt: 0,
      });
      return null;
    }
    const result = await verifyReceipt(receipt);
    if (!result.valid) {
      const error = new ReceiptVerificationError(url, result.reason ?? 'unknown');
      await this.#emitError({ url, error, phase: 'verify-receipt', attempt: 0 });
      throw error;
    }
    return receipt;
  }

  async #maybeEmitBudgetWarning(): Promise<void> {
    const state = await this.#budget.getState();
    const total = state.spentAtomic + state.remainingAtomic;
    if (total === 0n) return;
    const ratio = Number(state.spentAtomic) / Number(total);
    if (
      ratio >= this.#config.budgetWarningRatio &&
      this.#lastWarnedRatio < this.#config.budgetWarningRatio
    ) {
      this.#lastWarnedRatio = ratio;
      await this.#config.onBudgetWarning?.({
        spentAtomic: state.spentAtomic,
        remainingAtomic: state.remainingAtomic,
        ratio,
      });
    }
  }

  async #emitSkip(event: SkipEvent): Promise<void> {
    try {
      await this.#config.onSkip?.(event);
    } catch {
      /* don't compound */
    }
  }

  async #emitError(event: ErrorEvent): Promise<void> {
    try {
      await this.#config.onError?.(event);
    } catch {
      /* don't compound */
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

async function sendRequest(
  url: string,
  method: string,
  opts: FetchOpts,
  paymentSignature?: string,
): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (paymentSignature) headers[X402_HEADERS.payment] = paymentSignature;
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }
  return fetch(url, init);
}

async function parseBody(response: Response): Promise<unknown> {
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function pickRequirement(accepts: PaymentRequirement[]): PaymentRequirement | null {
  return accepts.find((r) => r.scheme === 'exact' && r.extra?.settlement === 'x402') ?? null;
}

function encodePaymentPayload(payload: X402PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
}

function decodeReceiptHeader(value: string): CrawlPayReceipt {
  return JSON.parse(Buffer.from(value, 'base64').toString('utf-8'));
}

function cacheEntryToResult<T>(entry: FetchCacheEntry, cached: boolean): FetchResult<T> {
  return {
    url: entry.url,
    status: entry.status,
    data: entry.data as T,
    paid: entry.paid,
    receipt: entry.receipt,
    cached,
  };
}
