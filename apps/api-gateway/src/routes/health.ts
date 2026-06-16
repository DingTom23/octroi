import type { FastifyInstance } from 'fastify';

export interface HealthInfo {
  network: string;
  storage: 'memory' | 'postgres';
}

export function healthRoutes(app: FastifyInstance, info: HealthInfo): void {
  app.get('/health', async () => ({
    ok: true,
    service: 'crawlpay-api-gateway',
    version: '0.0.1',
    network: info.network,
    storage: info.storage,
  }));
}
