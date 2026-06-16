import type { FastifyInstance } from 'fastify';
import type { CrawlPayReceipt, StellarAddress } from '@crawlpay/types';
import { verifyReceipt } from '@crawlpay/receipt-signer';
import type { ReceiptFilter, ReceiptRepository } from '@crawlpay/persistence';

const G_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface ListQuery {
  publisher_id?: string;
  /** Crawler G-address (receipt `from`). */
  from_wallet?: string;
  /** Publisher payout G-address (receipt `to`). */
  to_wallet?: string;
  /** ISO 8601 lower bound. */
  from_ts?: string;
  /** ISO 8601 upper bound. */
  to_ts?: string;
  limit?: string;
  offset?: string;
}

interface VerifyBody {
  receipt?: unknown;
  expectedSigner?: unknown;
}

function isIso(s: string): boolean {
  return !Number.isNaN(Date.parse(s));
}

function parseFilter(q: ListQuery): { filter: ReceiptFilter; error?: string } {
  const filter: ReceiptFilter = {};
  if (q.publisher_id) filter.publisherId = q.publisher_id;
  if (q.from_wallet) {
    if (!G_ADDRESS_RE.test(q.from_wallet)) return { filter, error: 'invalid from_wallet' };
    filter.from = q.from_wallet as StellarAddress;
  }
  if (q.to_wallet) {
    if (!G_ADDRESS_RE.test(q.to_wallet)) return { filter, error: 'invalid to_wallet' };
    filter.to = q.to_wallet as StellarAddress;
  }
  if (q.from_ts) {
    if (!isIso(q.from_ts)) return { filter, error: 'invalid from_ts (expected ISO 8601)' };
    filter.fromTimestamp = q.from_ts;
  }
  if (q.to_ts) {
    if (!isIso(q.to_ts)) return { filter, error: 'invalid to_ts (expected ISO 8601)' };
    filter.toTimestamp = q.to_ts;
  }
  const limit = q.limit ? Number(q.limit) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { filter, error: `limit must be in [1, ${MAX_LIMIT}]` };
  }
  filter.limit = limit;
  const offset = q.offset ? Number(q.offset) : 0;
  if (!Number.isInteger(offset) || offset < 0) return { filter, error: 'invalid offset' };
  filter.offset = offset;
  return { filter };
}

export function receiptsRoutes(app: FastifyInstance, receipts: ReceiptRepository): void {
  app.get<{ Querystring: ListQuery }>('/receipts', async (req, reply) => {
    const { filter, error } = parseFilter(req.query);
    if (error) return reply.code(400).send({ error });

    const [items, total] = await Promise.all([
      receipts.list(filter),
      receipts.count({ ...filter, limit: undefined, offset: undefined }),
    ]);
    return reply.send({
      receipts: items,
      pagination: {
        total,
        limit: filter.limit ?? DEFAULT_LIMIT,
        offset: filter.offset ?? 0,
      },
    });
  });

  app.get<{ Params: { nonce: string } }>('/receipts/:nonce', async (req, reply) => {
    const receipt = await receipts.getByNonce(req.params.nonce);
    if (!receipt) return reply.code(404).send({ error: 'receipt not found' });
    return reply.send({ receipt });
  });

  app.post('/receipts/verify', async (req, reply) => {
    const body = (req.body ?? {}) as VerifyBody;
    if (!body.receipt || typeof body.receipt !== 'object') {
      return reply.code(400).send({ error: 'receipt required (object)' });
    }
    const expectedSigner =
      typeof body.expectedSigner === 'string' && G_ADDRESS_RE.test(body.expectedSigner)
        ? (body.expectedSigner as StellarAddress)
        : undefined;
    const result = await verifyReceipt(body.receipt as CrawlPayReceipt, expectedSigner);
    return reply.send(result);
  });
}
