# API gateway hardening

- The gateway now serves through an explicit `http.Server` with
  `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout` and `IdleTimeout`, and
  drains connections on `SIGINT`/`SIGTERM` instead of exiting immediately.
- `TRUSTED_PROXIES` accepts a comma-separated list of proxy IPs/CIDRs. Empty
  means no proxy is trusted, so `ClientIP` uses the TCP peer address.
- Unexpected handler failures are logged server-side and returned to the
  client as `{"error":"internal_error"}` without driver or SQL text.
