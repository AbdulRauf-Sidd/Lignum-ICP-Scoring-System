// Single source of truth for "which color represents this ICP" across the
// app (Target List tabs, Model config profile cards, sector/ICP badges,
// analytics charts). Colors are keyed by a hash of the ICP name rather than
// its position in any array, so the same ICP always gets the same color
// regardless of sort order, filtering, or how many profiles exist — and a
// custom ICP profile name (not in the static SECTORS list) still gets a
// stable, correct color instead of silently falling back to slot 0.
//
// The hue order below matches CATEGORICAL_LIGHT/DARK in chart-colors.ts
// (blue, orange, aqua, yellow, magenta, green, violet, red) so a component
// using getIcpColorIndex() to pick a hex color from the chart palette shows
// the same hue as a component using getIcpBadgeClass()/getIcpAvatarClass()
// for the same ICP name.

function hashIcpName(name: string): number {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i);
  }
  return Math.abs(hash);
}

const ICP_BADGE_CLASSES = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  "bg-green-500/15 text-green-700 dark:text-green-400",
  "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "bg-red-500/15 text-red-700 dark:text-red-400",
];

const ICP_AVATAR_CLASSES = [
  "bg-blue-500 text-white",
  "bg-orange-500 text-white",
  "bg-teal-500 text-white",
  "bg-amber-500 text-white",
  "bg-pink-500 text-white",
  "bg-green-600 text-white",
  "bg-violet-500 text-white",
  "bg-red-500 text-white",
];

export function getIcpColorIndex(name: string | null | undefined): number {
  if (!name) return 0;
  return hashIcpName(name) % ICP_BADGE_CLASSES.length;
}

export function getIcpBadgeClass(name: string | null | undefined): string {
  return ICP_BADGE_CLASSES[getIcpColorIndex(name)];
}

export function getIcpAvatarClass(name: string | null | undefined): string {
  return ICP_AVATAR_CLASSES[getIcpColorIndex(name)];
}
