import { Keypair, StrKey } from '@stellar/stellar-base';
import type { CrawlPayReceipt, StellarAddress } from '@crawlpay/types';
import { canonicalReceiptBytes } from './sign';

export interface VerificationResult {
  valid: boolean;
  /** The `facilitatorPubkey` the signature was checked against. */
  signerPubkey: StellarAddress;
  /** Set when `valid=false`. */
  reason?: string;
}

/**
 * Verify a CrawlPayReceipt's Ed25519 signature.
 *
 *   1. Recompute the canonical bytes of the receipt body.
 *   2. Verify the signature against the embedded `facilitatorPubkey`.
 *   3. If `expectedSigner` is provided, require it to match `facilitatorPubkey`.
 *
 * Unlike ECDSA there is no public-key recovery; the receipt names its signer in
 * `facilitatorPubkey` and the signature is checked against that key. Returns a
 * structured result (never throws on a bad signature) so callers can attach the
 * reason to error responses or audit logs.
 */
export async function verifyReceipt(
  receipt: CrawlPayReceipt,
  expectedSigner?: StellarAddress,
): Promise<VerificationResult> {
  const { signature, ...body } = receipt;
  const signerPubkey = body.facilitatorPubkey;

  if (!StrKey.isValidEd25519PublicKey(signerPubkey)) {
    return {
      valid: false,
      signerPubkey,
      reason: 'facilitatorPubkey is not a valid Stellar public key',
    };
  }

  if (expectedSigner && signerPubkey !== expectedSigner) {
    return {
      valid: false,
      signerPubkey,
      reason: `facilitatorPubkey is not the expected signer ${expectedSigner}`,
    };
  }

  let ok = false;
  try {
    const keypair = Keypair.fromPublicKey(signerPubkey);
    ok = keypair.verify(Buffer.from(canonicalReceiptBytes(body)), Buffer.from(signature, 'base64'));
  } catch {
    ok = false;
  }

  if (!ok) {
    return {
      valid: false,
      signerPubkey,
      reason: 'signature does not verify against facilitatorPubkey',
    };
  }

  return { valid: true, signerPubkey };
}
