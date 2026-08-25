// Renders nothing visible — PageLoadingOverlay (page-transition-context.tsx)
// owns the actual loading UI, positioned independently of page content so it
// can't drift as content reflows. This marker's only job is to exist in the
// DOM for exactly as long as Suspense is showing this fallback: that's the
// one signal that's *guaranteed* to match real content readiness (unlike
// useTransition's isPending, which resolves before the destination page's
// data has even finished downloading — verified by tracing network timing).
// PageLoadingOverlay watches for this marker via MutationObserver.
export default function DashboardLoading() {
  return <div data-page-loading-fallback className="hidden" aria-hidden="true" />;
}
