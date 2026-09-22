// Free, no-API-key daily exchange rate feed (updated once a day, CDN-hosted,
// no signup) — https://github.com/fawazahmed0/exchange-api. Used to convert
// multi-currency placement revenue into a single GBP figure in the accounts
// module, rather than ever guessing a rate ourselves.
const ratesUrl = (base: string) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`;
const CACHE_TTL_MS = 60 * 60 * 1000; // rates only change daily — an hour keeps us well within that

// Last resort when the feed is down AND we've never fetched successfully
// (e.g. right after a server restart) — better than refusing to convert at
// all. Snapshots of real rates fetched from the feed above on 2026-09-03;
// only covers the currencies that actually appear in placement data. Update
// these if the feed has been down a while and they start looking stale.
const USD_FALLBACK_RATES: Record<string, number> = {
  usd: 1,
  gbp: 0.7409966,
  eur: 0.86224632,
  cad: 1.38298056,
  aed: 3.6725,
  sar: 3.75,
};

const GBP_FALLBACK_RATES: Record<string, number> = {
  gbp: 1,
  usd: 1.34953302,
  eur: 1.16363192,
  cad: 1.86637945,
  aed: 4.95616385,
  sar: 5.06075425,
};

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let usdCache: RateCache | null = null;
let gbpCache: RateCache | null = null;

export interface ExchangeRates {
  rates: Record<string, number>;
  // false only when nothing has ever been fetched successfully and we've
  // fallen back to the static snapshot above — callers can use this to be
  // honest in the UI about the rate not being live.
  live: boolean;
}

// Returns USD-to-<code> rates (e.g. { usd: 1, gbp: 0.74, cad: 1.38, ...}),
// preferring a fresh fetch, then the last known-good fetch (however stale),
// then the hardcoded fallback snapshot — never returning nothing.
export async function getUsdExchangeRates(): Promise<ExchangeRates> {
  if (usdCache && Date.now() - usdCache.fetchedAt < CACHE_TTL_MS) return { rates: usdCache.rates, live: true };

  try {
    const res = await fetch(ratesUrl("usd"), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Rate feed returned ${res.status}`);
    const data = (await res.json()) as { usd: Record<string, number> };
    usdCache = { rates: data.usd, fetchedAt: Date.now() };
    return { rates: usdCache.rates, live: true };
  } catch {
    // Feed unreachable — prefer any previously-fetched rates (however
    // stale) over the hardcoded snapshot, since they're still real data.
    if (usdCache) return { rates: usdCache.rates, live: true };
    return { rates: USD_FALLBACK_RATES, live: false };
  }
}

// Returns GBP-to-<code> rates (e.g. { gbp: 1, usd: 1.35, eur: 1.16, ...}),
// using the same feed with GBP as the base currency. Same fallback cascade
// as the USD version.
export async function getGbpExchangeRates(): Promise<ExchangeRates> {
  if (gbpCache && Date.now() - gbpCache.fetchedAt < CACHE_TTL_MS) return { rates: gbpCache.rates, live: true };

  try {
    const res = await fetch(ratesUrl("gbp"), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Rate feed returned ${res.status}`);
    const data = (await res.json()) as { gbp: Record<string, number> };
    gbpCache = { rates: data.gbp, fetchedAt: Date.now() };
    return { rates: gbpCache.rates, live: true };
  } catch {
    if (gbpCache) return { rates: gbpCache.rates, live: true };
    return { rates: GBP_FALLBACK_RATES, live: false };
  }
}

// null if the amount is unset or the currency code isn't recognized in the
// rates given — never invents a rate.
function convert(amount: number | null, code: string, rates: Record<string, number>): number | null {
  if (amount === null) return null;
  const rate = rates[code.toLowerCase()];
  if (!rate) return null;
  return amount / rate;
}

// Uses USD-based rates (from getUsdExchangeRates).
export function convertToUsd(amount: number | null, code: string | null, rates: Record<string, number>): number | null {
  return convert(amount, code ?? "usd", rates);
}

// Uses GBP-based rates (from getGbpExchangeRates).
export function convertToGbp(amount: number | null, code: string | null, rates: Record<string, number>): number | null {
  return convert(amount, code ?? "gbp", rates);
}
