# Wire Signature Verifier into Express Middleware

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the `Ed25519SignatureVerifier` into the Express middleware so priced paths require a valid Web Bot Auth signature before offering payment.

**Architecture:** Add an optional `signatureVerifier` to `OctroiMiddlewareConfig`. When set, the middleware verifies the signature after classifying a request as a crawler and before checking pricing. Invalid signatures get a 402 with an `invalid_signature` error. This is opt-in — publishers who don't configure a verifier get the existing behavior.

**Tech Stack:** TypeScript, Express, Vitest

---

### Task 1: Add `signatureVerifier` to middleware config

**Files:**

- Modify: `packages/proxy-middleware/src/types.ts`
- Modify: `packages/proxy-middleware/src/express.ts`

- [ ] **Step 1: Add `signatureVerifier` to `OctroiMiddlewareConfig`**

In `packages/proxy-middleware/src/types.ts`, add the import and config option:

```typescript
// Add import at top
import type { SignatureVerifier } from './signature-verifier';

// Add to OctroiMiddlewareConfig, after the `pricingResolver` option (line 39):
  /** Verify Web Bot Auth signatures on crawler requests. When set, priced paths require a valid signature. */
  signatureVerifier?: SignatureVerifier;
```

- [ ] **Step 2: Wire verification into the middleware flow**

In `packages/proxy-middleware/src/express.ts`, add verification after the pricing check (after line 53, before the payment header check):

```typescript
// verify Web Bot Auth signature if configured
if (config.signatureVerifier) {
  const host = req.get('host') ?? 'localhost';
  const sigResult = config.signatureVerifier.verify(
    host,
    req.headers as Record<string, string | string[] | undefined>,
  );
  if (!sigResult.valid) {
    res.status(402).json({
      x402Version: 1,
      error: 'invalid_signature',
      detail: sigResult.error,
    });
    return;
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @octroi/proxy-middleware typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/proxy-middleware/src/types.ts packages/proxy-middleware/src/express.ts
git commit -m "feat(middleware): wire signature verifier into Express middleware flow"
```

---

### Task 2: Test the wiring

**Files:**

- Modify: `packages/proxy-middleware/src/__tests__/signature-verifier.test.ts`

- [ ] **Step 1: Add integration test for the middleware flow**

Add to `packages/proxy-middleware/src/__tests__/signature-verifier.test.ts`:

```typescript
import { octroi } from '../express';
import type { Request, Response, NextFunction } from 'express';

describe('middleware signature verification', () => {
  const keypair = Keypair.random();
  const keyid = computeKeyid(keypair.rawPublicKey());
  const publicKeyB64 = Buffer.from(keypair.rawPublicKey()).toString('base64url');

  function createMockReq(authority: string, headers: Record<string, string>) {
    return {
      method: 'GET',
      originalUrl: '/article',
      protocol: 'http',
      ip: '127.0.0.1',
      headers: { host: authority, 'user-agent': 'GPTBot/1.0', ...headers },
      get: (name: string) => headers[name] ?? (name === 'host' ? authority : undefined),
    } as unknown as Request;
  }

  function createMockRes() {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      locals: {},
    } as unknown as Response;
    return res;
  }

  it('rejects crawler requests without valid signature when verifier is configured', () => {
    const verifier = new Ed25519SignatureVerifier({ knownKeys: { [keyid]: publicKeyB64 } });
    const middleware = octroi({
      publisherId: 'test',
      publisherWallet: 'GADEW5MW5OFWO5XVE4JXVBM3QDA5UEKBY3K4OGJMOCYVDLSOIGE2SC6L',
      asset: 'USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      network: 'stellar-testnet',
      facilitatorUrl: 'http://localhost:3001',
      defaultPrice: 1000n,
      signatureVerifier: verifier,
    });

    const req = createMockReq('example.com', {});
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'invalid_signature' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through crawler requests with valid signature', () => {
    const verifier = new Ed25519SignatureVerifier({ knownKeys: { [keyid]: publicKeyB64 } });
    const middleware = octroi({
      publisherId: 'test',
      publisherWallet: 'GADEW5MW5OFWO5XVE4JXVBM3QDA5UEKBY3K4OGJMOCYVDLSOIGE2SC6L',
      asset: 'USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      network: 'stellar-testnet',
      facilitatorUrl: 'http://localhost:3001',
      defaultPrice: 1000n,
      signatureVerifier: verifier,
    });

    const signed = signRequest(keypair, 'example.com');
    const req = createMockReq('example.com', {
      signature: signed.signature,
      'signature-input': signed.signatureInput,
    });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    // This will pass signature check but fail at facilitator verify (no real facilitator)
    // That's fine — we're testing that it gets past the signature check
    middleware(req, res, next);

    // Should NOT have been rejected with invalid_signature
    expect(res.status).not.toHaveBeenCalledWith(402);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @octroi/proxy-middleware test`
Expected: All tests PASS (including new middleware integration tests)

- [ ] **Step 3: Commit**

```bash
git add packages/proxy-middleware/src/__tests__/signature-verifier.test.ts
git commit -m "test(middleware): add integration tests for signature verification wiring"
```

---

### Task 3: Full verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: All packages PASS

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 3: Run format check**

Run: `pnpm format:check`
Expected: PASS (or run `pnpm format` to fix)

- [ ] **Step 4: Final commit if formatting needed**

```bash
pnpm format
git add -A
git commit -m "style: apply prettier formatting"
```
