import type { CrawlPayReceipt, CrawlPayReceiptBody } from '@crawlpay/types';

/**
 * Produce canonical JSON for a receipt:
 *   - object keys sorted lexicographically (recursive)
 *   - no whitespace
 *   - `signature` field excluded if present (so signed and unsigned forms hash the same)
 *   - undefined fields excluded entirely
 *
 * Deterministic across runs and across language implementations that follow
 * the same rules — the foundation for verifiable receipts.
 */
export function canonicalizeReceipt(receipt: CrawlPayReceiptBody | CrawlPayReceipt): string {
  const asAny = receipt as CrawlPayReceipt;
  const body: Record<string, unknown> = { ...asAny };
  delete body.signature;
  return canonicalize(body);
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    return JSON.stringify(value.toString());
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
  }
  throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
}
