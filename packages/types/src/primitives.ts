declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * A Stellar account address in strkey form — starts with `G`, 56 chars.
 *
 * A Stellar account *is* an Ed25519 public key, so the same value serves as
 * the crawler's payment account, its Web Bot Auth request-signing identity,
 * and its reputation subject. One key does everything.
 */
export type StellarAddress = Brand<string, 'StellarAddress'>;

/** A Soroban contract address in strkey form — starts with `C`, 56 chars. */
export type ContractAddress = Brand<string, 'ContractAddress'>;

/**
 * A Stellar asset identifier: `CODE:ISSUER`, where `ISSUER` is the issuing
 * account's G-address. USDC on Stellar is `USDC:GA5ZSE…` (Circle's issuer).
 */
export type AssetId = `${string}:${string}`;

/** Base64-encoded Ed25519 signature over a canonical message. */
export type Ed25519Signature = Brand<string, 'Ed25519Signature'>;

/** Hex string (0x-prefixed) — used for opaque values such as nonces. */
export type Hex = `0x${string}`;

const G_ADDRESS = /^G[A-Z2-7]{55}$/;
const C_ADDRESS = /^C[A-Z2-7]{55}$/;

export function isStellarAddress(value: string): value is StellarAddress {
  return G_ADDRESS.test(value);
}

export function stellarAddress(value: string): StellarAddress {
  if (!isStellarAddress(value)) {
    throw new TypeError(`Not a valid Stellar G-address: ${value}`);
  }
  return value as StellarAddress;
}

export function isContractAddress(value: string): value is ContractAddress {
  return C_ADDRESS.test(value);
}

/**
 * USDC in atomic units.
 *
 * CrawlPay standardizes on Stellar's classic 7-decimal representation as the
 * single atomic unit across the SDK, facilitator, adapters, and contracts
 * (resolves PRD open question #1):
 *
 *   10_000_000n = $1.00
 *   1_000_000n  = $0.10
 *   1_000n      = $0.0001   (a hundredth of a cent — the default crawl price)
 */
export type AtomicUsdc = Brand<bigint, 'AtomicUsdc'>;

export const USDC_DECIMALS = 7;
const USDC_SCALE = 10_000_000n;

export function atomicUsdc(value: bigint | number | string): AtomicUsdc {
  const b = typeof value === 'bigint' ? value : BigInt(value);
  if (b < 0n) throw new RangeError(`AtomicUsdc cannot be negative: ${b}`);
  return b as AtomicUsdc;
}

export function dollarsToAtomic(dollars: string): AtomicUsdc {
  const s = dollars.startsWith('$') ? dollars.slice(1) : dollars;
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new TypeError(`Invalid dollar amount: ${dollars}`);
  }
  const [whole = '0', fraction = ''] = s.split('.');
  if (fraction.length > USDC_DECIMALS) {
    throw new RangeError(
      `USDC supports at most ${USDC_DECIMALS} decimal places; got ${fraction.length} in "${dollars}"`,
    );
  }
  const padded = (fraction + '0'.repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  return atomicUsdc(BigInt(whole) * USDC_SCALE + BigInt(padded));
}

export function atomicToDollars(atomic: AtomicUsdc): string {
  const whole = atomic / USDC_SCALE;
  const fraction = atomic % USDC_SCALE;
  if (fraction === 0n) return whole.toString();
  const fStr = fraction.toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '');
  return `${whole}.${fStr}`;
}

/** Stellar networks CrawlPay settles on. */
export type Network = 'stellar-testnet' | 'stellar-mainnet';

export const NETWORKS = [
  'stellar-testnet',
  'stellar-mainnet',
] as const satisfies readonly Network[];

/** Network passphrase used when building and signing Stellar transactions. */
export const NETWORK_PASSPHRASE: Record<Network, string> = {
  'stellar-testnet': 'Test SDF Network ; September 2015',
  'stellar-mainnet': 'Public Global Stellar Network ; September 2015',
};
