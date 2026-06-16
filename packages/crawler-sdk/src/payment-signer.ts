import { Keypair } from '@stellar/stellar-base';
import type {
  AtomicUsdc,
  Network,
  PaymentRequirement,
  StellarAddress,
  X402PaymentPayload,
} from '@crawlpay/types';

export interface CrawlerBalance {
  /** USDC available to spend, atomic. */
  available: AtomicUsdc;
}

/**
 * Signs payments on behalf of the crawler. The default implementation targets
 * Stellar: it builds and signs a Soroban authorization entry for the offered
 * USDC SAC transfer. Pluggable so a smart wallet or a remote signer can be
 * substituted without touching the rest of the client.
 */
export interface PaymentSigner {
  /** The crawler's Stellar G-address — its payment account and identity. */
  readonly address: StellarAddress;
  /** Build and sign an `X-PAYMENT` payload for the offer (a Soroban auth entry). */
  createPayment(requirement: PaymentRequirement): Promise<X402PaymentPayload>;
  /** Read the crawler's spendable USDC balance. */
  getBalance(): Promise<CrawlerBalance>;
}

const SETTLEMENT_PENDING =
  'Soroban authorization-entry signing and USDC SAC settlement are not implemented in this build. ' +
  'This is the v0 Stellar settlement track — see the repository issues.';

/**
 * Default Stellar payment signer. The account address is derived from the
 * secret seed (offline). Authorization-entry signing and balance reads require
 * Soroban RPC and are implemented in the v0 settlement track.
 */
export class StellarPaymentSigner implements PaymentSigner {
  readonly address: StellarAddress;
  readonly #network: Network;
  readonly #keypair: Keypair;

  constructor(network: Network, secretSeed: string) {
    this.#network = network;
    this.#keypair = Keypair.fromSecret(secretSeed);
    this.address = this.#keypair.publicKey() as StellarAddress;
  }

  get network(): Network {
    return this.#network;
  }

  async createPayment(_requirement: PaymentRequirement): Promise<X402PaymentPayload> {
    throw new Error(SETTLEMENT_PENDING);
  }

  async getBalance(): Promise<CrawlerBalance> {
    throw new Error(SETTLEMENT_PENDING);
  }
}
