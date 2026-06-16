import type {
  AssetId,
  CrawlPayErrorCode,
  CrawlPayReceipt,
  Network,
  PaymentPayload,
  StellarAddress,
} from '@crawlpay/types';

/** What the middleware sends the facilitator to verify and settle a payment. */
export interface FacilitatorVerifyRequest {
  publisherId: string;
  /** Publisher payout address — must equal the SAC transfer `to`. */
  payTo: StellarAddress;
  resource: string;
  network: Network;
  asset: AssetId;
  /** Offered ceiling, atomic USDC stringified. */
  maxAmountRequired: string;
  /** The crawler's `X-PAYMENT` payload (auth entry or MPP debit). */
  payment: PaymentPayload;
}

export type FacilitatorVerifyResult =
  | { ok: true; receipt: CrawlPayReceipt }
  | { ok: false; error: { code: CrawlPayErrorCode; message: string } };

/**
 * Pluggable facilitator interface. Decouples the middleware from any specific
 * facilitator deployment, so tests can substitute a mock and publishers can
 * point at the hosted facilitator or a self-hosted instance.
 */
export interface FacilitatorClient {
  /** Verify a signed payment, trigger settlement, and return a signed receipt. */
  verify(request: FacilitatorVerifyRequest): Promise<FacilitatorVerifyResult>;
}

/**
 * Default FacilitatorClient — POSTs to a facilitator's `/verify` endpoint over
 * HTTP. The facilitator owns settlement and receipt signing; the middleware
 * only relays the request and returns the receipt to the crawler.
 */
export class HttpFacilitatorClient implements FacilitatorClient {
  readonly #baseUrl: string;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl.replace(/\/$/, '');
  }

  async verify(request: FacilitatorVerifyRequest): Promise<FacilitatorVerifyResult> {
    let response: Response;
    try {
      response = await fetch(`${this.#baseUrl}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'facilitator_unavailable',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }

    const body = (await response.json().catch(() => ({}))) as {
      receipt?: CrawlPayReceipt;
      error?: { code?: CrawlPayErrorCode; message?: string };
    };

    if (response.ok && body.receipt) {
      return { ok: true, receipt: body.receipt };
    }

    return {
      ok: false,
      error: {
        code: body.error?.code ?? 'facilitator_error',
        message: body.error?.message ?? `facilitator returned ${response.status}`,
      },
    };
  }
}
