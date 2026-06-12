import { Loader2, Inbox } from "lucide-react";

export const Loading = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-txt-2" data-testid="loading-state">
    <Loader2 size={18} className="animate-spin" strokeWidth={1.5} />
    <span className="text-sm">{label}</span>
  </div>
);

export const EmptyState = ({ message = "No data found." }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-16 text-txt-3" data-testid="empty-state">
    <Inbox size={28} strokeWidth={1.2} />
    <span className="text-sm">{message}</span>
  </div>
);
