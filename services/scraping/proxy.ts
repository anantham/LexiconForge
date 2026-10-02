/**
 * CORS proxy configuration and health tracking.
 * Maintains per-proxy success/failure stats and sorts by reliability.
 */

export interface ProxyConfig {
  url: string;
  type: 'param' | 'path';
  /** 'html' = raw text/html response; 'json' = parse JSON and extract content */
  responseFormat: 'html' | 'json';
  /** If responseFormat is 'json', the key in the JSON object holding the HTML content */
  contentKey?: string;
}

export interface ProxyHealthStatus {
  url: string;
  success: number;
  failures: number;
  lastError?: string;
  lastErrorTime?: Date;
  lastSuccessTime?: Date;
  /**
   * Recency-weighted response time, NOT a true average: each new sample is
   * blended 50/50 with the previous value (exponential half-decay), so recent
   * fetches dominate and old ones fade.
   */
  recentResponseTime?: number;
  isHealthy: boolean;
}

/**
 * Automatic public CORS fallback is disabled. A failed first-party fetch may
 * retry the requested site directly; it must not disclose the URL to unrelated
 * recipients. Retain the configuration type/diagnostics for existing consumers.
 */
export const PROXIES: ProxyConfig[] = [];

// Global proxy health tracking (module-level singleton)
const proxyHealthMap = new Map<string, ProxyHealthStatus>();

export function initializeProxyHealth(proxyUrl: string): ProxyHealthStatus {
  if (!proxyHealthMap.has(proxyUrl)) {
    proxyHealthMap.set(proxyUrl, {
      url: proxyUrl,
      success: 0,
      failures: 0,
      isHealthy: true,
    });
  }
  return proxyHealthMap.get(proxyUrl)!;
}

export function updateProxyHealth(
  proxyUrl: string,
  successful: boolean,
  responseTime?: number,
  error?: string
): void {
  const health = initializeProxyHealth(proxyUrl);

  if (successful) {
    health.success++;
    health.lastSuccessTime = new Date();
    if (responseTime) {
      // 50/50 blend with the previous value = recency-weighted half-decay,
      // not a true mean over all samples.
      health.recentResponseTime = health.recentResponseTime
        ? (health.recentResponseTime + responseTime) / 2
        : responseTime;
    }
    health.isHealthy = true;
  } else {
    health.failures++;
    health.lastError = error;
    health.lastErrorTime = new Date();
    const totalAttempts = health.success + health.failures;
    const failureRate = health.failures / totalAttempts;
    // Deliberately lenient: a proxy stays "healthy" until it has ≥3 attempts
    // AND a failure rate of 80% or more — e.g. a 79%-failing proxy is still
    // marked healthy. "isHealthy" here means "not yet demonstrably hopeless",
    // used only to deprioritize proxies in the sort order, not to skip them.
    health.isHealthy = totalAttempts < 3 || failureRate < 0.8;
  }

  console.log(
    `[Proxy Health] ${new URL(proxyUrl).hostname}: ${health.success}✓ ${health.failures}✗ (${health.isHealthy ? 'healthy' : 'unhealthy'})`
  );
}

export function getProxyHealthMap(): Map<string, ProxyHealthStatus> {
  return proxyHealthMap;
}

export function getProxyDiagnostics(): string {
  const diagnostics = Array.from(proxyHealthMap.values())
    .sort((a, b) => {
      if (a.isHealthy !== b.isHealthy) return a.isHealthy ? -1 : 1;
      const aSuccessRate = a.success / (a.success + a.failures || 1);
      const bSuccessRate = b.success / (b.success + b.failures || 1);
      return bSuccessRate - aSuccessRate;
    })
    .map((h) => {
      const hostname = new URL(h.url).hostname;
      const successRate =
        h.success + h.failures > 0
          ? ((h.success / (h.success + h.failures)) * 100).toFixed(0)
          : '0';
      const status = h.isHealthy ? '🟢' : '🔴';
      const lastError = h.lastError ? ` (${h.lastError})` : '';
      return `${status} ${hostname}: ${successRate}% success (${h.success}✓/${h.failures}✗)${lastError}`;
    })
    .join('\n');

  return `Proxy Health Status:\n${diagnostics}`;
}

/** Exported alias used by external callers */
export const getProxyHealthDiagnostics = getProxyDiagnostics;

// PLAYWRIGHT_PROXY_URL (VPS-hosted headless-browser fetch proxy at
// 3-99-221-14.sslip.io) was removed 2026-07-26 — the VPS had been dead ~4 months.
// See fetcher.ts for the removal note; restore only WITH a health check.
