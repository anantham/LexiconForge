import { indexedDBService } from './indexeddb';

const nowIso = () => new Date().toISOString();

export type SupportedCreditProvider = 'DeepSeek' | 'PiAPI';

export type ProviderCreditType = 'balance';

export interface ProviderCreditSummary {
  provider: SupportedCreditProvider;
  fetchedAt: string;
  currency: string;
  type: ProviderCreditType;
  remaining?: number | null;
  total?: number | null;
  granted?: number | null;
  toppedUp?: number | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
}

type CacheKeyMap = Record<SupportedCreditProvider, string>;

const CACHE_KEYS: CacheKeyMap = {
  DeepSeek: 'credits-deepseek',
  PiAPI: 'credits-piapi',
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

async function cacheSummary(summary: ProviderCreditSummary): Promise<void> {
  const key = CACHE_KEYS[summary.provider];
  await indexedDBService.setSetting(key, summary);
}

async function getCachedSummary(provider: SupportedCreditProvider): Promise<ProviderCreditSummary | null> {
  const key = CACHE_KEYS[provider];
  return indexedDBService.getSetting<ProviderCreditSummary>(key);
}

async function fetchDeepSeekBalance(apiKey: string): Promise<ProviderCreditSummary> {
  const res = await fetch('https://api.deepseek.com/user/balance', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`DeepSeek balance fetch failed: ${res.status}`);
  }

  const json = await res.json();
  const balances = Array.isArray(json?.balance_infos) ? json.balance_infos : [];
  const preferred = balances.find((item: any) => String(item?.currency || '').toUpperCase() === 'USD') ?? balances[0] ?? null;

  const currency = typeof preferred?.currency === 'string'
    ? preferred.currency
    : typeof balances[0]?.currency === 'string'
      ? balances[0].currency
      : 'USD';

  const total = toNumber(preferred?.total_balance);
  const granted = toNumber(preferred?.granted_balance);
  const toppedUp = toNumber(preferred?.topped_up_balance);

  const summary: ProviderCreditSummary = {
    provider: 'DeepSeek',
    fetchedAt: nowIso(),
    currency,
    type: 'balance',
    remaining: total,
    total,
    granted,
    toppedUp,
    note: json?.is_available === false ? 'Balance unavailable' : null,
    metadata: {
      balance_infos: balances,
    },
  };

  await cacheSummary(summary);
  return summary;
}

async function fetchPiApiBalance(apiKey: string): Promise<ProviderCreditSummary> {
  const res = await fetch('https://api.piapi.ai/account/info', {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PiAPI credits failed ${res.status}: ${text}`);
  }

  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`PiAPI credits response parse error: ${(error as Error).message || error}`);
  }

  const balanceUSD = toNumber(json?.equivalent_in_usd);
  const total = balanceUSD ?? null;

  const summary: ProviderCreditSummary = {
    provider: 'PiAPI',
    fetchedAt: nowIso(),
    currency: 'USD',
    type: 'balance',
    remaining: total,
    total,
    note: typeof json?.remaining === 'number' ? `Remaining credits: ${json.remaining}` : null,
    metadata: {
      account_name: json?.account_name,
      account_id: json?.account_id,
      remaining: json?.remaining,
      raw: json,
    },
  };

  await cacheSummary(summary);
  return summary;
}

export const providerCreditCacheService = {
  fetchDeepSeekBalance,
  fetchPiApiBalance,
  getCachedSummary,
  cacheSummary,
};
