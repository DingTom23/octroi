import type { FastifyInstance } from 'fastify';
import type { StellarAddress } from '@crawlpay/types';
import type { ReceiptRepository } from '@crawlpay/persistence';

const G_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function crawlersRoutes(app: FastifyInstance, receipts: ReceiptRepository): void {
  app.get<{
    Params: { wallet: string };
    Querystring: { limit?: string; offset?: string };
  }>('/crawlers/:wallet/receipts', async (req, reply) => {
    if (!G_ADDRESS_RE.test(req.params.wallet)) {
      return reply.code(400).send({ error: 'wallet must be a Stellar G-address' });
    }
    const wallet = req.params.wallet as StellarAddress;

    const limit = req.query.limit ? Number(req.query.limit) : DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return reply.code(400).send({ error: `limit must be in [1, ${MAX_LIMIT}]` });
    }
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    if (!Number.isInteger(offset) || offset < 0) {
      return reply.code(400).send({ error: 'invalid offset' });
    }

    const [items, total] = await Promise.all([
      receipts.list({ from: wallet, limit, offset }),
      receipts.count({ from: wallet }),
    ]);
    return reply.send({
      crawler: { walletAddress: wallet },
      receipts: items,
      pagination: { total, limit, offset },
    });
  });
}
