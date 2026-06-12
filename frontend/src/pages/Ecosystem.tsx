import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, KeyRound, Eye, Store, Gem, Radar, Users } from "lucide-react";
import { api } from "../lib/api";
import { EcosystemResponse, EcosystemTier } from "../lib/types";
import { Loading } from "../components/Loading";
import { RiskBadge } from "../components/Badges";
import { cn } from "../lib/utils";

const TIER_STYLE: Record<number, { icon: any; color: string }> = {
  1: { icon: KeyRound, color: "#EF4444" },
  2: { icon: Eye, color: "#F59E0B" },
  3: { icon: Store, color: "#8B5CF6" },
  4: { icon: Gem, color: "#10B981" },
};

function TierCard({ tier, maxTriggers }: { tier: EcosystemTier; maxTriggers: number }) {
  const { icon: Icon, color } = TIER_STYLE[tier.tier];
  return (
    <div className="card p-6 fade-up" data-testid={`ecosystem-tier-${tier.tier}`} style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-md" style={{ background: `${color}14`, color }}>
            <Icon size={20} strokeWidth={1.5} />
          </span>
          <div>
            <div className="meta-label" style={{ color }}>Tier {tier.tier} · {tier.actor}</div>
            <h3 className="text-lg font-medium tracking-tight">{tier.name}</h3>
          </div>
        </div>
        <div className="flex gap-3 text-center">
          {[
            ["Active accounts", tier.active_accounts],
            ["Dominant here", tier.dominant_accounts],
            ["Intel notes", tier.intel_notes],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-line px-3 py-1.5">
              <div className="font-heading text-lg font-semibold leading-tight">{v}</div>
              <div className="meta-label !text-[9px]">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm text-txt-2 leading-relaxed mb-4 max-w-3xl">{tier.description}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="meta-label mb-2">Live detection signals</h4>
          <ul className="space-y-2">
            {tier.signals.map((s) => (
              <li key={s.signal} data-testid={`tier-${tier.tier}-signal-${s.signal}`}>
                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                  <span className="font-medium">{s.label} <span className="font-mono text-txt-3">+{s.weight}</span></span>
                  <span className="font-mono text-txt-3">{s.triggered_count} accounts</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.round((s.triggered_count / maxTriggers) * 100)}%`, background: color }}
                  />
                </div>
              </li>
            ))}
            {tier.signals.length === 0 && (
              <li className="text-xs text-txt-3">Detected indirectly via clustering and behavioural signals.</li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="meta-label mb-2 flex items-center gap-1.5">
            <Users size={12} strokeWidth={1.5} /> Highest-risk accounts dominated by this tier
          </h4>
          {tier.example_accounts.length === 0 ? (
            <p className="text-xs text-txt-3">No accounts currently dominated by this tier.</p>
          ) : (
            <ul className="space-y-1.5">
              {tier.example_accounts.map((a) => (
                <li key={a.account_id} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-1.5">
                  <Link to={`/accounts/${a.account_id}`} className="font-mono text-xs text-accent hover:underline">
                    {a.account_id}
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-txt-3">{a.risk_score}</span>
                    <RiskBadge status={a.risk_status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Ecosystem() {
  const [data, setData] = useState<EcosystemResponse | null>(null);

  useEffect(() => {
    api.get("/ecosystem/tiers").then((r) => setData(r.data));
  }, []);

  if (!data) return <Loading label="Mapping fraud ecosystem…" />;

  const maxTriggers = Math.max(1, ...data.tiers.flatMap((t) => t.signals.map((s) => s.triggered_count)));
  const pct = data.total_accounts ? Math.round((data.accounts_in_ecosystem / data.total_accounts) * 100) : 0;

  return (
    <div className="space-y-4 max-w-[1200px]">
      <div className="card p-5 flex flex-wrap items-center justify-between gap-4" data-testid="ecosystem-summary">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-md bg-violet-500/10 text-violet-400">
            <Radar size={18} strokeWidth={1.5} />
          </span>
          <div>
            <h2 className="text-lg font-medium tracking-tight">Four-tier loyalty fraud ecosystem</h2>
            <p className="text-xs text-txt-3 mt-0.5 max-w-2xl">
              The research model maps every detection signal to one of four criminal-actor tiers — from initial
              credential harvesting to final monetization. Counts below are live from the active dataset.
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="font-heading text-3xl font-semibold" data-testid="ecosystem-coverage">
            {data.accounts_in_ecosystem}<span className="text-base text-txt-3">/{data.total_accounts}</span>
          </div>
          <div className="meta-label">accounts showing tier activity ({pct}%)</div>
        </div>
      </div>

      <div className="space-y-1" data-testid="ecosystem-flow">
        {data.tiers.map((t, i) => (
          <div key={t.tier}>
            <TierCard tier={t} maxTriggers={maxTriggers} />
            {i < data.tiers.length - 1 && (
              <div className={cn("flex justify-center py-1.5 text-txt-3")} aria-hidden>
                <ArrowDown size={18} strokeWidth={1.5} />
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-txt-3 max-w-3xl">
        Compromised value flows downward: access brokered in Tier 1 is valued in Tier 2, resold through Tier 3
        marketplaces and cashed out in Tier 4. Disrupting any tier raises the cost of the entire chain — the
        defensive thesis of this research prototype.
      </p>
    </div>
  );
}
