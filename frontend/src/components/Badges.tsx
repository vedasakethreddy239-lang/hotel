import { cn, riskColors, statusColors, tierLabel } from "../lib/utils";

export const RiskBadge = ({ status, testId }: { status: string; testId?: string }) => (
  <span
    data-testid={testId}
    className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", riskColors[status])}
  >
    {status}
  </span>
);

export const SeverityBadge = ({ severity, testId }: { severity: string; testId?: string }) => (
  <span
    data-testid={testId}
    className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", riskColors[severity])}
  >
    {severity}
  </span>
);

export const StatusBadge = ({ status, testId }: { status: string; testId?: string }) => (
  <span
    data-testid={testId}
    className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", statusColors[status])}
  >
    {status}
  </span>
);

export const TierChip = ({ tier }: { tier: number }) => (
  <span
    className={cn(
      "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
      tier === 0
        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
        : "border-violet-500/30 text-violet-400 bg-violet-500/5"
    )}
  >
    {tierLabel(tier)}
  </span>
);
