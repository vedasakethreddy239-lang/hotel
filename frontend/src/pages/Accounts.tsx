import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Account, Paginated } from "../lib/types";
import { Loading, EmptyState } from "../components/Loading";
import { Pagination } from "../components/Pagination";
import { RiskBadge } from "../components/Badges";
import { formatPoints } from "../lib/utils";

type SortKey = "risk_score" | "points_balance" | "account_age_days" | "account_id" | "loyalty_tier";

const SortHeader = ({
  label, col, sortBy, order, onSort,
}: { label: string; col: SortKey; sortBy: string; order: string; onSort: (c: SortKey) => void }) => (
  <button
    data-testid={`sort-${col}`}
    onClick={() => onSort(col)}
    className="inline-flex items-center gap-1 hover:text-txt-1 transition-colors"
  >
    {label}
    {sortBy !== col ? <ArrowUpDown size={12} /> : order === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
  </button>
);

export default function Accounts() {
  const [data, setData] = useState<Paginated<Account> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>("risk_score");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/accounts", { params: { page, page_size: 20, sort_by: sortBy, order, search: search || undefined, risk_status: riskFilter || undefined } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, sortBy, order, riskFilter]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const onSort = (col: SortKey) => {
    if (sortBy === col) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setOrder("desc"); }
    setPage(1);
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await api.post("/accounts/generate");
      toast.success(`Generated account ${r.data.account_id} (risk ${r.data.risk_score})`);
      load();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4 max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search size={15} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" />
          <input
            data-testid="accounts-search"
            className="input-base !pl-9 w-64"
            placeholder="Search account ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="accounts-risk-filter"
            className="input-base w-40"
            value={riskFilter}
            onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
          >
            <option value="">All risk levels</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
          <button className="btn-primary" onClick={generate} disabled={generating} data-testid="generate-account-btn">
            <Plus size={15} strokeWidth={1.5} /> {generating ? "Generating…" : "Generate account"}
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <Loading label="Loading accounts…" />
        ) : !data || data.items.length === 0 ? (
          <EmptyState message="No accounts match your filters." />
        ) : (
          <table className="w-full text-sm" data-testid="accounts-table">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-txt-2 border-b border-line">
                <th className="px-4 py-3"><SortHeader label="Account ID" col="account_id" sortBy={sortBy} order={order} onSort={onSort} /></th>
                <th className="px-4 py-3"><SortHeader label="Tier" col="loyalty_tier" sortBy={sortBy} order={order} onSort={onSort} /></th>
                <th className="px-4 py-3"><SortHeader label="Points" col="points_balance" sortBy={sortBy} order={order} onSort={onSort} /></th>
                <th className="px-4 py-3"><SortHeader label="Age (days)" col="account_age_days" sortBy={sortBy} order={order} onSort={onSort} /></th>
                <th className="px-4 py-3">Last login region</th>
                <th className="px-4 py-3"><SortHeader label="Risk score" col="risk_score" sortBy={sortBy} order={order} onSort={onSort} /></th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.account_id} className="border-b border-line last:border-0 hover:bg-surface-2/60 transition-colors" data-testid={`account-row-${a.account_id}`}>
                  <td className="px-4 py-3 font-mono text-accent">{a.account_id}</td>
                  <td className="px-4 py-3">{a.loyalty_tier}</td>
                  <td className="px-4 py-3 font-mono">{formatPoints(a.points_balance)}</td>
                  <td className="px-4 py-3 font-mono">{a.account_age_days}</td>
                  <td className="px-4 py-3 text-txt-2">{a.last_login_region}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{a.risk_score}</span>
                      <span className="h-1.5 w-16 rounded-full bg-line overflow-hidden">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${a.risk_score}%`,
                            background: a.risk_status === "High" ? "#EF4444" : a.risk_status === "Medium" ? "#F59E0B" : "#10B981",
                          }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RiskBadge status={a.risk_status} testId={`risk-badge-${a.account_id}`} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/accounts/${a.account_id}`}
                      className="inline-flex items-center gap-1.5 text-accent hover:underline"
                      data-testid={`view-account-${a.account_id}`}
                    >
                      <Eye size={14} strokeWidth={1.5} /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.items.length > 0 && (
        <Pagination page={data.page} totalPages={data.total_pages} total={data.total} onChange={setPage} />
      )}
    </div>
  );
}
