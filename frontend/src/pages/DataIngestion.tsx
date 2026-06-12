import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadCloud, FileDown, RotateCcw, CheckCircle2, AlertTriangle,
  Database, FileSpreadsheet, FileJson, FileText as FileTextIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { DatasetItem, SystemMode } from "../lib/types";
import { SkeletonRows, EmptyState } from "../components/Loading";
import { notifyModeChanged } from "../components/Layout";
import { cn, formatDate, formatPoints } from "../lib/utils";

const TEMPLATE_KINDS = [
  { kind: "accounts", desc: "account_id, loyalty_tier, points_balance, signals…" },
  { kind: "events", desc: "account_id, event_type, timestamp, severity…" },
  { kind: "bookings", desc: "account_id, guest_name, property_name, booking_date, lat/lng…" },
  { kind: "devices", desc: "account_id, device_id, ip_address…" },
];

const FILE_ICONS: Record<string, any> = { csv: FileTextIcon, xlsx: FileSpreadsheet, json: FileJson };

export default function DataIngestion() {
  const [mode, setMode] = useState<SystemMode | null>(null);
  const [datasets, setDatasets] = useState<DatasetItem[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastResult, setLastResult] = useState<DatasetItem | null>(null);
  const [clearing, setClearing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.get("/system/mode").then((r) => setMode(r.data));
    api.get("/datasets").then((r) => setDatasets(r.data));
  }, []);
  useEffect(load, [load]);

  const upload = async (file: File) => {
    const ok = /\.(csv|xlsx|xls|json)$/i.test(file.name);
    if (!ok) { toast.error("Unsupported file type. Upload .csv, .xlsx or .json"); return; }
    setUploading(true);
    setLastResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await api.post("/ingest/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      setLastResult(r.data);
      toast.success(`Ingested ${r.data.rows_accepted} rows from ${file.name}`);
      load();
      notifyModeChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  };

  const clearUploaded = async () => {
    setClearing(true);
    try {
      await api.delete("/ingest/clear");
      toast.success("Uploaded data removed — back to synthetic demo mode");
      setLastResult(null);
      load();
      notifyModeChanged();
    } catch {
      toast.error("Failed to clear uploaded data");
    } finally {
      setClearing(false);
    }
  };

  const downloadTemplate = async (kind: string) => {
    const r = await api.get(`/ingest/template/${kind}`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([r.data], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `loyaltyshield_${kind}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pipeline = lastResult?.summary?.pipeline;

  return (
    <div className="space-y-5 max-w-[1300px]">
      {/* Mode banner */}
      <div
        className={cn(
          "card p-5 flex flex-wrap items-center justify-between gap-3",
          mode?.mode === "uploaded" ? "border-emerald-500/30" : ""
        )}
        data-testid="ingestion-mode-banner"
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            "grid place-items-center w-10 h-10 rounded-md",
            mode?.mode === "uploaded" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"
          )}>
            <Database size={18} strokeWidth={1.5} />
          </span>
          <div>
            <div className="font-medium" data-testid="ingestion-mode-label">
              {mode?.mode === "uploaded" ? "Uploaded dataset active" : "Synthetic demo dataset active"}
            </div>
            <p className="text-xs text-txt-3 mt-0.5">
              {mode?.mode === "uploaded"
                ? `${mode.uploaded_accounts} uploaded accounts across ${mode.datasets} dataset(s) drive all dashboards, graphs and reports.`
                : "All dashboards run on the reproducible seed-42 synthetic dataset. Upload data to switch automatically."}
            </p>
          </div>
        </div>
        {mode?.mode === "uploaded" && (
          <button className="btn-ghost" onClick={clearUploaded} disabled={clearing} data-testid="clear-uploaded-btn">
            <RotateCcw size={15} strokeWidth={1.5} className={clearing ? "animate-spin" : ""} />
            {clearing ? "Clearing…" : "Remove uploads & return to demo"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Dropzone */}
        <div>
          <div
            data-testid="upload-dropzone"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !uploading && fileRef.current?.click()}
            className={cn(
              "card border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors min-h-[260px]",
              dragOver ? "border-accent bg-accent/5" : "hover:border-gray-600",
              uploading && "opacity-60 pointer-events-none"
            )}
          >
            <span className="grid place-items-center w-14 h-14 rounded-full bg-blue-500/10 text-blue-400">
              <UploadCloud size={26} strokeWidth={1.5} className={uploading ? "animate-pulse" : ""} />
            </span>
            <div className="text-center">
              <p className="font-medium">{uploading ? "Validating & running pipeline…" : "Drag & drop a dataset here"}</p>
              <p className="text-sm text-txt-3 mt-1">or click to browse · CSV, XLSX or JSON · max 20 MB</p>
              <p className="text-xs text-txt-3 mt-2">
                Column types are auto-detected (accounts / events / bookings / devices). Multi-sheet XLSX and
                multi-key JSON files ingest all sections at once.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              data-testid="upload-file-input"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </div>

          {/* Last ingest result */}
          {lastResult && (
            <div className="card p-5 mt-4 fade-up" data-testid="ingest-result-card">
              <div className="flex items-center gap-2 mb-3">
                {lastResult.rows_rejected === 0
                  ? <CheckCircle2 size={17} strokeWidth={1.5} className="text-emerald-400" />
                  : <AlertTriangle size={17} strokeWidth={1.5} className="text-amber-400" />}
                <h3 className="text-base font-medium tracking-tight">Ingestion report — {lastResult.name}</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  ["Rows total", lastResult.rows_total],
                  ["Accepted", lastResult.rows_accepted],
                  ["Rejected", lastResult.rows_rejected],
                  ["Clusters detected", pipeline?.clusters_detected ?? 0],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md border border-line p-3">
                    <div className="font-heading text-xl font-semibold">{v}</div>
                    <div className="meta-label mt-1">{k}</div>
                  </div>
                ))}
              </div>
              {pipeline && (
                <p className="text-xs text-txt-2 mt-3">
                  Pipeline: re-scored {pipeline.accounts_rescored} account(s)
                  {pipeline.stub_accounts_created > 0 && `, created ${pipeline.stub_accounts_created} stub account(s) referenced by events/bookings`}
                  {pipeline.clusters_detected > 0 && `, detected clusters: ${pipeline.cluster_ids.join(", ")}`}.
                  All dashboards now reflect the uploaded dataset.
                </p>
              )}
              {lastResult.errors.length > 0 && (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 max-h-48 overflow-y-auto" data-testid="ingest-errors">
                  <p className="text-xs font-medium text-amber-400 mb-1.5">Rejected rows ({lastResult.rows_rejected})</p>
                  <ul className="space-y-1">
                    {lastResult.errors.map((e, i) => (
                      <li key={i} className="font-mono text-[11px] text-txt-2">
                        row {e.row} ({e.kind}): {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Templates */}
        <div className="card p-5 h-fit" data-testid="templates-card">
          <h3 className="text-base font-medium tracking-tight mb-1">CSV templates</h3>
          <p className="text-xs text-txt-3 mb-4">Download a starter file for each supported data type.</p>
          <ul className="space-y-2.5">
            {TEMPLATE_KINDS.map(({ kind, desc }) => (
              <li key={kind} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium capitalize">{kind}</div>
                  <p className="font-mono text-[10px] text-txt-3 truncate">{desc}</p>
                </div>
                <button
                  className="btn-ghost !px-2.5 !py-1.5 shrink-0"
                  onClick={() => downloadTemplate(kind)}
                  data-testid={`template-${kind}-btn`}
                  title={`Download ${kind} template`}
                >
                  <FileDown size={14} strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Dataset history */}
      <div data-testid="datasets-history">
        <h3 className="text-lg font-medium tracking-tight mb-3">Upload history</h3>
        {!datasets ? (
          <SkeletonRows rows={3} />
        ) : datasets.length === 0 ? (
          <EmptyState message="No datasets uploaded yet. The app is running on synthetic demo data." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["File", "Type", "Detected kinds", "Rows", "Accepted", "Rejected", "Clusters", "Uploaded"].map((h) => (
                    <th key={h} className="meta-label text-left px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => {
                  const Icon = FILE_ICONS[d.file_type] ?? FileTextIcon;
                  return (
                    <tr key={d.id} className="border-b border-line last:border-0" data-testid={`dataset-row-${d.id}`}>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <Icon size={15} strokeWidth={1.5} className="text-txt-3" />
                          <span className="font-medium">{d.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs uppercase">{d.file_type}</td>
                      <td className="px-4 py-3 text-xs">{d.kind}</td>
                      <td className="px-4 py-3 font-mono">{formatPoints(d.rows_total)}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400">{formatPoints(d.rows_accepted)}</td>
                      <td className={cn("px-4 py-3 font-mono", d.rows_rejected > 0 ? "text-amber-400" : "text-txt-3")}>
                        {d.rows_rejected}
                      </td>
                      <td className="px-4 py-3 font-mono">{d.summary?.pipeline?.clusters_detected ?? 0}</td>
                      <td className="px-4 py-3 font-mono text-xs text-txt-3 whitespace-nowrap">{formatDate(d.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
