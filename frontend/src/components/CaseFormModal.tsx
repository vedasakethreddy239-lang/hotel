import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { CaseItem } from "../lib/types";

const ANALYSTS = ["A. Chen", "M. Okafor", "S. Petrova", "D. Ramirez", "K. Tanaka", "Unassigned"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

export interface CasePrefill {
  account_id?: string;
  severity?: string;
  summary?: string;
}

export const CaseFormModal = ({
  open,
  prefill,
  onClose,
  onCreated,
}: {
  open: boolean;
  prefill?: CasePrefill;
  onClose: () => void;
  onCreated?: (c: CaseItem) => void;
}) => {
  const [accountId, setAccountId] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [analyst, setAnalyst] = useState("Unassigned");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAccountId(prefill?.account_id ?? "");
      setSeverity(prefill?.severity ?? "Medium");
      setSummary(prefill?.summary ?? "");
      setAnalyst("Unassigned");
    }
  }, [open, prefill]);

  if (!open) return null;

  const submit = async () => {
    if (!accountId.trim()) {
      toast.error("Account ID is required");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/cases", {
        account_id: accountId.trim(),
        severity,
        assigned_analyst: analyst,
        summary,
      });
      toast.success(`Case ${res.data.case_id} created`);
      onCreated?.(res.data);
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Failed to create case");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" data-testid="case-modal">
      <div className="card w-full max-w-lg p-6 fade-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-medium">Create Investigation Case</h3>
          <button onClick={onClose} className="text-txt-3 hover:text-txt-1 transition-colors" data-testid="case-modal-close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="meta-label block mb-1.5">Account ID</label>
            <input
              data-testid="case-form-account-id"
              className="input-base"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="LTY-10001"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="meta-label block mb-1.5">Severity</label>
              <select
                data-testid="case-form-severity"
                className="input-base"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="meta-label block mb-1.5">Assigned analyst</label>
              <select
                data-testid="case-form-analyst"
                className="input-base"
                value={analyst}
                onChange={(e) => setAnalyst(e.target.value)}
              >
                {ANALYSTS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="meta-label block mb-1.5">Summary</label>
            <textarea
              data-testid="case-form-summary"
              className="input-base min-h-28"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Describe the suspicious activity…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={onClose} data-testid="case-form-cancel">Cancel</button>
            <button className="btn-primary" onClick={submit} disabled={saving} data-testid="case-form-submit">
              {saving ? "Creating…" : "Create Case"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
