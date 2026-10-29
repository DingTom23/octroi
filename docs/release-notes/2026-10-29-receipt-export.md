# Publisher receipt export

- `GET /publishers/:id/receipts/export` streams a publisher's receipts as
  `format=csv` or `format=json` (newline-delimited JSON).
- The route requires the publisher's API key and ownership, accepts optional
  ISO 8601 `from`/`to` bounds, and returns an attachment with a dated filename.
- CSV columns are documented in the handler and escaped with `encoding/csv`;
  JSON is one full receipt per line so the response never buffers the export.
- Receipt paging now has a `nonce` tiebreaker so offset pagination cannot skip
  or repeat rows when timestamps collide.
