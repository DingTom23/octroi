# api-gateway (Go)

The Octroi control-plane API: receipts, analytics, publisher onboarding,
API-key auth, and provisional reputation. It is read-mostly and never sits on
the settlement hot path.

This service is Go/Gin (PRD §8.3). It reads the same Postgres schema the
facilitator writes (see `packages/persistence/migrations`), and it verifies
receipt signatures with the same Ed25519 canonical form as the TypeScript
`receipt-signer` (the cross-language compatibility is covered by a golden test
in `internal/receipt`).

## Run

```bash
cd apps/api-gateway
go run .            # reads API_PORT, OCTROI_NETWORK, DATABASE_URL, NEXT_PUBLIC_FACILITATOR_URL, TRUSTED_PROXIES
```

Without `DATABASE_URL` it uses an in-memory store (demo only). With it, it
connects to Postgres via pgx.

`TRUSTED_PROXIES` is a comma-separated list of proxy IPs/CIDRs. Only those
peers may set `X-Forwarded-For`/`X-Real-IP`; leave it empty when the gateway is
exposed directly so `ClientIP` uses the TCP peer address. Requests that exceed
the server timeouts are cut off, and unexpected failures are logged server-side
while the client receives only `{"error":"internal_error"}`.

## Develop

```bash
go build ./...
go test ./...
go vet ./...
gofmt -l .          # should print nothing
```

## Layout

```
main.go                 wiring (memory or postgres by DATABASE_URL)
internal/config         env parsing
internal/store          Publisher + Receipt stores (pgx + in-memory)
internal/auth           API-key hashing and bearer authentication
internal/receipt        canonical JSON + Ed25519 receipt verification
internal/analytics      revenue/spend aggregation with daily buckets
internal/reputation     provisional off-chain score
internal/probe          publisher integration probe
internal/server         Gin router and handlers
```
