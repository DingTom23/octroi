/**
 * Replay-protection store for Soroban authorization-entry nonces (and, on the
 * request-auth side, Web Bot Auth nonces).
 *
 * Contract: `reserve` is atomic. Only one caller can succeed for a given nonce.
 * Production-grade implementations back this with Redis SETNX or an INSERT
 * against a UNIQUE column.
 *
 * Reservations are time-bounded — they expire at `expiresAtUnix` so the store
 * doesn't grow unbounded.
 */
export interface NonceTracker {
  reserve(nonce: string, expiresAtUnix: number): Promise<boolean>;
  isUsed(nonce: string): Promise<boolean>;
  /** Manual release — rarely needed outside tests. */
  release(nonce: string): Promise<void>;
}
