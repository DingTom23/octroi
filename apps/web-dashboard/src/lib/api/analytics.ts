const BASE = '/api';

export type AnalyticsWindow = 'day' | 'week' | 'month';

export interface DailyDataPoint {
  /** YYYY-MM-DD, UTC. */
  date: string;
  /** Sum of atomic USDC amounts in this day (stringified bigint). */
  totalAtomic: string;
  /** Number of receipts in this day. */
  requestCount: number;
  /** Distinct counterparties in this day. */
  uniqueCounterparties: number;
}

export interface PublisherAnalytics {
  publisherId: string;
  window: AnalyticsWindow;
  totalRevenueAtomic: string;
  totalRequestCount: number;
  uniqueCrawlers: number;
  daily: DailyDataPoint[];
}

export interface CrawlerAnalytics {
  crawlerWallet: string;
  window: AnalyticsWindow;
  totalSpendAtomic: string;
  totalRequestCount: number;
  uniquePublishers: number;
  daily: DailyDataPoint[];
}

export class AnalyticsApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(code);
    this.name = 'AnalyticsApiError';
  }
}

async function readError(res: Response): Promise<AnalyticsApiError> {
  let code = `status_${res.status}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) code = body.error;
  } catch {
    /* not JSON */
  }
  return new AnalyticsApiError(code, res.status);
}

export async function getPublisherAnalytics(
  publisherId: string,
  window: AnalyticsWindow,
): Promise<PublisherAnalytics> {
  const res = await fetch(`${BASE}/analytics/publisher/${publisherId}?window=${window}`, {
    credentials: 'include',
  });
  if (!res.ok) throw await readError(res);
  const data = (await res.json()) as { analytics: PublisherAnalytics };
  return data.analytics;
}

export async function getCrawlerAnalytics(
  wallet: string,
  window: AnalyticsWindow,
): Promise<CrawlerAnalytics> {
  const res = await fetch(`${BASE}/analytics/crawler/${wallet}?window=${window}`, {
    credentials: 'include',
  });
  if (!res.ok) throw await readError(res);
  const data = (await res.json()) as { analytics: CrawlerAnalytics };
  return data.analytics;
}
