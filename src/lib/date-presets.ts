// Shared date-range presets for the Accounts page — used by both the
// account list's "Updated" filter and each account's metrics date range, so
// the two stay identical rather than drifting into two different preset sets.

export type DatePreset =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "last_7"
  | "last_30"
  | "last_60"
  | "last_90"
  | "all_time"
  | "custom";

export const DATE_PRESET_LABELS: [DatePreset, string][] = [
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["this_quarter", "This quarter"],
  ["last_quarter", "Last quarter"],
  ["this_year", "This year"],
  ["last_year", "Last year"],
  ["last_7", "Last 7 days"],
  ["last_30", "Last 30 days"],
  ["last_60", "Last 60 days"],
  ["last_90", "Last 90 days"],
  ["all_time", "All time"],
  ["custom", "Custom"],
];

export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Bounds are inclusive day strings (YYYY-MM-DD), or null for an open end —
// null/null means "all time", no filtering.
export function datePresetRange(preset: DatePreset, customStart: string, customEnd: string): { start: string | null; end: string | null } {
  const now = new Date();
  const today = toDateInputValue(now);
  switch (preset) {
    case "all_time":
      return { start: null, end: null };
    case "custom":
      return { start: customStart || null, end: customEnd || null };
    case "last_7":
      return { start: toDateInputValue(daysAgo(7)), end: today };
    case "last_30":
      return { start: toDateInputValue(daysAgo(30)), end: today };
    case "last_60":
      return { start: toDateInputValue(daysAgo(60)), end: today };
    case "last_90":
      return { start: toDateInputValue(daysAgo(90)), end: today };
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: toDateInputValue(start), end: toDateInputValue(end) };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toDateInputValue(start), end: toDateInputValue(end) };
    }
    case "this_quarter": {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qStartMonth, 1);
      const end = new Date(now.getFullYear(), qStartMonth + 3, 0);
      return { start: toDateInputValue(start), end: toDateInputValue(end) };
    }
    case "last_quarter": {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qStartMonth - 3, 1);
      const end = new Date(now.getFullYear(), qStartMonth, 0);
      return { start: toDateInputValue(start), end: toDateInputValue(end) };
    }
    case "this_year":
      return {
        start: toDateInputValue(new Date(now.getFullYear(), 0, 1)),
        end: toDateInputValue(new Date(now.getFullYear(), 11, 31)),
      };
    case "last_year":
      return {
        start: toDateInputValue(new Date(now.getFullYear() - 1, 0, 1)),
        end: toDateInputValue(new Date(now.getFullYear() - 1, 11, 31)),
      };
  }
}
