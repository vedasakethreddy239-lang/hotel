import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, ShieldAlert, FolderSearch, BedDouble, Gauge as GaugeIcon,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area,
  CartesianGrid, Cell, Legend,
} from "recharts";
import { api } from "../lib/api";
import { DashboardStats } from "../lib/types";
import { Loading } from "../components/Loading";
import { SeverityBadge } from "../components/Badges";
import { eventLabels, formatDate, formatDateShort, riskHex } from "../lib/utils";

const TOOLTIP_STYLE = {
  backgroundColor: "#111823",
  border: "1px solid #1F2937",
  borderRadius: 8,
  color: "#F9FAFB",
  fontSize: 12,
};

const SEVERITY_COLORS: Record<string, string> = {
  Low: "#10B981", Medium: "#F59E0B", High: "#EF4444", Critical: "#B91C1C",
};

const StatCard = ({ icon: Icon, label, value, accent, testId }: any) => (
  <div className="card card-hover p-5 fade-up" data-testid={testId}>
    <div className="flex items-center justify-between">
      <span className="meta-label">{label}</span>
      <span className="grid place-items-center w-8 h-8 rounded-md" style={{ background: `${accent}14`, color: accent }}>
        <Icon size={16} strokeWidth={1.5} />
      </span>
    </div>
    <div className="font-heading text-3xl font-semibold mt-3">{value}</div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => setError(true));
  }, []);

  if (error) return <p className="text-sm text-red-400">Failed to load dashboard data.</p>;
  if (!stats) return <Loading label="Loading security posture…" />;

  const bucketColor = (bucket: string) => {
    const lo = parseInt(bucket.split("-")[0]);
    return lo >= 70 ? riskHex.High : lo >= 40 ? riskHex.Medium : riskHex.Low;
  };

  return (
    <div className="space-y-6 max-w-[1500px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Accounts monitored" value={stats.total_accounts} accent="#3B82F6" testId="stat-total-accounts" />
        <StatCard icon={ShieldAlert} label="High-risk accounts" value={stats.high_risk_accounts} accent="#EF4444" testId="stat-high-risk" />
        <StatCard icon={FolderSearch} label="Open investigations" value={stats.open_investigations} accent="#8B5CF6" testId="stat-open-investigations" />
        <StatCard icon={BedDouble} label="Flagged guest bookings" value={stats.flagged_guest_bookings} accent="#F59E0B" testId="stat-flagged-bookings" />
        <StatCard icon={GaugeIcon} label="Avg risk score" value={stats.average_risk_score} accent="#10B981" testId="stat-avg-risk" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5" data-testid="chart-risk-distribution">
          <h3 className="text-lg font-medium tracking-tight mb-1">Risk score distribution</h3>
          <p className="text-xs text-txt-3 mb-4">Accounts per 10-point risk bucket</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.risk_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(59,130,246,0.06)" }} />
              <Bar dataKey="count" name="Accounts" radius={[4, 4, 0, 0]}>
                {stats.risk_distribution.map((d) => (
                  <Cell key={d.bucket} fill={bucketColor(d.bucket)} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5" data-testid="chart-events-over-time">
          <h3 className="text-lg font-medium tracking-tight mb-1">Suspicious events over time</h3>
          <p className="text-xs text-txt-3 mb-4">Last 30 days (UTC)</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.events_over_time}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSus" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatDateShort} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="total" name="All events" stroke="#3B82F6" fill="url(#gTotal)" strokeWidth={2} />
              <Area type="monotone" dataKey="suspicious" name="High/Critical" stroke="#EF4444" fill="url(#gSus)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5" data-testid="chart-cases-severity">
          <h3 className="text-lg font-medium tracking-tight mb-1">Cases by severity</h3>
          <p className="text-xs text-txt-3 mb-4">All investigation cases</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.cases_by_severity} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="severity" tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(139,92,246,0.06)" }} />
              <Bar dataKey="count" name="Cases" radius={[0, 4, 4, 0]} barSize={22}>
                {stats.cases_by_severity.map((d) => (
                  <Cell key={d.severity} fill={SEVERITY_COLORS[d.severity]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5" data-testid="chart-event-types">
          <h3 className="text-lg font-medium tracking-tight mb-1">Event type frequency</h3>
          <p className="text-xs text-txt-3 mb-4">All recorded events</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.event_type_frequency} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category" dataKey="event_type" width={140}
                tick={{ fill: "#9CA3AF", fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: string) => eventLabels[v] ?? v}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(59,130,246,0.06)" }} labelFormatter={(v: string) => eventLabels[v] ?? v} />
              <Bar dataKey="count" name="Events" fill="#8B5CF6" fillOpacity={0.85} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5" data-testid="recent-events">
        <h3 className="text-lg font-medium tracking-tight mb-4">Recent suspicious events</h3>
        <ul className="divide-y divide-line">
          {stats.recent_events.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-4 py-3" data-testid={`recent-event-${i}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/accounts/${e.account_id}`} className="font-mono text-sm text-accent hover:underline">
                    {e.account_id}
                  </Link>
                  <span className="text-sm">{eventLabels[e.event_type] ?? e.event_type}</span>
                </div>
                <p className="text-xs text-txt-3 truncate mt-0.5">{e.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[11px] text-txt-3 hidden sm:inline">{formatDate(e.timestamp)}</span>
                <SeverityBadge severity={e.severity} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
