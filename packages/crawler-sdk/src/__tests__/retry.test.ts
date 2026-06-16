import { describe, expect, it } from 'vitest';
import { DefaultRetryPolicy } from '../retry';

describe('DefaultRetryPolicy', () => {
  const policy = new DefaultRetryPolicy(3);

  it('routes signature/nonce/expiry errors to refresh-offer', () => {
    expect(policy.decide('invalid_signature', 1)).toBe('refresh-offer');
    expect(policy.decide('invalid_request_signature', 1)).toBe('refresh-offer');
    expect(policy.decide('replay', 1)).toBe('refresh-offer');
    expect(policy.decide('expired', 1)).toBe('refresh-offer');
    expect(policy.decide('offer_changed', 1)).toBe('refresh-offer');
    expect(policy.decide('session_budget_exhausted', 1)).toBe('refresh-offer');
  });

  it('routes transient infrastructure errors to retry', () => {
    expect(policy.decide('rate_limited', 1)).toBe('retry');
    expect(policy.decide('facilitator_error', 1)).toBe('retry');
    expect(policy.decide('facilitator_unavailable', 1)).toBe('retry');
    expect(policy.decide('unexpected_error', 1)).toBe('retry');
  });

  it('aborts on terminal errors', () => {
    expect(policy.decide('insufficient_balance', 1)).toBe('abort');
    expect(policy.decide('reputation_too_low', 1)).toBe('abort');
    expect(policy.decide('crawler_banned', 1)).toBe('abort');
    expect(policy.decide('recipient_mismatch', 1)).toBe('abort');
    expect(policy.decide('amount_exceeded', 1)).toBe('abort');
    expect(policy.decide('invalid_payload', 1)).toBe('abort');
  });

  it('aborts when maxAttempts is reached regardless of code', () => {
    expect(policy.decide('rate_limited', 3)).toBe('abort');
    expect(policy.decide('invalid_signature', 3)).toBe('abort');
  });

  it('backoff is exponential and capped', () => {
    expect(policy.backoffMs(1)).toBe(500);
    expect(policy.backoffMs(2)).toBe(1000);
    expect(policy.backoffMs(3)).toBe(2000);
    expect(policy.backoffMs(20)).toBe(60_000);
  });
});
