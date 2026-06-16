import type Redis from 'ioredis';
import type { NonceTracker } from './interface';

/**
 * Redis-backed nonce tracker. Uses SET key value EX ttl NX, which is atomic:
 *   - sets the key only if it doesn't already exist
 *   - applies a TTL (Redis evicts expired keys for us, no sweep needed)
 *
 * Returns `'OK'` on first reservation, `null` on collision.
 */
export class RedisNonceTracker implements NonceTracker {
  readonly #redis: Redis;
  readonly #prefix: string;

  constructor(redis: Redis, prefix = 'crawlpay:nonce:') {
    this.#redis = redis;
    this.#prefix = prefix;
  }

  async reserve(nonce: string, expiresAtUnix: number): Promise<boolean> {
    const ttl = Math.max(1, expiresAtUnix - Math.floor(Date.now() / 1000));
    const result = await this.#redis.set(this.#key(nonce), '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  async isUsed(nonce: string): Promise<boolean> {
    const exists = await this.#redis.exists(this.#key(nonce));
    return exists === 1;
  }

  async release(nonce: string): Promise<void> {
    await this.#redis.del(this.#key(nonce));
  }

  #key(nonce: string): string {
    return `${this.#prefix}${nonce}`;
  }
}
