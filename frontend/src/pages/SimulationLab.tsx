import { useState } from "react";
import { FlaskConical, Play, Sparkles, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { SimulationInput, SimulationResult } from "../lib/types";
import { RiskGauge } from "../components/RiskGauge";
import { RiskBadge } from "../components/Badges";
import { SignalBreakdown } from "../components/SignalBreakdown";
import { Timeline } from "../components/Timeline";
import { cn } from "../lib/utils";

const DEFAULT: SimulationInput = {
  account_age_days: 365,
  points_balance: 50000,
  loyalty_tier: "Silver",
  new_device: false,
  password_changed: false,
  email_changed: false,
  phone_changed: false,
  dormant_account: false,
  guest_booking: false,
  high_value_redemption: false,
  same_property_cluster: false,
  days_between_change_and_booking: null,
};

const FRAUD_PRESET: SimulationInput = {
  account_age_days: 1800,
  points_balance: 320000,
  loyalty_tier: "Platinum",
  new_device: true,
  password_changed: true,
  email_changed: true,
  phone_changed: false,
  dormant_account: true,
  guest_booking: true,
  high_value_redemption: true,
  same_property_cluster: true,
  days_between_change_and_booking: 1,
};

const TOGGLES: { key: keyof SimulationInput; label: string }[] = [
  { key: "new_device", label: "New device?" },
  { key: "password_changed", label: "Password changed?" },
  { key: "email_changed", label: "Email changed?" },
  { key: "phone_changed", label: "Phone changed?" },
  { key: "dormant_account", label: "Dormant account?" },
  { key: "guest_booking", label: "Guest booking?" },
  { key: "high_value_redemption", label: "High-value redemption?" },
  { key: "same_property_cluster", label: "Same property cluster?" },
];

const Toggle = ({ on, onChange, testId }: { on: boolean; onChange: () => void; testId: string }) => (
  <button
    data-testid={testId}
    onClick={onChange}
    role="switch"
    aria-checked={on}
    className={cn(
      "relative w-10 h-5.5 h-6 rounded-full transition-colors duration-200 shrink-0",
      on ? "bg-gradient-to-r from-blue-500 to-violet-500" : "bg-line"
    )}
  >
    <span
      className={cn(
        "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200",
        on && "translate-x-4"
      )}
    />
  </button>
);

export default function SimulationLab() {
  const [input, setInput] = useState<SimulationInput>(DEFAULT);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  const set = (k: keyof SimulationInput, v: any) => setInput((s) => ({ ...s, [k]: v }));

  const run = async () => {
    setRunning(true);
    try {
      const r = await api.post("/simulation/run", input);
      setResult(r.data);
    } catch {
      toast.error("Simulation failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-5 max-w-[1400px]">
      {/* Scenario form */}
      <div className="card p-6 space-y-5 self-start" data-testid="simulation-form">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium tracking-tight flex items-center gap-2">
            <FlaskConical size={18} strokeWidth={1.5} className="text-violet-400" /> Scenario builder
          </h2>
        </div>

        <div className="flex gap-2">
          <button className="btn-ghost flex-1 justify-center !py-1.5 text-xs" onClick={() => { setInput(DEFAULT); setResult(null); }} data-testid="preset-normal">
            <UserCheck size={14} strokeWidth={1.5} /> Normal guest
          </button>
          <button className="btn-ghost flex-1 justify-center !py-1.5 text-xs !border-red-500/40 !text-red-400" onClick={() => setInput(FRAUD_PRESET)} data-testid="preset-fraud">
            <Sparkles size={14} strokeWidth={1.5} /> ATO fraud chain
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="meta-label block mb-1.5">Account age (days)</label>
            <input data-testid="sim-account-age" type="number" min={0} className="input-base" value={input.account_age_days}
              onChange={(e) => set("account_age_days", Number(e.target.value))} />
          </div>
          <div>
            <label className="meta-label block mb-1.5">Points balance</label>
            <input data-testid="sim-points-balance" type="number" min={0} className="input-base" value={input.points_balance}
              onChange={(e) => set("points_balance", Number(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="meta-label block mb-1.5">Loyalty tier</label>
          <select data-testid="sim-loyalty-tier" className="input-base" value={input.loyalty_tier} onChange={(e) => set("loyalty_tier", e.target.value)}>
            {["Bronze", "Silver", "Gold", "Platinum"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div className="space-y-3">
          {TOGGLES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm">{label}</span>
              <Toggle on={Boolean(input[key])} onChange={() => set(key, !input[key])} testId={`sim-toggle-${key}`} />
            </div>
          ))}
        </div>

        <div>
          <label className="meta-label block mb-1.5">Days between profile change and booking</label>
          <input
            data-testid="sim-days-between"
            type="number"
            min={0}
            className="input-base"
            placeholder="Leave blank if N/A"
            value={input.days_between_change_and_booking ?? ""}
            onChange={(e) => set("days_between_change_and_booking", e.target.value === "" ? null : Number(e.target.value))}
          />
          <p className="text-[11px] text-txt-3 mt-1">≤ 2 days triggers the 48-hour combination bonus (+20) when a profile change and a redemption signal are both present.</p>
        </div>

        <button className="btn-primary w-full justify-center !py-2.5" onClick={run} disabled={running} data-testid="run-simulation-btn">
          <Play size={15} strokeWidth={1.5} /> {running ? "Scoring…" : "Run simulation"}
        </button>
        <p className="text-[11px] text-txt-3">Calls the same backend scoring function (POST /api/risk/score engine) used by Account Detail and seed data.</p>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {!result ? (
          <div className="card p-10 grid place-items-center text-center" data-testid="simulation-empty">
            <FlaskConical size={32} strokeWidth={1.2} className="text-txt-3 mb-3" />
            <p className="text-sm text-txt-2 max-w-sm">
              Configure a scenario and run the simulation to see the risk score, signal breakdown,
              synthesized timeline and recommended action.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-6 flex flex-col items-center gap-3 fade-up" data-testid="simulation-result-gauge">
                <span className="meta-label">Simulated risk score</span>
                <RiskGauge score={result.risk_score} status={result.risk_status} />
                <RiskBadge status={result.risk_status} testId="simulation-risk-tier" />
              </div>
              <div className="card p-6 fade-up" data-testid="simulation-recommended-action">
                <span className="meta-label block mb-3">Recommended action</span>
                <p className="text-sm leading-relaxed">{result.recommended_action}</p>
                <div className="mt-4 pt-4 border-t border-line text-xs text-txt-3 space-y-1 font-mono">
                  <p>raw score: {result.raw_score} → capped {result.risk_score}</p>
                  <p>signals triggered: {result.triggered.length}</p>
                </div>
              </div>
            </div>

            <div className="card p-6 fade-up" data-testid="simulation-breakdown">
              <h3 className="text-lg font-medium tracking-tight mb-4">Per-signal breakdown</h3>
              <SignalBreakdown breakdown={result.breakdown} />
            </div>

            <div className="card p-6 fade-up" data-testid="simulation-timeline">
              <h3 className="text-lg font-medium tracking-tight mb-5">Synthesized timeline</h3>
              <Timeline events={result.timeline} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
