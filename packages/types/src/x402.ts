import type { AssetId, Network, StellarAddress } from './primitives';

/** x402 protocol version CrawlPay speaks. */
export type X402Version = 1;

/** Payment scheme. `exact` settles a fixed amount per resource. */
export type PaymentScheme = 'exact';

/**
 * Settlement model carried in the offer and the payment.
 *   - `x402`: one signed Soroban authorization entry per request, settled as
 *     an individual USDC SAC transfer.
 *   - `mpp`: the request debits a pre-authorized MPP session budget; the
 *     session settles in bulk.
 */
export type SettlementModel = 'x402' | 'mpp';

/**
 * One payment option in a 402 response's `accepts` array — a single way the
 * publisher is willing to be paid for a resource.
 */
export interface PaymentRequirement {
  scheme: PaymentScheme;
  network: Network;
  /** Maximum the publisher requires, in atomic USDC, stringified. */
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  /** G-address that receives the USDC. Must equal the SAC transfer `to`. */
  payTo: StellarAddress;
  /** USDC asset identifier (`USDC:ISSUER`). */
  asset: AssetId;
  /** Validity window the crawler's authorization must fit within. */
  maxTimeoutSeconds: number;
  extra: PaymentRequirementExtra;
}

export interface PaymentRequirementExtra {
  /** Settlement model the publisher is offering for this resource. */
  settlement: SettlementModel;
  /** Whether the crawler may open an MPP session instead of paying per request. */
  mppSessionSupported?: boolean;
  /** Whether the facilitator sponsors the transaction fee (crawler needs only USDC). */
  feeSponsored?: boolean;
  crawlpay_publisher_id?: string;
  crawlpay_facilitator?: string;
  /** Agent id in the `crawlpay_registry`, if the crawler is registered. */
  crawlpay_agent_id?: string;
  crawlpay_reputation_score?: string;
  crawlpay_catalog_url?: string;
  [k: string]: unknown;
}

/** Full body of a 402 Payment Required response. */
export interface PaymentRequiredResponse {
  x402Version: X402Version;
  accepts: PaymentRequirement[];
  error?: string;
}

/** Per-request settlement: a signed Soroban authorization entry. */
export interface X402PaymentPayload {
  x402Version: X402Version;
  scheme: PaymentScheme;
  network: Network;
  settlement: 'x402';
  payload: {
    /** Base64 XDR of the signed Soroban authorization entry for the USDC SAC transfer. */
    authorizationEntry: string;
    /** The crawler's source G-address — the `from` of the SAC transfer. */
    from: StellarAddress;
  };
}

/** Session settlement: a debit against a pre-authorized MPP session budget. */
export interface MppPaymentPayload {
  x402Version: X402Version;
  scheme: PaymentScheme;
  network: Network;
  settlement: 'mpp';
  payload: {
    /** Active MPP session the per-request amount debits from. */
    sessionId: string;
    /** Amount to debit, in atomic USDC, stringified. */
    amount: string;
  };
}

/**
 * Payload sent in the `X-PAYMENT` header (base64-encoded JSON). Either a
 * per-request signed authorization entry or an MPP session debit.
 */
export type PaymentPayload = X402PaymentPayload | MppPaymentPayload;

/**
 * x402 HTTP header names. Payment is presented in `X-PAYMENT`; the signed
 * receipt is returned in `X-PAYMENT-RESPONSE`.
 */
export const X402_HEADERS = {
  payment: 'X-PAYMENT',
  response: 'X-PAYMENT-RESPONSE',
} as const;

/**
 * Web Bot Auth (HTTP Message Signatures) header names. The crawler signs each
 * request to a priced path with its Stellar Ed25519 key; `signature-agent`
 * resolves to its key in the `crawlpay_registry` directory.
 */
export const WEB_BOT_AUTH_HEADERS = {
  signatureAgent: 'signature-agent',
  signatureInput: 'signature-input',
  signature: 'signature',
} as const;
