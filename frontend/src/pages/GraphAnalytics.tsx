import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { ClusterMeta, GraphData } from "../lib/types";
import { Loading } from "../components/Loading";
import { SeverityBadge } from "../components/Badges";
import { cn } from "../lib/utils";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });

  useEffect(() => {
    api.get("/graph/clusters").then((r) => setData(r.data));
  }, []);

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
          />
        </div>
      </div>

      <aside className="space-y-3">
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
