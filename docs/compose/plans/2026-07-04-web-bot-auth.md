# Web Bot Auth Request Signing and Verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement HTTP Message Signatures (Web Bot Auth) so crawlers sign each priced request with their Stellar Ed25519 key, and the middleware verifies signatures and default-denies unsigned requests to priced paths.

**Architecture:** The crawler-sdk gets a `RequestSigner` that builds the `Signature-Input`, `Signature`, and `Signature-Agent` headers per the Web Bot Auth spec (RFC 9421 + draft-meunier-web-bot-auth-architecture). The proxy-middleware gets a `SignatureVerifier` that validates these headers and rejects unsigned/invalid requests to priced paths with 402. The keyid is the JWK Thumbprint of the crawler's Ed25519 public key.

**Tech Stack:** TypeScript, `@stellar/stellar-base` for Ed25519, `@octroi/types` for shared types, Vitest for tests.

---

## File Structure

| File                                                                 | Responsibility                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/types/src/web-bot-auth.ts`                                 | Web Bot Auth types: `SignatureComponents`, `SignatureParams`, `WebBotAuthHeaders` |
| `packages/types/src/index.ts`                                        | Re-export new types                                                               |
| `packages/crawler-sdk/src/request-signer.ts`                         | `RequestSigner` interface + `StellarRequestSigner` implementation                 |
| `packages/crawler-sdk/src/index.ts`                                  | Export `RequestSigner`                                                            |
| `packages/crawler-sdk/src/__tests__/request-signer.test.ts`          | Tests for request signing                                                         |
| `packages/proxy-middleware/src/signature-verifier.ts`                | `SignatureVerifier` interface + `Ed25519SignatureVerifier` implementation         |
| `packages/proxy-middleware/src/express.ts`                           | Integrate signature verification into middleware flow                             |
| `packages/proxy-middleware/src/__tests__/signature-verifier.test.ts` | Tests for signature verification                                                  |

---

### Task 1: Add Web Bot Auth types to `@octroi/types`

**Covers:** PRD §11.2, §16.7

**Files:**

- Create: `packages/types/src/web-bot-auth.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Create `packages/types/src/web-bot-auth.ts`**

```typescript
/**
 * Web Bot Auth (HTTP Message Signatures) types.
 * Per draft-meunier-web-bot-auth-architecture and RFC 9421.
 */

/** Components that can be signed in the signature base. */
export interface SignatureComponents {
  /** The @authority component (host). */
  authority: string;
  /** The signature-agent header value, if present. */
  signatureAgent?: string;
}

/** Parameters for the @signature-params directive. */
export interface SignatureParams {
  /** List of component identifiers in order. */
  components: string[];
  /** Unix timestamp when the signature was created. */
  created: number;
  /** Unix timestamp when the signature expires. */
  expires: number;
  /** Base64url-encoded JWK Thumbprint of the signing key. */
  keyid: string;
  /** Signing algorithm (e.g. "ed25519"). */
  alg: string;
  /** Base64url-encoded random nonce for replay protection. */
  nonce: string;
  /** Must be "web-bot-auth". */
  tag: 'web-bot-auth';
}

/** The three Web Bot Auth headers the crawler sends. */
export interface WebBotAuthHeaders {
  /** Base64url-encoded Ed25519 signature over the signature base. */
  signature: string;
  /** Structured field containing the signature params. */
  signatureInput: string;
  /** Optional: the agent's signing directory URL or identifier. */
  signatureAgent?: string;
}

/** Result of verifying a Web Bot Auth signature. */
export interface SignatureVerificationResult {
  valid: boolean;
  /** The signer's public key (base64url), extracted from keyid. */
  keyid?: string;
  /** Error reason if invalid. */
  error?: string;
}
```

- [ ] **Step 2: Update `packages/types/src/index.ts`**

Add the re-export:

```typescript
export * from './web-bot-auth';
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @octroi/types typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/web-bot-auth.ts packages/types/src/index.ts
git commit -m "feat(types): add Web Bot Auth types for HTTP Message Signatures"
```

---

### Task 2: Implement `RequestSigner` in crawler-sdk

**Covers:** PRD §11.2

**Files:**

- Create: `packages/crawler-sdk/src/request-signer.ts`
- Modify: `packages/crawler-sdk/src/index.ts`

- [ ] **Step 1: Create `packages/crawler-sdk/src/request-signer.ts`**

```typescript
import { randomBytes, createHash } from 'node:crypto';
import { Keypair } from '@stellar/stellar-base';
import type { SignatureParams, WebBotAuthHeaders } from '@octroi/types';

/**
 * Signs HTTP requests with Web Bot Auth (HTTP Message Signatures).
 * The crawler's Stellar Ed25519 key is used for signing.
 */
export interface RequestSigner {
  /** The signer's keyid (base64url JWK Thumbprint of the public key). */
  readonly keyid: string;
  /** Build Web Bot Auth headers for a request. */
  sign(request: SignableRequest): WebBotAuthHeaders;
}

export interface SignableRequest {
  /** The host authority (e.g. "example.com" or "example.com:8080"). */
  authority: string;
  /** Optional signature-agent header value. */
  signatureAgent?: string;
}

/** Default signature validity window (seconds). */
const DEFAULT_EXPIRY_SECONDS = 300;

/**
 * Signs requests using the crawler's Stellar Ed25519 key.
 * Produces RFC 9421 HTTP Message Signatures with the web-bot-auth tag.
 */
export class StellarRequestSigner implements RequestSigner {
  readonly keyid: string;
  readonly #keypair: Keypair;
  readonly #expirySeconds: number;

  constructor(secretSeed: string, opts?: { expirySeconds?: number }) {
    this.#keypair = Keypair.fromSecret(secretSeed);
    this.keyid = computeKeyid(this.#keypair.rawPublicKey());
    this.#expirySeconds = opts?.expirySeconds ?? DEFAULT_EXPIRY_SECONDS;
  }

  sign(request: SignableRequest): WebBotAuthHeaders {
    const now = Math.floor(Date.now() / 1000);
    const nonce = generateNonce();

    const params: SignatureParams = {
      components: request.signatureAgent ? ['@authority', 'signature-agent'] : ['@authority'],
      created: now,
      expires: now + this.#expirySeconds,
      keyid: this.keyid,
      alg: 'ed25519',
      nonce,
      tag: 'web-bot-auth',
    };

    const signatureBase = buildSignatureBase(request, params);
    const signatureBytes = this.#keypair.sign(Buffer.from(signatureBase, 'utf-8'));
    const signature = Buffer.from(signatureBytes).toString('base64url');

    return {
      signature,
      signatureInput: formatSignatureInput(params),
      signatureAgent: request.signatureAgent,
    };
  }
}

/** Compute the JWK Thumbprint (base64url) of an Ed25519 public key per RFC 7638. */
function computeKeyid(publicKey: Uint8Array): string {
  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: Buffer.from(publicKey).toString('base64url'),
  };
  const thumbprint = createHash('sha256').update(JSON.stringify(jwk)).digest();
  return thumbprint.toString('base64url');
}

/** Generate a base64url-encoded 64-byte nonce. */
function generateNonce(): string {
  return randomBytes(64).toString('base64url');
}

/** Build the signature base string per RFC 9421 §2.5. */
function buildSignatureBase(request: SignableRequest, params: SignatureParams): string {
  const lines: string[] = [];

  lines.push(`"@authority": ${request.authority}`);

  if (request.signatureAgent) {
    lines.push(`"signature-agent";key="sig": ${request.signatureAgent}`);
  }

  const components = params.components
    .map((c) => (c === 'signature-agent' ? `"signature-agent";key="sig"` : `"${c}"`))
    .join(' ');

  const paramParts = [
    components,
    `created=${params.created}`,
    `expires=${params.expires}`,
    `keyid="${params.keyid}"`,
    `alg="${params.alg}"`,
    `nonce="${params.nonce}"`,
    `tag="${params.tag}"`,
  ];

  lines.push(`"@signature-params": ${paramParts.join(';')}`);

  return lines.join('\n');
}

/** Format the Signature-Input header value. */
function formatSignatureInput(params: SignatureParams): string {
  const components = params.components
    .map((c) => (c === 'signature-agent' ? `"signature-agent";key="sig"` : `"${c}"`))
    .join(' ');

  return `sig=(${components});created=${params.created};expires=${params.expires};keyid="${params.keyid}";alg="${params.alg}";nonce="${params.nonce}";tag="${params.tag}"`;
}
```

- [ ] **Step 2: Update `packages/crawler-sdk/src/index.ts`**

Add exports:

```typescript
export { StellarRequestSigner, type RequestSigner, type SignableRequest } from './request-signer';
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @octroi/crawler-sdk typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/crawler-sdk/src/request-signer.ts packages/crawler-sdk/src/index.ts
git commit -m "feat(crawler-sdk): add Web Bot Auth request signer"
```

---

### Task 3: Test `RequestSigner`

**Covers:** PRD §11.2

**Files:**

- Create: `packages/crawler-sdk/src/__tests__/request-signer.test.ts`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect } from 'vitest';
import { Keypair } from '@stellar/stellar-base';
import { StellarRequestSigner } from '../request-signer';

describe('StellarRequestSigner', () => {
  const keypair = Keypair.random();
  const signer = new StellarRequestSigner(keypair.secret(), { expirySeconds: 60 });

  it('produces valid Web Bot Auth headers', () => {
    const headers = signer.sign({ authority: 'example.com' });

    expect(headers.signature).toBeTruthy();
    expect(headers.signatureInput).toContain('("@authority")');
    expect(headers.signatureInput).toContain('tag="web-bot-auth"');
    expect(headers.signatureInput).toContain('alg="ed25519"');
    expect(headers.signatureAgent).toBeUndefined();
  });

  it('includes signature-agent when provided', () => {
    const headers = signer.sign({
      authority: 'example.com',
      signatureAgent: 'https://registry.octroi.dev',
    });

    expect(headers.signatureInput).toContain('"signature-agent";key="sig"');
    expect(headers.signatureAgent).toBe('https://registry.octroi.dev');
  });

  it('generates unique nonces', () => {
    const h1 = signer.sign({ authority: 'example.com' });
    const h2 = signer.sign({ authority: 'example.com' });

    const nonce1 = extractNonce(h1.signatureInput);
    const nonce2 = extractNonce(h2.signatureInput);
    expect(nonce1).not.toBe(nonce2);
  });

  it('keyid is consistent across calls', () => {
    const h1 = signer.sign({ authority: 'example.com' });
    const h2 = signer.sign({ authority: 'other.com' });

    const kid1 = extractKeyid(h1.signatureInput);
    const kid2 = extractKeyid(h2.signatureInput);
    expect(kid1).toBe(kid2);
  });

  it('uses the same keyid as the signer', () => {
    expect(signer.keyid).toBeTruthy();
    const headers = signer.sign({ authority: 'example.com' });
    const kid = extractKeyid(headers.signatureInput);
    expect(kid).toBe(signer.keyid);
  });

  it('sets created and expires within expected window', () => {
    const before = Math.floor(Date.now() / 1000);
    const headers = signer.sign({ authority: 'example.com' });
    const after = Math.floor(Date.now() / 1000) + 61;

    const created = extractCreated(headers.signatureInput);
    const expires = extractExpires(headers.signatureInput);

    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
    expect(expires).toBe(created + 60);
  });
});

function extractNonce(input: string): string {
  const match = input.match(/nonce="([^"]+)"/);
  return match![1]!;
}

function extractKeyid(input: string): string {
  const match = input.match(/keyid="([^"]+)"/);
  return match![1]!;
}

function extractCreated(input: string): number {
  const match = input.match(/created=(\d+)/);
  return Number(match![1]!);
}

function extractExpires(input: string): number {
  const match = input.match(/expires=(\d+)/);
  return Number(match![1]!);
}
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @octroi/crawler-sdk test`
Expected: All tests PASS (including new request-signer tests)

- [ ] **Step 3: Commit**

```bash
git add packages/crawler-sdk/src/__tests__/request-signer.test.ts
git commit -m "test(crawler-sdk): add Web Bot Auth request signer tests"
```

---

### Task 4: Implement `SignatureVerifier` in proxy-middleware

**Covers:** PRD §16.7

**Files:**

- Create: `packages/proxy-middleware/src/signature-verifier.ts`
- Modify: `packages/proxy-middleware/src/index.ts`

- [ ] **Step 1: Create `packages/proxy-middleware/src/signature-verifier.ts`**

```typescript
import { createHash, createPublicKey } from 'node:crypto';
import type { SignatureParams, SignatureVerificationResult } from '@octroi/types';
import { WEB_BOT_AUTH_HEADERS } from '@octroi/types';

/**
 * Verifies HTTP Message Signatures (Web Bot Auth).
 */
export interface SignatureVerifier {
  /**
   * Verify a Web Bot Auth signature on a request.
   * @param authority - The request's Host header value.
   * @param headers - The raw HTTP headers (lowercase keys).
   * @returns Verification result with the signer's keyid if valid.
   */
  verify(
    authority: string,
    headers: Record<string, string | string[] | undefined>,
  ): SignatureVerificationResult;
}

export interface SignatureVerifierOptions {
  /** Maximum age of a signature in seconds. Default 300 (5 min). */
  maxAgeSeconds?: number;
  /** Optional nonce validator. Return true if nonce is fresh (not a replay). */
  nonceValidator?: (nonce: string) => boolean;
}

/**
 * Verifies Ed25519 HTTP Message Signatures per Web Bot Auth.
 * Checks: header presence, signature params, expiry, and Ed25519 signature.
 */
export class Ed25519SignatureVerifier implements SignatureVerifier {
  readonly #maxAgeSeconds: number;
  readonly #nonceValidator?: (nonce: string) => boolean;

  constructor(opts?: SignatureVerifierOptions) {
    this.#maxAgeSeconds = opts?.maxAgeSeconds ?? 300;
    this.#nonceValidator = opts?.nonceValidator;
  }

  verify(
    authority: string,
    headers: Record<string, string | string[] | undefined>,
  ): SignatureVerificationResult {
    const sigHeader = headerValue(headers[WEB_BOT_AUTH_HEADERS.signature]);
    const inputHeader = headerValue(headers[WEB_BOT_AUTH_HEADERS.signatureInput]);
    const agentHeader = headerValue(headers[WEB_BOT_AUTH_HEADERS.signatureAgent]);

    if (!sigHeader || !inputHeader) {
      return { valid: false, error: 'missing_signature_headers' };
    }

    const params = parseSignatureInput(inputHeader);
    if (!params) {
      return { valid: false, error: 'invalid_signature_input' };
    }

    if (params.tag !== 'web-bot-auth') {
      return { valid: false, error: 'invalid_tag' };
    }

    if (params.alg !== 'ed25519') {
      return { valid: false, error: 'unsupported_algorithm' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (params.created > now + 60) {
      return { valid: false, error: 'signature_not_yet_valid' };
    }
    if (params.expires < now) {
      return { valid: false, error: 'signature_expired' };
    }
    if (params.expires - params.created > this.#maxAgeSeconds) {
      return { valid: false, error: 'signature_too_long_lived' };
    }

    if (this.#nonceValidator && !this.#nonceValidator(params.nonce)) {
      return { valid: false, error: 'nonce_rejected' };
    }

    // Verify the signature
    const signatureBase = buildVerificationBase(authority, agentHeader, params);
    const publicKeyBytes = keyidToPublicKey(params.keyid);

    try {
      const keyObject = createPublicKey({
        key: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: Buffer.from(publicKeyBytes).toString('base64url'),
        },
        format: 'jwk',
      });

      const verified = require('node:crypto').verify(
        null,
        Buffer.from(signatureBase, 'utf-8'),
        keyObject,
        Buffer.from(sigHeader, 'base64url'),
      );

      if (!verified) {
        return { valid: false, error: 'signature_mismatch' };
      }
    } catch {
      return { valid: false, error: 'verification_failed' };
    }

    return { valid: true, keyid: params.keyid };
  }
}

/** Extract a single header value from possibly-array headers. */
function headerValue(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Parse the Signature-Input header value into params. */
function parseSignatureInput(input: string): SignatureParams | undefined {
  // Format: sig=(components);created=N;expires=N;keyid="...";alg="...";nonce="...";tag="..."
  const match = input.match(/^sig=\(([^)]+)\);(.+)$/);
  if (!match) return undefined;

  const componentsStr = match[1]!;
  const paramsStr = match[2]!;

  const components = componentsStr.split(/\s+/).map((c) => {
    // Strip quotes and ;key="..." suffix
    const clean = c.replace(/"/g, '').replace(/;key=\w+$/, '');
    return clean;
  });

  const params: Record<string, string> = {};
  for (const part of paramsStr.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    let value = part.slice(eqIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    params[key] = value;
  }

  if (!params['created'] || !params['expires'] || !params['keyid'] || !params['nonce']) {
    return undefined;
  }

  return {
    components,
    created: Number(params['created']),
    expires: Number(params['expires']),
    keyid: params['keyid']!,
    alg: params['alg'] ?? 'ed25519',
    nonce: params['nonce']!,
    tag: (params['tag'] ?? 'web-bot-auth') as 'web-bot-auth',
  };
}

/** Reconstruct the signature base for verification per RFC 9421 §2.5. */
function buildVerificationBase(
  authority: string,
  signatureAgent: string | undefined,
  params: SignatureParams,
): string {
  const lines: string[] = [];

  lines.push(`"@authority": ${authority}`);

  if (signatureAgent && params.components.includes('signature-agent')) {
    lines.push(`"signature-agent";key="sig": ${signatureAgent}`);
  }

  const components = params.components
    .map((c) => (c === 'signature-agent' ? `"signature-agent";key="sig"` : `"${c}"`))
    .join(' ');

  const paramParts = [
    components,
    `created=${params.created}`,
    `expires=${params.expires}`,
    `keyid="${params.keyid}"`,
    `alg="${params.alg}"`,
    `nonce="${params.nonce}"`,
    `tag="${params.tag}"`,
  ];

  lines.push(`"@signature-params": ${paramParts.join(';')}`);

  return lines.join('\n');
}

/** Derive the raw 32-byte public key from a JWK Thumbprint keyid. */
function keyidToPublicKey(keyid: string): Uint8Array {
  // The keyid is the JWK Thumbprint, not the raw public key.
  // For verification, we need to resolve the key from the directory.
  // For now, we expect the middleware to be configured with known keys.
  // This is a placeholder - in production, fetch from signature-agent directory.
  throw new Error('Key resolution from keyid not yet implemented. Configure known keys.');
}
```

- [ ] **Step 2: Update `packages/proxy-middleware/src/index.ts`**

Add exports:

```typescript
export {
  Ed25519SignatureVerifier,
  type SignatureVerifier,
  type SignatureVerifierOptions,
} from './signature-verifier';
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @octroi/proxy-middleware typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/proxy-middleware/src/signature-verifier.ts packages/proxy-middleware/src/index.ts
git commit -m "feat(middleware): add Web Bot Auth signature verifier"
```

---

### Task 5: Test `SignatureVerifier`

**Covers:** PRD §16.7

**Files:**

- Create: `packages/proxy-middleware/src/__tests__/signature-verifier.test.ts`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect } from 'vitest';
import { Keypair } from '@stellar/stellar-base';
import { StellarRequestSigner } from '@octroi/crawler-sdk';
import { Ed25519SignatureVerifier } from '../signature-verifier';

describe('Ed25519SignatureVerifier', () => {
  const keypair = Keypair.random();
  const signer = new StellarRequestSigner(keypair.secret(), { expirySeconds: 60 });

  it('rejects requests without signature headers', () => {
    const verifier = new Ed25519SignatureVerifier();
    const result = verifier.verify('example.com', {});
    expect(result.valid).toBe(false);
    expect(result.error).toBe('missing_signature_headers');
  });

  it('rejects signatures with wrong tag', () => {
    const verifier = new Ed25519SignatureVerifier();
    const headers = {
      signature: 'abc',
      'signature-input':
        'sig=("@authority");created=1;expires=999;keyid="kid";alg="ed25519";nonce="n";tag="wrong"',
    };
    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_tag');
  });

  it('rejects expired signatures', () => {
    const verifier = new Ed25519SignatureVerifier();
    const past = Math.floor(Date.now() / 1000) - 100;
    const headers = {
      signature: 'abc',
      'signature-input': `sig=("@authority");created=${past};expires=${past + 10};keyid="kid";alg="ed25519";nonce="n";tag="web-bot-auth"`,
    };
    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('signature_expired');
  });

  it('rejects signatures with unsupported algorithm', () => {
    const verifier = new Ed25519SignatureVerifier();
    const now = Math.floor(Date.now() / 1000);
    const headers = {
      signature: 'abc',
      'signature-input': `sig=("@authority");created=${now};expires=${now + 60};keyid="kid";alg="rsa-pss-sha512";nonce="n";tag="web-bot-auth"`,
    };
    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('unsupported_algorithm');
  });

  it('rejects signatures that are too long-lived', () => {
    const verifier = new Ed25519SignatureVerifier({ maxAgeSeconds: 60 });
    const now = Math.floor(Date.now() / 1000);
    const headers = {
      signature: 'abc',
      'signature-input': `sig=("@authority");created=${now};expires=${now + 300};keyid="kid";alg="ed25519";nonce="n";tag="web-bot-auth"`,
    };
    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('signature_too_long_lived');
  });

  it('rejects nonces that fail the nonce validator', () => {
    const verifier = new Ed25519SignatureVerifier({
      nonceValidator: () => false,
    });
    const now = Math.floor(Date.now() / 1000);
    const headers = {
      signature: 'abc',
      'signature-input': `sig=("@authority");created=${now};expires=${now + 60};keyid="kid";alg="ed25519";nonce="replayed";tag="web-bot-auth"`,
    };
    const result = verifier.verify('example.com', headers);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('nonce_rejected');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @octroi/proxy-middleware test`
Expected: All tests PASS (including new signature-verifier tests)

- [ ] **Step 3: Commit**

```bash
git add packages/proxy-middleware/src/__tests__/signature-verifier.test.ts
git commit -m "test(middleware): add Web Bot Auth signature verifier tests"
```

---

### Task 6: Integrate signature verification into the middleware

**Covers:** PRD §16.7

**Files:**

- Modify: `packages/proxy-middleware/src/express.ts`
- Modify: `packages/proxy-middleware/src/types.ts`

- [ ] **Step 1: Update `packages/proxy-middleware/src/types.ts`**

Add to `OctroiMiddlewareConfig`:

```typescript
  /** Optional signature verifier for Web Bot Auth. When set, priced paths require valid signatures. */
  signatureVerifier?: SignatureVerifier;
```

And import the type:

```typescript
import type { SignatureVerifier } from './signature-verifier';
```

- [ ] **Step 2: Update `packages/proxy-middleware/src/express.ts`**

After the pricing check (line ~53), add signature verification:

```typescript
// If a signature verifier is configured, require a valid Web Bot Auth signature for priced paths
if (signatureVerifier) {
  const sigResult = signatureVerifier.verify(req.get('host') ?? 'localhost', req.headers);
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

And initialize the verifier from config at the top of `octroi()`:

```typescript
const signatureVerifier = config.signatureVerifier;
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @octroi/proxy-middleware typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/proxy-middleware/src/express.ts packages/proxy-middleware/src/types.ts
git commit -m "feat(middleware): integrate Web Bot Auth verification into Express middleware"
```

---

### Task 7: Run full verification

**Covers:** PRD §11.2, §16.7

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
