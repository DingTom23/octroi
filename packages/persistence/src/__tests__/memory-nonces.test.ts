import { describe, expect, it } from 'vitest';
import { MemoryNonceTracker } from '../nonces/memory';

const nonce = (n: number): string => n.toString(16).padStart(32, '0');

describe('MemoryNonceTracker', () => {
  it('reserves a fresh nonce', async () => {
    const t = new MemoryNonceTracker();
    expect(await t.reserve(nonce(1), futureTs())).toBe(true);
  });

  it('rejects a second reservation of the same nonce', async () => {
    const t = new MemoryNonceTracker();
    await t.reserve(nonce(1), futureTs());
    expect(await t.reserve(nonce(1), futureTs())).toBe(false);
  });

  it('isUsed flips after reservation', async () => {
    const t = new MemoryNonceTracker();
    expect(await t.isUsed(nonce(1))).toBe(false);
    await t.reserve(nonce(1), futureTs());
    expect(await t.isUsed(nonce(1))).toBe(true);
  });

  it('release allows the same nonce to be reserved again', async () => {
    const t = new MemoryNonceTracker();
    await t.reserve(nonce(1), futureTs());
    await t.release(nonce(1));
    expect(await t.isUsed(nonce(1))).toBe(false);
    expect(await t.reserve(nonce(1), futureTs())).toBe(true);
  });

  it('sweeps expired entries', async () => {
    let now = 1000;
    const t = new MemoryNonceTracker(() => now);
    await t.reserve(nonce(1), 1100);
    now = 1200;
    expect(await t.isUsed(nonce(1))).toBe(false);
    expect(await t.reserve(nonce(1), 1300)).toBe(true);
  });
});

function futureTs(): number {
  return Math.floor(Date.now() / 1000) + 86400;
}
