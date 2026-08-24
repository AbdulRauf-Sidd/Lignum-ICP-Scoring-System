import { LoaderCircle } from "lucide-react";

// Shown instantly on every dashboard navigation while the destination
// page's live Supabase queries resolve — without this, force-dynamic pages
// leave the click feeling frozen until the round-trip finishes. A generic
// content skeleton doesn't work here since every page has a different shape
// (and several no longer have the stat-tile row this used to mimic), so a
// plain spinner that can't go stale is more honest than a fake layout.
export default function DashboardLoading() {
  return (
    <div className="flex h-[60vh] items-center justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200">
      <LoaderCircle className="size-8 animate-spin text-primary" aria-label="Loading page" role="status" />
    </div>
  );
}
