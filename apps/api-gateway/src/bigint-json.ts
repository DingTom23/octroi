/**
 * Node's `JSON.stringify` throws `TypeError: Do not know how to serialize a
 * BigInt` because the JSON spec doesn't define a representation for it.
 *
 * We use `AtomicUsdc` (a branded `bigint`) throughout the data layer, so
 * any record that surfaces it to Fastify would crash without this polyfill.
 * Convention across the CrawlPay HTTP surface: BigInts serialize as their
 * decimal string. Clients parse with `BigInt(field)` if they need the
 * number back.
 *
 * Imported once at the top of `index.ts` for the side effect. Must run
 * before any Fastify response is serialized.
 */
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function toJSON(this: bigint): string {
  return this.toString();
};

export {};
