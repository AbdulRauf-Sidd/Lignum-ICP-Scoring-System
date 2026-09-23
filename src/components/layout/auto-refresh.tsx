"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 15000;

// Pages that don't need the background poll: their data doesn't change
// asynchronously in n8n the way companies/contacts/etc. do, so refreshing
// them on a timer is just wasted work. Matches the route itself and any
// nested sub-routes.
const AUTO_REFRESH_DISABLED_PATHS = ["/admin/users", "/usage", "/analytics", "/accounts"];

function isAutoRefreshDisabled(pathname: string) {
  return AUTO_REFRESH_DISABLED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// Re-fetches server data on an interval so companies/contacts/etc. that
// change asynchronously in n8n (not as a direct result of a click here)
// show up without the user having to hit refresh. Pauses while the tab is
// hidden, and refreshes immediately on return so it never shows stale data
// after switching back. Skipped entirely on routes listed above.
export function AutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const disabled = isAutoRefreshDisabled(pathname);

  React.useEffect(() => {
    if (disabled) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (interval) return;
      interval = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    }

    function stop() {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, disabled]);

  return null;
}
