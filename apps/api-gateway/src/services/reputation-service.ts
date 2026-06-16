import type { StellarAddress } from '@crawlpay/types';
import type { ReceiptRepository } from '@crawlpay/persistence';

export interface ReputationSummary {
  address: StellarAddress;
  /** True until the on-chain crawlpay_registry replaces this in v2. */
  provisional: true;
  /** Number of settlements this crawler has paid (the trust signal). */
  settledCount: number;
  /** Provisional score in [0, 100], monotonic in settledCount. */
  score: number;
}

export interface ReputationService {
  getReputation(address: StellarAddress): Promise<ReputationSummary>;
}

/** Reputation saturates as settlements accumulate; at this count the score is ~67. */
const HALF_SATURATION = 100;

/**
 * Provisional, off-chain reputation derived from CrawlPay's own settlement
 * history (PRD §11.4). A crawler that has paid reliably accrues a higher score.
 * This is honest about being centralized in v0; the on-chain crawlpay_registry
 * replaces it in v2.
 */
export class ProvisionalReputationService implements ReputationService {
  readonly #receipts: ReceiptRepository;

  constructor(receipts: ReceiptRepository) {
    this.#receipts = receipts;
  }

  async getReputation(address: StellarAddress): Promise<ReputationSummary> {
    const settledCount = await this.#receipts.count({ from: address });
    const score = Math.round((100 * settledCount) / (settledCount + HALF_SATURATION));
    return { address, provisional: true, settledCount, score };
  }
}
