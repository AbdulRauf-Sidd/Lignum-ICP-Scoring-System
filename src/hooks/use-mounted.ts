"use client";

import * as React from "react";

function subscribe() {
  return () => {};
}

// Returns false during SSR/hydration and true once mounted on the client,
// without setState-in-effect (React 19's useSyncExternalStore avoids the
// extra render that a useEffect + setState pattern causes).
export function useMounted() {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
