"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 5000;

// Re-fetches server data on an interval so companies/contacts/etc. that
// change asynchronously in n8n (not as a direct result of a click here)
// show up without the user having to hit refresh. Pauses while the tab is
// hidden, and refreshes immediately on return so it never shows stale data
// after switching back.
export function AutoRefresh() {
  const router = useRouter();

  React.useEffect(() => {
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
  }, [router]);

  return null;
}
