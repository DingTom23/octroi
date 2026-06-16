import { Keypair } from '@stellar/stellar-base';
import type {
  CrawlPayReceipt,
  CrawlPayReceiptBody,
  Ed25519Signature,
  StellarAddress,
} from '@crawlpay/types';
import { canonicalizeReceipt } from './canonicalize';

/**
 * Signing surface — pluggable so production deployments can swap in a
 * KMS/HSM-backed Ed25519 signer without changing the rest of the stack.
 */
export interface ReceiptSigner {
  /** G-address of the signing key, embedded in receipts as `facilitatorPubkey`. */
  readonly publicKey: StellarAddress;
  /** Sign a message with the facilitator's Ed25519 key; returns a base64 signature. */
  sign(message: Uint8Array): Promise<Ed25519Signature>;
}

/**
 * In-process signer backed by a Stellar keypair (secret seed). Suitable for the
 * v0 hosted facilitator and for tests. For production, wrap a KMS/HSM-backed
 * Ed25519 signer in this same interface.
 */
export class StellarKeypairReceiptSigner implements ReceiptSigner {
  readonly publicKey: StellarAddress;
  readonly #keypair: Keypair;

  constructor(secretSeed: string) {
    this.#keypair = Keypair.fromSecret(secretSeed);
    this.publicKey = this.#keypair.publicKey() as StellarAddress;
  }

  async sign(message: Uint8Array): Promise<Ed25519Signature> {
    return this.#keypair.sign(Buffer.from(message)).toString('base64') as Ed25519Signature;
  }
}

/**
 * The signing preimage: UTF-8 bytes of the canonical JSON of a receipt body.
 * Ed25519 hashes internally, so the message is signed directly — no separate
 * digest step.
 */
export function canonicalReceiptBytes(body: CrawlPayReceiptBody): Uint8Array {
  return new TextEncoder().encode(canonicalizeReceipt(body));
}

/**
 * Sign a receipt body. The signer's public key is embedded as
 * `facilitatorPubkey` so verifiers can confirm signer identity from the
 * receipt alone.
 */
export async function signReceipt(
  body: Omit<CrawlPayReceiptBody, 'facilitatorPubkey'>,
  signer: ReceiptSigner,
): Promise<CrawlPayReceipt> {
  const withPubkey: CrawlPayReceiptBody = {
    ...body,
    facilitatorPubkey: signer.publicKey,
  };
  const signature = await signer.sign(canonicalReceiptBytes(withPubkey));
  return { ...withPubkey, signature };
}
