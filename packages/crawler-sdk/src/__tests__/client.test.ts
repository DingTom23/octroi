import { afterEach, describe, expect, it, vi } from 'vitest';
import { atomicUsdc } from '@octroi/types';
import type {
  AssetId,
  PaymentRequirement,
  PaymentRequiredResponse,
  StellarAddress,
  X402PaymentPayload,
} from '@octroi/types';
import { OctroiClient } from '../client';
import type { PaymentSigner } from '../payment-signer';
import { UnsupportedOfferError } from '../types';

const CRAWLER = 'GCBFU4JRIBELJO4VG2SH54R4RGZS6ACCSOUZ5ZVAAMMD52AUDKE7OAUH' as StellarAddress;
const PAY_TO = 'GAZH5LOBQ5SNT7IVUS77D6SBK6OTIMSL5M5MBSXV2Q5DSDNMAPLCBASK' as StellarAddress;
const USDC = 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' as AssetId;
const OTHER_ASSET = 'USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' as AssetId;
const URL = 'https://example.com/article';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function offer(overrides: Partial<PaymentRequirement> = {}): PaymentRequiredResponse {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: 'stellar-testnet',
        maxAmountRequired: '1000',
        resource: URL,
        payTo: PAY_TO,
        asset: USDC,
        maxTimeoutSeconds: 60,
        extra: { settlement: 'x402' },
        ...overrides,
      },
    ],
  };
}

function makeClient(onSkip = vi.fn()) {
  const signer: PaymentSigner = {
    address: CRAWLER,
    createPayment: vi.fn(
      async (requirement): Promise<X402PaymentPayload> => ({
        x402Version: 1,
        scheme: 'exact',
        network: requirement.network,
        settlement: 'x402',
        payload: { authorizationEntry: 'AAAA', from: CRAWLER },
      }),
    ),
    getBalance: vi.fn(async () => ({ available: atomicUsdc(0n) })),
  };
  const client = new OctroiClient({
    secret: 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    network: 'stellar-testnet',
    usdcAsset: USDC,
    maxPerRequest: atomicUsdc(1_000_000n),
    paymentSigner: signer,
    onSkip,
  });
  return { client, signer, onSkip };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('OctroiClient offer selection', () => {
  it('refuses an offer for a different asset', async () => {
    const { client, signer, onSkip } = makeClient();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(offer({ asset: OTHER_ASSET }), 402)),
    );

    await expect(client.fetch(URL)).rejects.toBeInstanceOf(UnsupportedOfferError);
    expect(onSkip).toHaveBeenCalledWith(
      expect.objectContaining({ url: URL, reason: 'unsupported-offer' }),
    );
    expect(signer.createPayment).not.toHaveBeenCalled();
  });

  it('refuses an offer for a different network', async () => {
    const { client, signer, onSkip } = makeClient();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(offer({ network: 'stellar-mainnet' }), 402)),
    );

    await expect(client.fetch(URL)).rejects.toBeInstanceOf(UnsupportedOfferError);
    expect(onSkip).toHaveBeenCalledWith(
      expect.objectContaining({ url: URL, reason: 'unsupported-offer' }),
    );
    expect(signer.createPayment).not.toHaveBeenCalled();
  });

  it('pays when both asset and network match', async () => {
    const { client, signer, onSkip } = makeClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(offer(), 402))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const result = await client.fetch(URL);

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ ok: true });
    expect(result.paid).toBe(atomicUsdc(1000n));
    expect(signer.createPayment).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });
});
