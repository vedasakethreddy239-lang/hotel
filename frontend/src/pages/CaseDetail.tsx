import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Save, ShieldX, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { CaseDetailData } from "../lib/types";
import { Loading } from "../components/Loading";
import { RiskBadge, SeverityBadge, StatusBadge } from "../components/Badges";
import { Timeline } from "../components/Timeline";
import { formatDate, formatPoints } from "../lib/utils";

const STATUSES = ["New", "Investigating", "Escalated", "Confirmed Fraud", "False Positive", "Closed"];

export default function CaseDetail() {
  const { caseId } = useParams();
  const [c, setC] = useState<CaseDetailData | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get(`/cases/${caseId}`).then((r) => { setC(r.data); setNotes(r.data.analyst_notes ?? ""); });
  useEffect(() => { load(); }, [caseId]);

  if (!c) return <Loading label="Loading case…" />;

  const patch = async (body: Record<string, string>, msg: string) => {
    setSaving(true);
    try {
      await api.patch(`/cases/${c.case_id}`, body);
      toast.success(msg);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-[1300px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/cases" className="inline-flex items-center gap-1.5 text-sm text-txt-2 hover:text-txt-1 transition-colors" data-testid="back-to-cases">
          <ArrowLeft size={15} strokeWidth={1.5} /> Cases
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost !border-red-500/40 !text-red-400 hover:!bg-red-500/10"
            onClick={() => patch({ status: "Confirmed Fraud" }, "Case marked as Confirmed Fraud")}
            disabled={saving}
            data-testid="confirm-fraud-btn"
          >
            <ShieldX size={15} strokeWidth={1.5} /> Confirm Fraud
          </button>
          <button
            className="btn-ghost !border-emerald-500/40 !text-emerald-400 hover:!bg-emerald-500/10"
            onClick={() => patch({ status: "False Positive" }, "Case marked as False Positive")}
            disabled={saving}
            data-testid="false-positive-btn"
          >
            <ShieldCheck size={15} strokeWidth={1.5} /> False Positive
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 lg:col-span-2 space-y-5" data-testid="case-summary-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-xl font-medium font-mono">{c.case_id}</h2>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={c.severity} testId="case-severity-badge" />
              <StatusBadge status={c.status} testId="case-status-badge" />
            </div>
          </div>

          <div>
            <span className="meta-label block mb-1.5">Summary</span>
            <p className="text-sm text-txt-2 leading-relaxed">{c.summary || "—"}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="meta-label block mb-1.5">Status</span>
              <select
                data-testid="case-status-select"
                className="input-base"
                value={c.status}
                onChange={(e) => patch({ status: e.target.value }, `Status → ${e.target.value}`)}
              >
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <span className="meta-label block mb-1.5">Assigned analyst</span>
              <p className="py-2">{c.assigned_analyst}</p>
            </div>
            <div>
              <span className="meta-label block mb-1.5">Created</span>
              <p className="font-mono text-xs text-txt-2">{formatDate(c.created_at)}</p>
            </div>
            <div>
              <span className="meta-label block mb-1.5">Last updated</span>
              <p className="font-mono text-xs text-txt-2">{formatDate(c.updated_at)}</p>
            </div>
          </div>

          <div>
            <span className="meta-label block mb-1.5">Recommended action</span>
            <p className="text-sm text-txt-2 leading-relaxed border border-line rounded-md p-3 bg-surface-2/50">
              {c.recommended_action || "—"}
            </p>
          </div>

          <div>
            <span className="meta-label block mb-1.5">Analyst notes</span>
            <textarea
              data-testid="case-notes-input"
              className="input-base min-h-28"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add investigation notes…"
            />
            <button
              className="btn-primary mt-2"
              onClick={() => patch({ analyst_notes: notes }, "Notes saved")}
              disabled={saving}
              data-testid="save-notes-btn"
            >
              <Save size={15} strokeWidth={1.5} /> Save notes
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {c.account && (
            <div className="card p-5" data-testid="case-linked-account">
              <span className="meta-label block mb-3">Linked account</span>
              <div className="flex items-center justify-between gap-2 mb-3">
                <Link to={`/accounts/${c.account.account_id}`} className="font-mono text-accent hover:underline">
                  {c.account.account_id}
                </Link>
                <RiskBadge status={c.account.risk_status} />
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-txt-3">Risk score</dt><dd className="font-mono font-semibold">{c.account.risk_score}/100</dd></div>
                <div className="flex justify-between"><dt className="text-txt-3">Tier</dt><dd>{c.account.loyalty_tier}</dd></div>
                <div className="flex justify-between"><dt className="text-txt-3">Points</dt><dd className="font-mono">{formatPoints(c.account.points_balance)}</dd></div>
              </dl>
            </div>
          )}
          <div className="card p-5" data-testid="case-linked-events">
            <span className="meta-label block mb-4">Linked events ({c.linked_events.length})</span>
            <div className="max-h-[440px] overflow-y-auto pr-1">
              <Timeline events={c.linked_events} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
