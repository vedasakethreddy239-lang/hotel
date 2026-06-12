import { useEffect, useState } from "react";
import { FileDown, FileText, CalendarRange, UserSearch, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { api, downloadPdf } from "../lib/api";
import { Account } from "../lib/types";

const REPORTS = [
  {
    key: "investigation",
    icon: FileText,
    title: "Investigation summary",
    desc: "Active investigations with severity, status and assigned analysts.",
    path: "/reports/summary?report_type=investigation",
    filename: "loyaltyshield_investigation_report.pdf",
  },
  {
    key: "weekly",
    icon: CalendarRange,
    title: "Weekly fraud intelligence report",
    desc: "Top high-risk accounts plus the latest threat intelligence notes.",
    path: "/reports/summary?report_type=weekly",
    filename: "loyaltyshield_weekly_report.pdf",
  },
  {
    key: "executive",
    icon: LayoutDashboard,
    title: "Executive dashboard PDF",
    desc: "Risk posture by tier and case pipeline for leadership review.",
    path: "/reports/summary?report_type=executive",
    filename: "loyaltyshield_executive_report.pdf",
  },
];

export default function Reports() {
  const [busy, setBusy] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    api
      .get("/accounts", { params: { page: 1, page_size: 50, sort_by: "risk_score", order: "desc" } })
      .then((r) => {
        setAccounts(r.data.items);
        if (r.data.items[0]) setSelected(r.data.items[0].account_id);
      });
  }, []);

  const download = async (key: string, path: string, filename: string) => {
    setBusy(key);
    try {
      await downloadPdf(path, filename);
      toast.success("Report downloaded");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 max-w-[1100px]">
      <p className="text-sm text-txt-2 max-w-2xl">
        Generate demo PDF reports (ReportLab). All content is synthetic and reproducible from the fixed seed.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORTS.map(({ key, icon: Icon, title, desc, path, filename }) => (
          <div key={key} className="card card-hover p-6 flex flex-col" data-testid={`report-card-${key}`}>
            <span className="grid place-items-center w-10 h-10 rounded-md bg-blue-500/10 text-blue-400 mb-4">
              <Icon size={20} strokeWidth={1.5} />
            </span>
            <h3 className="text-lg font-medium tracking-tight mb-1.5">{title}</h3>
            <p className="text-sm text-txt-2 leading-relaxed flex-1">{desc}</p>
            <button
              className="btn-primary mt-5 justify-center"
              onClick={() => download(key, path, filename)}
              disabled={busy === key}
              data-testid={`download-${key}-btn`}
            >
              <FileDown size={15} strokeWidth={1.5} /> {busy === key ? "Generating…" : "Download PDF"}
            </button>
          </div>
        ))}
      </div>

      <div className="card p-6" data-testid="report-card-account">
        <div className="flex items-start gap-4 flex-wrap">
          <span className="grid place-items-center w-10 h-10 rounded-md bg-violet-500/10 text-violet-400 shrink-0">
            <UserSearch size={20} strokeWidth={1.5} />
          </span>
          <div className="flex-1 min-w-[240px]">
            <h3 className="text-lg font-medium tracking-tight mb-1.5">Account risk report</h3>
            <p className="text-sm text-txt-2">Full risk breakdown, ecosystem-tier mapping and event timeline for a single account.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              data-testid="account-report-select"
              className="input-base sm:w-64"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.account_id} value={a.account_id}>
                  {a.account_id} · risk {a.risk_score} ({a.risk_status})
                </option>
              ))}
            </select>
            <button
              className="btn-primary shrink-0"
              disabled={!selected || busy === "account"}
              onClick={() => download("account", `/reports/account/${selected}`, `risk_report_${selected}.pdf`)}
              data-testid="download-account-report-btn"
            >
              <FileDown size={15} strokeWidth={1.5} /> {busy === "account" ? "Generating…" : "Download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
