// Free, no-API-key daily exchange rate feed (updated once a day, CDN-hosted,
// no signup) — https://github.com/fawazahmed0/exchange-api. Used to convert
// multi-currency placement revenue into a single USD figure on request,
// rather than ever guessing a rate ourselves.
const RATES_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const CACHE_TTL_MS = 60 * 60 * 1000; // rates only change daily — an hour keeps us well within that

// Last resort when the feed is down AND we've never fetched successfully
// (e.g. right after a server restart) — better than refusing to convert at
// all. A snapshot of real rates fetched from the feed above on 2026-09-03;
// only covers the currencies that actually appear in placement data. Update
// this if the feed has been down a while and these start looking stale.
const FALLBACK_RATES: Record<string, number> = {
  usd: 1,
  gbp: 0.7409966,
  eur: 0.86224632,
  cad: 1.38298056,
  aed: 3.6725,
  sar: 3.75,
};

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: RateCache | null = null;

export interface ExchangeRates {
  rates: Record<string, number>;
  // false only when nothing has ever been fetched successfully and we've
  // fallen back to the static snapshot above — callers can use this to be
  // honest in the UI about the rate not being live.
  live: boolean;
}

// Returns USD-to-<code> rates (e.g. { usd: 1, gbp: 0.74, cad: 1.38, ... }),
// preferring a fresh fetch, then the last known-good fetch (however stale),
// then the hardcoded fallback snapshot — never returning nothing.
export async function getUsdExchangeRates(): Promise<ExchangeRates> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return { rates: cache.rates, live: true };

  try {
    const res = await fetch(RATES_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Rate feed returned ${res.status}`);
    const data = (await res.json()) as { usd: Record<string, number> };
    cache = { rates: data.usd, fetchedAt: Date.now() };
    return { rates: cache.rates, live: true };
  } catch {
    // Feed unreachable — prefer any previously-fetched rates (however
    // stale) over the hardcoded snapshot, since they're still real data.
    if (cache) return { rates: cache.rates, live: true };
    return { rates: FALLBACK_RATES, live: false };
  }
}

// null if the currency code isn't recognized in the rates given — never invents a rate.
export function convertToUsd(amount: number, code: string | null, rates: Record<string, number>): number | null {
  const rate = rates[(code ?? "usd").toLowerCase()];
  if (!rate) return null;
  return amount / rate;
}
