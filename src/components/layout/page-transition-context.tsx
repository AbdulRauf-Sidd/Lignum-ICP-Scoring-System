"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { LoaderCircle } from "lucide-react";

interface PageTransitionContextValue {
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const PageTransitionContext = React.createContext<PageTransitionContextValue | null>(null);

// Plays the dashboard-page-enter animation whenever the route actually
// changes — never on background refetches (router.refresh() doesn't touch
// pathname) and never mid-navigation.
export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = React.useState(pathname);
  const contentRef = React.useRef<HTMLDivElement>(null);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
  }

  React.useEffect(() => {
    const el = contentRef.current;
    if (el) {
      el.classList.remove("page-transition-enter");
      void el.offsetWidth;
      el.classList.add("page-transition-enter");
    }
  }, [prevPathname]);

  const value = React.useMemo<PageTransitionContextValue>(() => ({ contentRef }), []);

  return (
    <PageTransitionContext.Provider value={value}>{children}</PageTransitionContext.Provider>
  );
}

export function usePageTransition() {
  const ctx = React.useContext(PageTransitionContext);
  if (!ctx) throw new Error("usePageTransition must be used within a PageTransitionProvider");
  return ctx;
}

const OVERLAY_FADE_MS = 180;
const OVERLAY_SHOW_DELAY_MS = 120;

// Driven by watching for loading.tsx's own marker element in the DOM, rather
// than any router/transition pending flag — verified by tracing real network
// timing that useTransition's isPending resolves before the destination
// page's data has even finished downloading, so it's not trustworthy here.
// Suspense showing/hiding its fallback is the one signal that's guaranteed
// to match real content readiness.
export function PageLoadingOverlay() {
  const { contentRef } = usePageTransition();
  const [fallbackPresent, setFallbackPresent] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [prevFallbackPresent, setPrevFallbackPresent] = React.useState(false);

  React.useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const check = () => setFallbackPresent(!!root.querySelector("[data-page-loading-fallback]"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [contentRef]);

  if (fallbackPresent !== prevFallbackPresent) {
    setPrevFallbackPresent(fallbackPresent);
    if (fallbackPresent) {
      setMounted(true);
    } else {
      setVisible(false);
    }
  }

  React.useEffect(() => {
    if (!fallbackPresent) return;
    const showTimeout = setTimeout(() => setVisible(true), OVERLAY_SHOW_DELAY_MS);
    return () => clearTimeout(showTimeout);
  }, [fallbackPresent]);

  React.useEffect(() => {
    if (fallbackPresent || !mounted) return;
    const hideTimeout = setTimeout(() => setMounted(false), OVERLAY_FADE_MS);
    return () => clearTimeout(hideTimeout);
  }, [fallbackPresent, mounted]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-x-0 top-[66px] bottom-0 z-10 flex items-center justify-center bg-background transition-opacity duration-[180ms] ease-out md:left-64 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <LoaderCircle
        className="size-8 animate-spin text-primary"
        aria-label="Loading page"
        role="status"
      />
    </div>
  );
}
