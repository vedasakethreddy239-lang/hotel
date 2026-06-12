import { useEffect, useState } from "react";
import { Plus, Radar, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { ThreatIntelItem } from "../lib/types";
import { Loading, EmptyState } from "../components/Loading";
import { SeverityBadge, TierChip } from "../components/Badges";
import { eventLabels, formatDate } from "../lib/utils";

const SIGNAL_LABELS: Record<string, string> = {
  new_device: "New device",
  password_changed: "Password change",
  email_changed: "Email change",
  phone_changed: "Phone change",
  dormant_balance_check: "Dormant balance check",
  guest_booking: "Guest booking",
  high_value_redemption: "High-value redemption",
  same_property_cluster: "Same property cluster",
  redemption_within_48h: "Redemption within 48h",
  ...eventLabels,
};

const CATEGORIES = ["Fraud Pattern", "Destination Clustering", "Credential Stuffing", "Reseller Activity", "Redemption Abuse"];

export default function ThreatIntel() {
  const [items, setItems] = useState<ThreatIntelItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: CATEGORIES[0], severity: "Medium", summary: "", ecosystem_tier: 1 });
  const [filter, setFilter] = useState("");

  const load = () => api.get("/threat-intel").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    await api.post("/threat-intel", { ...form, related_signals: [] });
    toast.success("Intel note published");
    setShowForm(false);
    setForm({ title: "", category: CATEGORIES[0], severity: "Medium", summary: "", ecosystem_tier: 1 });
    load();
  };

  if (!items) return <Loading label="Loading intelligence feed…" />;

  const filtered = filter ? items.filter((i) => i.category === filter) : items;

  return (
    <div className="space-y-4 max-w-[1300px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`btn-ghost !py-1.5 ${filter === "" ? "!border-accent !text-accent" : ""}`}
            onClick={() => setFilter("")}
            data-testid="intel-filter-all"
          >
            All ({items.length})
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`btn-ghost !py-1.5 ${filter === c ? "!border-accent !text-accent" : ""}`}
              onClick={() => setFilter(filter === c ? "" : c)}
              data-testid={`intel-filter-${c.toLowerCase().replace(/ /g, "-")}`}
            >
              {c}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)} data-testid="add-intel-btn">
          <Plus size={15} strokeWidth={1.5} /> Add intel note
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No intelligence notes in this category." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="intel-feed">
          {filtered.map((n) => (
            <article key={n.id} className="card card-hover p-5 flex flex-col" data-testid={`intel-card-${n.id}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="grid place-items-center w-9 h-9 rounded-md bg-violet-500/10 text-violet-400 shrink-0">
                  <Radar size={17} strokeWidth={1.5} />
                </span>
                <SeverityBadge severity={n.severity} />
              </div>
              <h3 className="text-base font-medium tracking-tight leading-snug">{n.title}</h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="meta-label border border-line rounded px-1.5 py-0.5">{n.category}</span>
                <TierChip tier={n.ecosystem_tier} />
              </div>
              <p className="text-sm text-txt-2 leading-relaxed mt-3 flex-1">{n.summary}</p>
              {n.related_signals.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {n.related_signals.map((s) => (
                    <span key={s} className="font-mono text-[10px] uppercase tracking-wider rounded bg-blue-500/10 text-blue-400 px-1.5 py-0.5">
                      {SIGNAL_LABELS[s] ?? s}
                    </span>
                  ))}
                </div>
              )}
              <p className="font-mono text-[11px] text-txt-3 mt-3 pt-3 border-t border-line">{formatDate(n.created_at)}</p>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" data-testid="intel-modal">
          <div className="card w-full max-w-lg p-6 fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-medium">Publish Intel Note</h3>
              <button onClick={() => setShowForm(false)} className="text-txt-3 hover:text-txt-1" data-testid="intel-modal-close">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-4">
              <input data-testid="intel-form-title" className="input-base" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="grid grid-cols-3 gap-3">
                <select data-testid="intel-form-category" className="input-base" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select data-testid="intel-form-severity" className="input-base" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  {["Low", "Medium", "High", "Critical"].map((s) => <option key={s}>{s}</option>)}
                </select>
                <select data-testid="intel-form-tier" className="input-base" value={form.ecosystem_tier} onChange={(e) => setForm({ ...form, ecosystem_tier: Number(e.target.value) })}>
                  {[1, 2, 3, 4].map((t) => <option key={t} value={t}>Tier {t}</option>)}
                </select>
              </div>
              <textarea data-testid="intel-form-summary" className="input-base min-h-24" placeholder="Summary…" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
              <div className="flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary" onClick={submit} data-testid="intel-form-submit">Publish</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
