import type { IncomingHttpHeaders } from 'http';

export interface RequestSignals {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  ip?: string;
}

export interface ClassificationResult {
  isCrawler: boolean;
  /** Confidence in `[0, 1]`. 1 = certain. */
  confidence: number;
  /** Short identifier for the rule that fired (for logs / audit). */
  reason: string;
}

export interface BotClassifier {
  classify(signals: RequestSignals): ClassificationResult;
}

/**
 * Case-insensitive regex patterns matching known AI/agent crawler User-Agents.
 * Ordering doesn't matter for correctness — first hit wins.
 */
const KNOWN_BOT_PATTERNS: RegExp[] = [
  // OpenAI
  /GPTBot/i,
  /ChatGPT-User/i,
  /OAI-SearchBot/i,
  // Anthropic
  /ClaudeBot/i,
  /Claude-Web/i,
  /anthropic-ai/i,
  // Perplexity
  /PerplexityBot/i,
  /Perplexity-User/i,
  // Other major model providers
  /cohere-ai/i,
  /mistralai/i,
  /Google-Extended/i,
  /Bytespider/i,
  /Applebot-Extended/i,
  /Meta-ExternalAgent/i,
  /Amazonbot/i,
  /DuckAssistBot/i,
  // General-purpose crawlers
  /CCBot/i,
  /Diffbot/i,
  /ImagesiftBot/i,
  /Omgilibot/i,
  // CrawlPay-aware crawlers self-identify
  /CrawlPay/i,
];

/**
 * Default heuristic classifier.
 *
 * Signals are evaluated in priority order:
 *
 *   1. Request carries an `X-PAYMENT` header → unambiguous crawler.
 *   2. User-Agent matches a known AI bot pattern.
 *   3. User-Agent contains a generic bot/crawler/spider token.
 *   4. None of Accept-Language, Cookie, Referer, `Accept: text/html` → likely a bot.
 *   5. Otherwise → classify as human.
 *
 * Defaults to "human" on ambiguous signals because false positives
 * (paywalling a human) hurt publishers more than false negatives.
 */
export class DefaultBotClassifier implements BotClassifier {
  classify(signals: RequestSignals): ClassificationResult {
    if (signals.headers['x-payment']) {
      return { isCrawler: true, confidence: 1, reason: 'x-payment-header' };
    }

    const ua = headerString(signals.headers['user-agent']);

    for (const pattern of KNOWN_BOT_PATTERNS) {
      if (pattern.test(ua)) {
        return { isCrawler: true, confidence: 0.95, reason: `ua-match:${pattern.source}` };
      }
    }

    // Match `bot|crawler|spider` at a real boundary: start-of-string, any
    // non-word char, or a lowercase→uppercase camelCase transition (so
    // `AcmeContentSpider/1.0` still triggers). Trailing `\b` keeps `robots.txt`
    // and other substrings from misfiring.
    if (/(?:^|[\W_]|[a-z])(?:bot|crawler|spider)\b/i.test(ua)) {
      return { isCrawler: true, confidence: 0.7, reason: 'ua-generic-bot-suffix' };
    }

    const hasAcceptLanguage = signals.headers['accept-language'] !== undefined;
    const hasCookie = signals.headers['cookie'] !== undefined;
    const hasReferer = signals.headers['referer'] !== undefined;
    const accept = headerString(signals.headers['accept']);

    if (!hasAcceptLanguage && !hasCookie && !hasReferer && !accept.includes('text/html')) {
      return { isCrawler: true, confidence: 0.5, reason: 'missing-browser-headers' };
    }

    return { isCrawler: false, confidence: 0.5, reason: 'no-bot-signals' };
  }
}

function headerString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(',');
  return value ?? '';
}
