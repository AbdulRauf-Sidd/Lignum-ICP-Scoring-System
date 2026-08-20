import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly on every dashboard navigation while the destination
// page's live Supabase queries resolve — without this, force-dynamic pages
// leave the click feeling frozen until the round-trip finishes.
export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-96" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64 rounded-lg" />
    </div>
  );
}
