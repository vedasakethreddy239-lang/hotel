import { useEffect, useState } from "react";
import { KeyRound, Scale, Repeat, ShoppingBag, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { RiskSignalsResponse } from "../lib/types";
import { Loading } from "../components/Loading";
import { cn } from "../lib/utils";

const TIERS = [
  {
    n: 1,
    icon: KeyRound,
    actor: "Credential Compromise Specialist",
    incentive: "Sells validated account access in bulk; profits from scale, not from individual balances.",
    implication: "Harden authentication: device fingerprinting, credential-stuffing rate limits, step-up MFA on new devices and profile changes.",
  },
  {
    n: 2,
    icon: Scale,
    actor: "Account Valuation Intermediary",
    incentive: "Grades compromised accounts by points balance, elite tier and dormancy; arbitrages price between compromise and resale.",
    implication: "Monitor balance-check telemetry on dormant accounts; alert on valuation-style access without redemption.",
  },
  {
    n: 3,
    icon: Repeat,
    actor: "Reseller / Redemption Coordinator",
    incentive: "Converts points into bookings sold at a discount; coordinates guest names, properties and dates across many accounts.",
    implication: "Correlate cross-account entities (devices, guests, properties, date windows) via graph analytics; delay/verify third-party guest redemptions.",
  },
  {
    n: 4,
    icon: ShoppingBag,
    actor: "End Customer",
    incentive: "Buys heavily discounted stays, often unaware (or willfully ignorant) the booking is fraudulent.",
    implication: "Verify guest identity at check-in against account holder relationships; claw back fraudulent redemptions quickly.",
  },
];

export default function ResearchFramework() {
  const [data, setData] = useState<RiskSignalsResponse | null>(null);

  useEffect(() => {
    api.get("/risk/signals").then((r) => setData(r.data));
  }, []);

  if (!data) return <Loading label="Loading framework…" />;

  const signalsForTier = (n: number) => data.signals.filter((s) => s.tier === n);
  const protective = data.signals.filter((s) => s.tier === 0);

  return (
    <div className="space-y-6 max-w-[1300px]">
      <div className="max-w-3xl">
        <p className="meta-label mb-2">Research framework</p>
        <h2 className="font-heading text-2xl md:text-3xl font-medium tracking-tight">
          The four-tier cyber-economic ecosystem of hotel loyalty fraud
        </h2>
        <p className="text-sm md:text-base text-txt-2 mt-3 leading-relaxed">
          Hotel loyalty fraud operates as a division-of-labour economy. Each tier below lists its detection
          signals with the <em>exact weights</em> used by the live risk scoring engine — the same numbers shown
          in Account Detail and the Simulation Lab.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TIERS.map(({ n, icon: Icon, actor, incentive, implication }) => (
          <article key={n} className="card card-hover p-6" data-testid={`tier-card-${n}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="grid place-items-center w-10 h-10 rounded-md bg-violet-500/10 text-violet-400">
                <Icon size={20} strokeWidth={1.5} />
              </span>
              <div>
                <span className="font-mono text-xs text-violet-400">TIER {n}</span>
                <h3 className="text-lg font-medium tracking-tight leading-tight">{actor}</h3>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <span className="meta-label block mb-1">Economic incentive</span>
                <p className="text-txt-2 leading-relaxed">{incentive}</p>
              </div>
              <div>
                <span className="meta-label block mb-1.5">Detection signals (live engine weights)</span>
                <ul className="space-y-1.5">
                  {signalsForTier(n).map((s) => (
                    <li key={s.signal} className="flex items-center justify-between gap-2 rounded border border-line px-2.5 py-1.5" data-testid={`tier-${n}-signal-${s.signal}`}>
                      <span>{s.label}</span>
                      <span className="font-mono text-xs font-semibold text-red-400">+{s.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="meta-label block mb-1">Defensive implication</span>
                <p className="text-txt-2 leading-relaxed">{implication}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6" data-testid="protective-signals-card">
          <h3 className="text-lg font-medium tracking-tight mb-1 flex items-center gap-2">
            <ShieldCheck size={18} strokeWidth={1.5} className="text-emerald-400" /> Protective signals
          </h3>
          <p className="text-xs text-txt-3 mb-4">Negative weights reduce the composite score.</p>
          <ul className="space-y-1.5 text-sm">
            {protective.map((s) => (
              <li key={s.signal} className="flex items-center justify-between gap-2 rounded border border-line px-2.5 py-1.5">
                <span>{s.label}</span>
                <span className="font-mono text-xs font-semibold text-emerald-400">{s.weight}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-6" data-testid="scoring-formula-card">
          <h3 className="text-lg font-medium tracking-tight mb-1">Scoring formula</h3>
          <p className="text-xs text-txt-3 mb-4">Single shared function across the entire platform.</p>
          <pre className="font-mono text-xs bg-surface-2/60 border border-line rounded-md p-4 overflow-x-auto leading-relaxed">
{`risk_score = clamp( Σ triggered_signal_weights, 0, 100 )

combination bonus (+20):
  fires only when a profile-change signal AND a
  redemption signal occur within 48 hours`}
          </pre>
          <div className="flex gap-2 mt-4">
            {data.risk_tiers.map((t) => (
              <span
                key={t.name}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-center",
                  t.name === "Low" && "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
                  t.name === "Medium" && "border-amber-500/30 bg-amber-500/5 text-amber-400",
                  t.name === "High" && "border-red-500/30 bg-red-500/5 text-red-400"
                )}
              >
                <div className="text-sm font-medium">{t.name}</div>
                <div className="font-mono text-xs">{t.min}–{t.max}</div>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
