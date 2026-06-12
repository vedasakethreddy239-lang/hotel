import { useEffect, useState } from "react";
import {
  CircleDollarSign, ShieldAlert, Ban, TrendingDown, Scale, Info,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area,
  CartesianGrid, Cell,
} from "recharts";
import { api } from "../lib/api";
import { EconImpact } from "../lib/types";
import { Loading } from "../components/Loading";
import { formatPoints } from "../lib/utils";

const TOOLTIP_STYLE = {
  backgroundColor: "#111823", border: "1px solid #1F2937",
  borderRadius: 8, color: "#F9FAFB", fontSize: 12,
};

const TIER_COLORS: Record<string, string> = {
  Bronze: "#B45309", Silver: "#9CA3AF", Gold: "#F59E0B", Platinum: "#8B5CF6",
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const StatCard = ({ icon: Icon, label, value, sub, accent, testId }: any) => (
  <div className="card card-hover p-5 fade-up" data-testid={testId}>
    <div className="flex items-center justify-between">
      <span className="meta-label">{label}</span>
      <span className="grid place-items-center w-8 h-8 rounded-md" style={{ background: `${accent}14`, color: accent }}>
        <Icon size={16} strokeWidth={1.5} />
      </span>
    </div>
    <div className="font-heading text-3xl font-semibold mt-3">{value}</div>
    <p className="font-mono text-[11px] text-txt-3 mt-1">{sub}</p>
  </div>
);

export default function EconomicImpact() {
  const [data, setData] = useState<EconImpact | null>(null);
  const [pointValue, setPointValue] = useState(0.008);

  useEffect(() => {
    api.get("/economics/impact", { params: { point_value: pointValue } }).then((r) => setData(r.data));
  }, [pointValue]);

  if (!data) return <Loading label="Computing economic exposure…" />;

  return (
    <div className="space-y-5 max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-txt-2 max-w-2xl">
          Executive view of fraud exposure in the active dataset, valued at a configurable per-point rate.
        </p>
        <label className="flex items-center gap-3 card px-4 py-2" data-testid="point-value-control">
          <span className="meta-label">Point value</span>
          <input
            type="range" min={0.002} max={0.02} step={0.001} value={pointValue}
            onChange={(e) => setPointValue(Number(e.target.value))}
            className="accent-blue-500 w-32"
            data-testid="point-value-slider"
          />
          <span className="font-mono text-sm w-16 text-right">${pointValue.toFixed(3)}/pt</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShieldAlert} label="Exposure at risk" value={usd(data.usd_at_risk)}
          sub={`${formatPoints(data.points_at_risk)} pts · ${data.high_risk_accounts} high-risk accounts`}
          accent="#EF4444" testId="econ-at-risk" />
        <StatCard icon={Scale} label="Watchlist exposure" value={usd(data.usd_watchlist)}
          sub={`${formatPoints(data.points_watchlist)} pts in Medium-risk balances`}
          accent="#F59E0B" testId="econ-watchlist" />
        <StatCard icon={TrendingDown} label="Suspicious redemptions" value={usd(data.suspicious_redemption_usd)}
          sub={`${formatPoints(data.suspicious_redemption_points)} pts in flagged bookings`}
          accent="#8B5CF6" testId="econ-suspicious" />
        <StatCard icon={Ban} label="Interdicted exposure" value={usd(data.interdicted_usd)}
          sub={`${data.confirmed_fraud_accounts} confirmed-fraud accounts · ${data.open_cases} open cases`}
          accent="#10B981" testId="econ-interdicted" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5" data-testid="econ-tier-chart">
          <h3 className="text-lg font-medium tracking-tight mb-1">Exposure by loyalty tier</h3>
          <p className="text-xs text-txt-3 mb-4">USD value of High-risk balances per membership tier</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.exposure_by_tier}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="tier" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, name: string) =>
                name === "usd_at_risk" ? [usd(v), "USD at risk"] : [v, name]} />
              <Bar dataKey="usd_at_risk" name="usd_at_risk" radius={[4, 4, 0, 0]}>
                {data.exposure_by_tier.map((d) => (
                  <Cell key={d.tier} fill={TIER_COLORS[d.tier] ?? "#3B82F6"} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5" data-testid="econ-trend-chart">
          <h3 className="text-lg font-medium tracking-tight mb-1">Suspicious redemption trend</h3>
          <p className="text-xs text-txt-3 mb-4">USD exposure of flagged bookings by booking date</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.exposure_trend}>
              <defs>
                <linearGradient id="gEcon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [usd(v), "Exposure"]} />
              <Area type="monotone" dataKey="usd" stroke="#EF4444" fill="url(#gEcon)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <div className="card p-5" data-testid="econ-property-chart">
          <h3 className="text-lg font-medium tracking-tight mb-1">Top exposed properties</h3>
          <p className="text-xs text-txt-3 mb-4">Suspicious redemption value concentrated by property</p>
          <ResponsiveContainer width="100%" height={Math.max(200, data.top_exposed_properties.length * 36)}>
            <BarChart data={data.top_exposed_properties} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="property" width={150} tick={{ fill: "#9CA3AF", fontSize: 11 }}
                axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [usd(v), "Exposure"]} />
              <Bar dataKey="usd" fill="#8B5CF6" fillOpacity={0.85} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5 h-fit" data-testid="econ-methodology">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} strokeWidth={1.5} className="text-blue-400" />
            <h3 className="text-base font-medium tracking-tight">Methodology & assumptions</h3>
          </div>
          <ul className="space-y-2.5">
            {data.methodology.map((m, i) => (
              <li key={i} className="text-xs text-txt-2 leading-relaxed flex gap-2">
                <CircleDollarSign size={12} strokeWidth={1.5} className="text-txt-3 shrink-0 mt-0.5" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
