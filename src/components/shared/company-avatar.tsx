"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const AVATAR_STYLES = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hashIndex(key: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % mod;
}

const SIZE_CLASSES = {
  8: { box: "size-8", text: "text-xs" },
  9: { box: "size-9", text: "text-sm" },
  10: { box: "size-10", text: "text-sm" },
  12: { box: "size-12", text: "text-base" },
} as const;

export function CompanyAvatar({
  id,
  name,
  domain,
  size = 8,
}: {
  id: string;
  name: string;
  domain?: string | null;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const [logoOk, setLogoOk] = React.useState(true);
  const style = AVATAR_STYLES[hashIndex(id, AVATAR_STYLES.length)];
  const { box, text } = SIZE_CLASSES[size];

  // Google's favicon service is keyed by domain and indexes almost any
  // crawled site (unlike Clearbit's logo API, which only covers well-known
  // brands and silently fails for smaller B2B domains). It returns a
  // generic ~16px globe icon rather than an error for domains it has no
  // real favicon for, so the onLoad size check below is what actually
  // triggers the fallback in that case, not onError alone.
  if (domain && logoOk) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny third-party logo, not an LCP candidate; next/image would need a remotePattern for a decorative small avatar with a fallback already in place
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
        alt=""
        className={cn(box, "shrink-0 rounded-md border bg-white object-contain p-1")}
        onError={() => setLogoOk(false)}
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth <= 16) setLogoOk(false);
        }}
      />
    );
  }

  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-md font-bold", box, text, style)}>
      {initials(name)}
    </span>
  );
}
