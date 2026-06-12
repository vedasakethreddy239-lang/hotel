import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FolderPlus, CheckCheck, FileDown } from "lucide-react";
import { toast } from "sonner";
import { api, downloadPdf } from "../lib/api";
import { AccountDetailData, EventItem } from "../lib/types";
import { Loading } from "../components/Loading";
import { RiskBadge, SeverityBadge, StatusBadge } from "../components/Badges";
import { RiskGauge } from "../components/RiskGauge";
import { SignalBreakdown } from "../components/SignalBreakdown";
import { Timeline } from "../components/Timeline";
import { CaseFormModal } from "../components/CaseFormModal";
import { formatDate, formatPoints } from "../lib/utils";

export default function AccountDetail() {
  const { accountId } = useParams();
  const [account, setAccount] = useState<AccountDetailData | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [caseModal, setCaseModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get(`/accounts/${accountId}`), api.get(`/accounts/${accountId}/events`)])
      .then(([a, e]) => { setAccount(a.data); setEvents(e.data); })
      .catch(() => toast.error("Account not found"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [accountId]);

  if (loading) return <Loading label="Loading account…" />;
  if (!account) return <p className="text-sm text-red-400">Account not found.</p>;

  const topSignals = account.risk_explanation.triggered
    .filter((t) => t.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((t) => t.label);

  const caseSeverity = account.risk_status === "High" ? "High" : account.risk_status === "Medium" ? "Medium" : "Low";
  const casePrefill = {
    account_id: account.account_id,
    severity: caseSeverity,
    summary: `Account ${account.account_id} flagged with risk score ${account.risk_score}/100 (${account.risk_status}). Top contributing signals: ${topSignals.join(", ") || "none"}. Recommend reviewing event timeline and recent redemptions.`,
  };

  const markReviewed = async () => {
    await api.post(`/accounts/${account.account_id}/review`);
    toast.success("Account marked as reviewed");
    load();
  };

  const exportReport = async () => {
    setExporting(true);
    try {
      await downloadPdf(`/reports/account/${account.account_id}`, `risk_report_${account.account_id}.pdf`);
      toast.success("Risk report downloaded");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/accounts" className="inline-flex items-center gap-1.5 text-sm text-txt-2 hover:text-txt-1 transition-colors" data-testid="back-to-accounts">
          <ArrowLeft size={15} strokeWidth={1.5} /> Accounts
        </Link>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setCaseModal(true)} data-testid="create-case-btn">
            <FolderPlus size={15} strokeWidth={1.5} /> Create Case
          </button>
          <button className="btn-ghost" onClick={markReviewed} data-testid="mark-reviewed-btn">
            <CheckCheck size={15} strokeWidth={1.5} /> {account.reviewed ? "Reviewed ✓" : "Mark Reviewed"}
          </button>
          <button className="btn-ghost" onClick={exportReport} disabled={exporting} data-testid="export-report-btn">
            <FileDown size={15} strokeWidth={1.5} /> {exporting ? "Exporting…" : "Export Report"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profile */}
        <div className="card p-6" data-testid="account-profile-card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-xl font-medium font-mono">{account.account_id}</h2>
            <RiskBadge status={account.risk_status} testId="account-risk-status" />
          </div>
          <dl className="space-y-3 text-sm">
            {[
              ["Loyalty tier", account.loyalty_tier],
              ["Points balance", formatPoints(account.points_balance)],
              ["Account age", `${account.account_age_days} days`],
              ["Country", account.country],
              ["Last login region", account.last_login_region],
              ["Trusted devices", String(account.trusted_devices)],
              ["Created", formatDate(account.created_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-line pb-2.5 last:border-0">
                <dt className="text-txt-3">{k}</dt>
                <dd className="font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Gauge */}
        <div className="card p-6 flex flex-col items-center justify-center gap-4" data-testid="account-gauge-card">
          <span className="meta-label">Composite risk score</span>
          <RiskGauge score={account.risk_score} status={account.risk_status} />
          <p className="text-xs text-txt-3 text-center max-w-[260px]">{account.risk_explanation.recommended_action}</p>
        </div>

        {/* Risk explanation */}
        <div className="card p-6" data-testid="risk-explanation-panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium tracking-tight">Why this score?</h3>
            <button
              className="text-xs text-accent hover:underline"
              onClick={() => setShowAll((s) => !s)}
              data-testid="toggle-all-signals"
            >
              {showAll ? "Triggered only" : "Show all signals"}
            </button>
          </div>
          <div className="max-h-[340px] overflow-y-auto pr-1">
            <SignalBreakdown breakdown={account.risk_explanation.breakdown} showAll={showAll} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-2" data-testid="account-timeline-card">
          <h3 className="text-lg font-medium tracking-tight mb-5">Event timeline ({events.length})</h3>
          <div className="max-h-[480px] overflow-y-auto pr-1">
            <Timeline events={events} />
          </div>
        </div>

        <div className="card p-6" data-testid="related-cases-card">
          <h3 className="text-lg font-medium tracking-tight mb-4">Related cases</h3>
          {account.related_cases.length === 0 ? (
            <p className="text-sm text-txt-3">No cases linked to this account.</p>
          ) : (
            <ul className="space-y-3">
              {account.related_cases.map((c) => (
                <li key={c.case_id} className="rounded-md border border-line p-3 card-hover">
                  <Link to={`/cases/${c.case_id}`} className="font-mono text-sm text-accent hover:underline" data-testid={`related-case-${c.case_id}`}>
                    {c.case_id}
                  </Link>
                  <p className="text-xs text-txt-2 mt-1 line-clamp-2">{c.summary}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <SeverityBadge severity={c.severity} />
                    <StatusBadge status={c.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <CaseFormModal
        open={caseModal}
        prefill={casePrefill}
        onClose={() => setCaseModal(false)}
        onCreated={load}
      />
    </div>
  );
}
