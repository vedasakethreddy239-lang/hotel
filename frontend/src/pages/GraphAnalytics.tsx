import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Link, useSearchParams } from "react-router-dom";
import { X, ExternalLink, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { ClusterMeta, EntityDetail, GraphData } from "../lib/types";
import { Loading } from "../components/Loading";
import { RiskBadge, SeverityBadge, StatusBadge } from "../components/Badges";
import { cn, eventLabels, formatPoints } from "../lib/utils";

const NODE_COLORS: Record<string, string> = {
  account: "#3B82F6",
  device: "#9CA3AF",
  ip: "#8B5CF6",
  guest: "#F59E0B",
  property: "#10B981",
  date: "#EC4899",
};

const CLUSTER_TYPE_LABELS: Record<string, string> = {
  shared_device: "Shared device",
  shared_guest: "Shared guest",
  same_property_dates: "Same property / dates",
  shared_ip: "Shared IP ring",
};

export default function GraphAnalytics() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selected, setSelected] = useState<ClusterMeta | null>(null);
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [params] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });

  const openEntity = (id: string, type: string) => {
    setEntityLoading(true);
    api.get("/graph/entity", { params: { node_id: id, node_type: type } })
      .then((r) => setEntity(r.data))
      .catch(() => setEntity(null))
      .finally(() => setEntityLoading(false));
  };

  useEffect(() => {
    api.get("/graph/clusters").then((r) => {
      setData(r.data);
      const focus = params.get("focus");
      if (focus) {
        const node = r.data.nodes.find((n: any) => n.id === focus || n.label === focus.replace(/^guest:/, ""));
        if (node) openEntity(node.id, node.type);
      }
    });
  }, [params]);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setSize({ w: containerRef.current.offsetWidth, h: Math.max(480, window.innerHeight - 260) });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [data]);

  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.edges.map((e) => ({ ...e })),
    };
  }, [data]);

  const highlightSet = useMemo(() => {
    if (!selected || !data) return null;
    const set = new Set<string>(selected.account_ids);
    data.edges.forEach((e) => {
      const s = typeof e.source === "object" ? (e.source as any).id : e.source;
      const t = typeof e.target === "object" ? (e.target as any).id : e.target;
      if (set.has(s)) set.add(t);
      if (set.has(t)) set.add(s);
    });
    return set;
  }, [selected, data]);

  if (!data) return <Loading label="Building entity graph…" />;

  const suspiciousCount = data.nodes.filter((n) => n.suspicious).length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 max-w-[1600px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-txt-2" data-testid="graph-legend">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <span key={type} className="inline-flex items-center gap-1.5 capitalize">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} /> {type}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full ring-2 ring-red-500/60 bg-transparent" /> suspicious aura
          </span>
          <span className="ml-auto font-mono">{data.nodes.length} nodes · {data.edges.length} edges · {suspiciousCount} flagged</span>
        </div>

        <div ref={containerRef} className="card overflow-hidden" data-testid="force-graph-container">
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={size.w}
            height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            nodeLabel={(n: any) => `${n.type.toUpperCase()}: ${n.label}${n.risk_score != null ? ` · risk ${n.risk_score}` : ""}`}
            linkColor={(l: any) => {
              const dim = highlightSet && !(highlightSet.has(typeof l.source === "object" ? l.source.id : l.source) && highlightSet.has(typeof l.target === "object" ? l.target.id : l.target));
              if (dim) return "rgba(107,114,128,0.08)";
              return l.suspicious ? "rgba(239,68,68,0.45)" : "rgba(107,114,128,0.3)";
            }}
            linkWidth={(l: any) => (l.suspicious ? 1.6 : 0.8)}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const dimmed = highlightSet && !highlightSet.has(node.id);
              const color = NODE_COLORS[node.type] ?? "#6B7280";
              const r = node.type === "account" ? 6 : 4;

              if (node.suspicious && !dimmed) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
                ctx.fillStyle = "rgba(239,68,68,0.18)";
                ctx.fill();
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + 1.5, 0, 2 * Math.PI);
                ctx.strokeStyle = "rgba(239,68,68,0.7)";
                ctx.lineWidth = 1;
                ctx.stroke();
              }
              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = dimmed ? "rgba(107,114,128,0.18)" : color;
              ctx.fill();

              if (globalScale > 1.6 && !dimmed) {
                ctx.font = `${10 / globalScale * 1.4}px Inter, sans-serif`;
                ctx.textAlign = "center";
                ctx.fillStyle = "rgba(156,163,175,0.9)";
                ctx.fillText(node.label, node.x, node.y + r + 8 / globalScale * 1.4);
              }
            }}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.beginPath();
              ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            cooldownTicks={120}
            onEngineStop={() => graphRef.current?.zoomToFit(400, 60)}
            onNodeClick={(node: any) => openEntity(node.id, node.type)}
          />
        </div>
      </div>

      <aside className="space-y-3">
        {/* Investigation workspace (Phase 6) */}
        {(entity || entityLoading) && (
          <div className="card p-4 fade-up border-accent/40" data-testid="entity-workspace">
            {entityLoading ? (
              <div className="flex items-center gap-2 text-sm text-txt-2 py-4 justify-center">
                <Loader2 size={15} className="animate-spin" /> Loading entity…
              </div>
            ) : entity && (
              <>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="meta-label">{entity.node_type} · investigation workspace</div>
                    <h3 className="font-mono text-sm font-medium mt-0.5 break-all">
                      {entity.node_id.replace(/^(guest|prop|date):/, "")}
                    </h3>
                  </div>
                  <button onClick={() => setEntity(null)} className="text-txt-3 hover:text-txt-1" data-testid="entity-workspace-close">
                    <X size={16} strokeWidth={1.5} />
                  </button>
                </div>

                {entity.node_type === "account" && entity.account && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Risk {entity.account.risk_score}/100</span>
                      <RiskBadge status={entity.account.risk_status} />
                    </div>
                    <p className="font-mono text-[11px] text-txt-3">
                      {entity.account.loyalty_tier} · {formatPoints(entity.account.points_balance)} pts · {entity.account.country}
                    </p>
                    {entity.devices && entity.devices.length > 0 && (
                      <div>
                        <div className="meta-label mb-1">Devices / IPs</div>
                        {entity.devices.map((d, i) => (
                          <div key={i} className={cn("font-mono text-[11px]", d.suspicious ? "text-red-400" : "text-txt-2")}>
                            {d.device_id} · {d.ip_address}{d.suspicious ? " · flagged" : ""}
                          </div>
                        ))}
                      </div>
                    )}
                    {entity.bookings && entity.bookings.length > 0 && (
                      <div>
                        <div className="meta-label mb-1">Bookings ({entity.bookings.length})</div>
                        {entity.bookings.slice(0, 4).map((b) => (
                          <div key={b.id} className="font-mono text-[11px] text-txt-2">
                            {b.booking_date} · {b.guest_name} @ {b.property_name}{b.suspicious ? " ⚑" : ""}
                          </div>
                        ))}
                      </div>
                    )}
                    {entity.clusters && entity.clusters.length > 0 && (
                      <div>
                        <div className="meta-label mb-1">Clusters</div>
                        <div className="flex flex-wrap gap-1.5">
                          {entity.clusters.map((c) => (
                            <button key={c.cluster_id} onClick={() => setSelected(c)}
                              className="font-mono text-[10px] rounded bg-violet-500/10 text-violet-400 px-1.5 py-0.5 hover:bg-violet-500/20">
                              {c.cluster_id}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {entity.cases && entity.cases.length > 0 && (
                      <div>
                        <div className="meta-label mb-1">Cases</div>
                        {entity.cases.map((c) => (
                          <div key={c.case_id} className="flex items-center justify-between gap-2 mb-1">
                            <Link to={`/cases/${c.case_id}`} className="font-mono text-[11px] text-accent hover:underline">{c.case_id}</Link>
                            <StatusBadge status={c.status} />
                          </div>
                        ))}
                      </div>
                    )}
                    {entity.recent_events && entity.recent_events.length > 0 && (
                      <div>
                        <div className="meta-label mb-1">Recent events</div>
                        {entity.recent_events.slice(0, 4).map((e, i) => (
                          <div key={i} className="font-mono text-[11px] text-txt-2">
                            {e.timestamp.slice(0, 10)} · {eventLabels[e.event_type] ?? e.event_type}
                          </div>
                        ))}
                      </div>
                    )}
                    <Link to={`/accounts/${entity.account.account_id}`} className="btn-primary w-full justify-center !py-1.5"
                      data-testid="entity-open-account">
                      <ExternalLink size={13} strokeWidth={1.5} /> Open full account view
                    </Link>
                  </div>
                )}

                {entity.node_type !== "account" && (
                  <div className="space-y-3">
                    {entity.suspicious != null && (
                      <p className={cn("text-xs", entity.suspicious ? "text-red-400" : "text-txt-3")}>
                        {entity.suspicious ? "⚑ Flagged by cluster detection" : "No suspicious linkage detected"}
                      </p>
                    )}
                    {entity.linked_accounts && (
                      <div>
                        <div className="meta-label mb-1">Linked accounts ({entity.linked_accounts.length})</div>
                        {entity.linked_accounts.map((a) => (
                          <div key={a.account_id} className="flex items-center justify-between gap-2 mb-1">
                            <Link to={`/accounts/${a.account_id}`} className="font-mono text-[11px] text-accent hover:underline">
                              {a.account_id}
                            </Link>
                            <span className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-txt-3">{a.risk_score}</span>
                              <RiskBadge status={a.risk_status} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {entity.bookings && entity.bookings.length > 0 && (
                      <div>
                        <div className="meta-label mb-1">Bookings ({entity.bookings.length})</div>
                        {entity.bookings.slice(0, 5).map((b) => (
                          <div key={b.id} className="font-mono text-[11px] text-txt-2">
                            {b.booking_date} · {b.account_id} · {formatPoints(b.points_used)} pts{b.suspicious ? " ⚑" : ""}
                          </div>
                        ))}
                      </div>
                    )}
                    {entity.node_type === "property" && (
                      <Link to={`/properties?focus=${encodeURIComponent(entity.node_id.replace(/^prop:/, ""))}`}
                        className="btn-primary w-full justify-center !py-1.5" data-testid="entity-open-property">
                        <ExternalLink size={13} strokeWidth={1.5} /> Open property dashboard
                      </Link>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <h3 className="text-lg font-medium tracking-tight">Suspicious clusters ({data.clusters.length})</h3>
        <div className="space-y-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1" data-testid="cluster-list">
          {data.clusters.map((c) => (
            <button
              key={c.cluster_id}
              data-testid={`cluster-${c.cluster_id}`}
              onClick={() => setSelected(selected?.cluster_id === c.cluster_id ? null : c)}
              className={cn(
                "card card-hover w-full text-left p-4",
                selected?.cluster_id === c.cluster_id && "border-accent bg-accent/5"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-xs text-violet-400">{c.cluster_id}</span>
                <SeverityBadge severity={c.severity} />
              </div>
              <div className="text-sm font-medium mb-1">{CLUSTER_TYPE_LABELS[c.cluster_type] ?? c.cluster_type}</div>
              <p className="text-xs text-txt-3 leading-relaxed">{c.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {c.account_ids.map((aid) => (
                  <Link
                    key={aid}
                    to={`/accounts/${aid}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-[11px] text-accent hover:underline"
                  >
                    {aid}
                  </Link>
                ))}
              </div>
            </button>
          ))}
        </div>
        {selected && (
          <button className="btn-ghost w-full justify-center" onClick={() => setSelected(null)} data-testid="clear-cluster-highlight">
            Clear highlight
          </button>
        )}
      </aside>
    </div>
  );
}
