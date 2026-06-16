import type { FastifyInstance } from 'fastify';
import type { StellarAddress } from '@crawlpay/types';
import {
  WINDOW_DAYS,
  type AnalyticsService,
  type AnalyticsWindow,
} from '../services/analytics-service';

const G_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

function parseWindow(s: string | undefined): AnalyticsWindow | null {
  if (s === undefined || s === 'week') return 'week';
  if (s === 'day' || s === 'month') return s;
  return null;
}

export function analyticsRoutes(app: FastifyInstance, analytics: AnalyticsService): void {
  app.get<{ Params: { id: string }; Querystring: { window?: string } }>(
    '/analytics/publisher/:id',
    async (req, reply) => {
      const window = parseWindow(req.query.window);
      if (!window) {
        return reply.code(400).send({
          error: `window must be one of: ${Object.keys(WINDOW_DAYS).join(', ')}`,
        });
      }
      const analytic = await analytics.forPublisher(req.params.id, window);
      return reply.send({ analytics: analytic });
    },
  );

  app.get<{ Params: { wallet: string }; Querystring: { window?: string } }>(
    '/analytics/crawler/:wallet',
    async (req, reply) => {
      if (!G_ADDRESS_RE.test(req.params.wallet)) {
        return reply.code(400).send({ error: 'wallet must be a Stellar G-address' });
      }
      const window = parseWindow(req.query.window);
      if (!window) {
        return reply.code(400).send({
          error: `window must be one of: ${Object.keys(WINDOW_DAYS).join(', ')}`,
        });
      }
      const analytic = await analytics.forCrawler(req.params.wallet as StellarAddress, window);
      return reply.send({ analytics: analytic });
    },
  );
}
