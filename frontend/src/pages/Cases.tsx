import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { api } from "../lib/api";
import { CaseItem, Paginated } from "../lib/types";
import { Loading, EmptyState } from "../components/Loading";
import { Pagination } from "../components/Pagination";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { CaseFormModal } from "../components/CaseFormModal";
import { formatDate } from "../lib/utils";

type SortKey = "created_at" | "updated_at" | "severity" | "status" | "case_id";
const STATUSES = ["New", "Investigating", "Escalated", "Confirmed Fraud", "False Positive", "Closed"];

export default function Cases() {
  const [data, setData] = useState<Paginated<CaseItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/cases", { params: { page, page_size: 20, sort_by: sortBy, order, status: statusFilter || undefined } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, sortBy, order, statusFilter]);

  const onSort = (col: SortKey) => {
    if (sortBy === col) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setOrder("desc"); }
    setPage(1);
  };

  const Sort = ({ label, col }: { label: string; col: SortKey }) => (
    <button data-testid={`sort-cases-${col}`} onClick={() => onSort(col)} className="inline-flex items-center gap-1 hover:text-txt-1 transition-colors">
      {label}
      {sortBy !== col ? <ArrowUpDown size={12} /> : order === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
    </button>
  );

  return (
    <div className="space-y-4 max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          data-testid="cases-status-filter"
          className="input-base w-48"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowModal(true)} data-testid="new-case-btn">
          <Plus size={15} strokeWidth={1.5} /> New case
        </button>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <Loading label="Loading cases…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState message="No cases match your filters." />
        ) : (
          <table className="w-full text-sm" data-testid="cases-table">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-txt-2 border-b border-line">
                <th className="px-4 py-3"><Sort label="Case ID" col="case_id" /></th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3"><Sort label="Severity" col="severity" /></th>
                <th className="px-4 py-3"><Sort label="Status" col="status" /></th>
                <th className="px-4 py-3">Analyst</th>
                <th className="px-4 py-3"><Sort label="Created" col="created_at" /></th>
                <th className="px-4 py-3"><Sort label="Updated" col="updated_at" /></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.case_id} className="border-b border-line last:border-0 hover:bg-surface-2/60 transition-colors" data-testid={`case-row-${c.case_id}`}>
                  <td className="px-4 py-3">
                    <Link to={`/cases/${c.case_id}`} className="font-mono text-accent hover:underline" data-testid={`open-case-${c.case_id}`}>
                      {c.case_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/accounts/${c.account_id}`} className="font-mono text-txt-2 hover:text-accent transition-colors">
                      {c.account_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={c.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-txt-2">{c.assigned_analyst}</td>
                  <td className="px-4 py-3 font-mono text-xs text-txt-3">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-txt-3">{formatDate(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.items.length > 0 && (
        <Pagination page={data.page} totalPages={data.total_pages} total={data.total} onChange={setPage} />
      )}

      <CaseFormModal open={showModal} onClose={() => setShowModal(false)} onCreated={load} />
    </div>
  );
}
