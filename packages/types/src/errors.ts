/**
 * Error codes returned in 402 responses and verification failures.
 *
 * The public set mirrors the protocol error table (PRD §9.7); a few internal
 * codes used only by the SDK retry logic and middleware are appended.
 */
export type CrawlPayErrorCode =
  // Protocol errors (PRD §9.7)
  | 'invalid_signature'
  | 'invalid_request_signature'
  | 'amount_exceeded'
  | 'recipient_mismatch'
  | 'replay'
  | 'expired'
  | 'insufficient_balance'
  | 'reputation_too_low'
  | 'offer_changed'
  | 'crawler_banned'
  | 'rate_limited'
  | 'session_budget_exhausted'
  | 'facilitator_error'
  | 'facilitator_unavailable'
  // Internal — SDK/middleware only
  | 'invalid_payload'
  | 'unexpected_error';

export class CrawlPayError extends Error {
  constructor(
    public readonly code: CrawlPayErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CrawlPayError';
  }
}
