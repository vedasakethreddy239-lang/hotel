import { SignalBreakdownItem } from "../lib/types";
import { cn } from "../lib/utils";
import { TierChip } from "./Badges";

export const SignalBreakdown = ({
  breakdown,
  showAll = false,
}: {
  breakdown: SignalBreakdownItem[];
  showAll?: boolean;
}) => {
  const rows = showAll ? breakdown : breakdown.filter((b) => b.triggered);
  if (rows.length === 0)
    return <p className="text-sm text-txt-2" data-testid="signal-breakdown-empty">No risk signals triggered.</p>;

  return (
    <ul className="space-y-2" data-testid="signal-breakdown">
      {rows.map((b) => (
        <li
          key={b.signal}
          data-testid={`signal-row-${b.signal}`}
          className={cn(
            "flex items-start justify-between gap-3 rounded-md border border-line px-3 py-2.5",
            !b.triggered && "opacity-40"
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{b.label}</span>
              <TierChip tier={b.ecosystem_tier} />
            </div>
            <p className="text-xs text-txt-3 mt-0.5">{b.description}</p>
          </div>
          <span
            className={cn(
              "font-mono text-sm font-semibold shrink-0",
              b.weight > 0 ? "text-red-400" : "text-emerald-400"
            )}
          >
            {b.weight > 0 ? `+${b.weight}` : b.weight}
          </span>
        </li>
      ))}
    </ul>
  );
};
