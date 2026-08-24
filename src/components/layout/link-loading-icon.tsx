"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";

export function LinkLoadingIcon() {
  const { pending } = useLinkStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setVisible(pending),
      pending ? 120 : 0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [pending]);

  return (
    <span
      className="flex size-4 shrink-0 items-center justify-center"
      aria-hidden={!pending}
      aria-label={pending ? "Loading page" : undefined}
      role={pending ? "status" : undefined}
    >
      <LoaderCircle
        className={`size-3.5 transition-all duration-200 ease-out ${
          visible ? "animate-spin scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      />
    </span>
  );
}
