import type { CrawlPayReceipt, StellarAddress } from '@crawlpay/types';

/**
 * A stored receipt is the canonical signed receipt plus the catalog
 * `publisherId` it belongs to. `publisherId` is not part of the signed body —
 * it's storage context that lets the gateway scope queries to a publisher.
 */
export interface StoredReceipt extends CrawlPayReceipt {
  publisherId: string;
}

export interface ReceiptFilter {
  publisherId?: string;
  /** Crawler G-address (the receipt `from`). */
  from?: StellarAddress;
  /** Publisher payout G-address (the receipt `to`). */
  to?: StellarAddress;
  /** ISO 8601 inclusive lower bound on the receipt timestamp. */
  fromTimestamp?: string;
  /** ISO 8601 inclusive upper bound on the receipt timestamp. */
  toTimestamp?: string;
  limit?: number;
  offset?: number;
}

/**
 * Persistent receipt store. Append-only by design — receipts are immutable
 * once issued. The `onchainTxHash` field can be backfilled later via a separate
 * update path (not part of this interface).
 */
export interface ReceiptRepository {
  insert(receipt: CrawlPayReceipt, publisherId: string): Promise<void>;
  getByNonce(nonce: string): Promise<StoredReceipt | null>;
  list(filter?: ReceiptFilter): Promise<StoredReceipt[]>;
  count(filter?: ReceiptFilter): Promise<number>;
}
