// Manual compact formatting rather than Intl's `notation: "compact"` — its
// trailing-zero behaviour (e.g. "$104M" vs "$104.0M") differs between Node's
// and the browser's ICU, which causes an SSR/client hydration mismatch.
export function formatUsdCompact(value: number | null): string {
  if (value === null) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${trimZero(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}$${trimZero(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}$${trimZero(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

function trimZero(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

export function formatGbp(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-GB").format(value);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatRelativeTime(iso: string): string {
  const now = new Date("2026-08-12T12:00:00Z").getTime();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.round(diffDays / 7)}w ago`;
  return formatDate(iso);
}
