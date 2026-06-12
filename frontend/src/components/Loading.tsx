import { Inbox } from "lucide-react";

/** Skeleton shimmer loading state — consistent across all pages. */
export const Loading = ({ label = "Loading…" }: { label?: string }) => (
  <div className="space-y-4 max-w-[1500px]" data-testid="loading-state" aria-label={label} role="status">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="skeleton h-3 w-2/3" />
          <div className="skeleton h-8 w-1/3" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-3 w-1/2" />
          <div className="skeleton h-40 w-full" />
        </div>
      ))}
    </div>
    <span className="sr-only">{label}</span>
  </div>
);

/** Compact skeleton for tables / lists. */
export const SkeletonRows = ({ rows = 6 }: { rows?: number }) => (
  <div className="card p-5 space-y-3" data-testid="loading-state">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-4 flex-1" />
        <div className="skeleton h-4 w-16" />
      </div>
    ))}
  </div>
);

export const EmptyState = ({ message = "No data found." }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-16 text-txt-3" data-testid="empty-state">
    <Inbox size={28} strokeWidth={1.2} />
    <span className="text-sm">{message}</span>
  </div>
);
