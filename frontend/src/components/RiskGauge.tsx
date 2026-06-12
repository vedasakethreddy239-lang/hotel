import { riskHex } from "../lib/utils";

export const RiskGauge = ({ score, status, size = 160 }: { score: number; status: string; size?: number }) => {
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const color = riskHex[status] ?? "#3B82F6";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} data-testid="risk-gauge">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.5s ease-out", filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-heading text-4xl font-semibold" style={{ color }} data-testid="risk-gauge-score">
          {score}
        </div>
        <div className="meta-label">/ 100</div>
      </div>
    </div>
  );
};
