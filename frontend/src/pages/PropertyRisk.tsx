import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, Flame, MapPin, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { PropertyRiskItem, PropertyRiskResponse } from "../lib/types";
import { Loading } from "../components/Loading";
import { RiskBadge, SeverityBadge } from "../components/Badges";
import { cn, formatPoints } from "../lib/utils";

const riskColor = (idx: number) => (idx >= 60 ? "#EF4444" : idx >= 30 ? "#F59E0B" : "#10B981");

/** Heatmap overlay built from suspicious-points weights (leaflet.heat). */
function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    let layer: any;
    let cancelled = false;
    (window as any).L = L;
    import("leaflet.heat").then(() => {
      if (cancelled || points.length === 0) return;
      layer = (L as any).heatLayer(points, {
        radius: 45, blur: 30, maxZoom: 8, max: 1,
        gradient: { 0.2: "#3B82F6", 0.5: "#F59E0B", 0.8: "#EF4444" },
      }).addTo(map);
    });
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, points]);
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 6, { duration: 0.8 });
  }, [map, target]);
  return null;
}

export default function PropertyRisk() {
  const [data, setData] = useState<PropertyRiskResponse | null>(null);
  const [selected, setSelected] = useState<PropertyRiskItem | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [params] = useSearchParams();

  useEffect(() => {
    api.get("/properties/risk").then((r) => {
      setData(r.data);
      const focus = params.get("focus");
      if (focus) {
        const p = r.data.properties.find((x: PropertyRiskItem) => x.name === focus);
        if (p) setSelected(p);
      }
    });
  }, [params]);

  const heatPoints = useMemo<[number, number, number][]>(() => {
    if (!data) return [];
    const maxSus = Math.max(1, ...data.properties.map((p) => p.suspicious_points));
    return data.properties
      .filter((p) => p.latitude != null && p.suspicious_points > 0)
      .map((p) => [p.latitude!, p.longitude!, Math.max(0.15, p.suspicious_points / maxSus)]);
  }, [data]);

  if (!data) return <Loading label="Loading property risk…" />;

  const mapped = data.properties.filter((p) => p.latitude != null);
  const flyTarget: [number, number] | null =
    selected && selected.latitude != null ? [selected.latitude, selected.longitude!] : null;

  return (
    <div className="space-y-4 max-w-[1600px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-txt-2">
          {data.properties.length} properties · {data.destinations.length} destinations ·{" "}
          {data.properties.reduce((s, p) => s + p.suspicious_bookings, 0)} flagged bookings in the active dataset
        </p>
        <button
          className={cn("btn-ghost !py-1.5", showHeat && "!border-accent !text-accent")}
          onClick={() => setShowHeat((s) => !s)}
          data-testid="toggle-heatmap-btn"
        >
          <Flame size={14} strokeWidth={1.5} /> Heatmap {showHeat ? "on" : "off"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div className="card overflow-hidden" data-testid="property-map" style={{ height: 520 }}>
          <MapContainer center={[22, 30]} zoom={2} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {showHeat && <HeatLayer points={heatPoints} />}
            <FlyTo target={flyTarget} />
            {mapped.map((p) => (
              <CircleMarker
                key={p.name}
                center={[p.latitude!, p.longitude!]}
                radius={Math.min(22, 7 + p.bookings * 1.2)}
                pathOptions={{
                  color: riskColor(p.risk_index),
                  fillColor: riskColor(p.risk_index),
                  fillOpacity: selected?.name === p.name ? 0.75 : 0.45,
                  weight: selected?.name === p.name ? 3 : 1.5,
                }}
                eventHandlers={{ click: () => setSelected(p) }}
              >
                <LTooltip direction="top" offset={[0, -6]}>
                  <span className="text-xs font-medium">{p.name}</span>
                  <br />
                  <span className="text-[11px]">risk index {p.risk_index} · {p.suspicious_bookings}/{p.bookings} flagged</span>
                </LTooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Side panel */}
        <aside className="space-y-3">
          {selected ? (
            <div className="card p-5 fade-up" data-testid="property-panel">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="text-lg font-medium tracking-tight leading-snug">{selected.name}</h3>
                <button onClick={() => setSelected(null)} className="text-txt-3 hover:text-txt-1" data-testid="property-panel-close">
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
              <p className="text-xs text-txt-3 mb-3 flex items-center gap-1">
                <MapPin size={12} strokeWidth={1.5} />
                {[selected.city, selected.country].filter(Boolean).join(", ") || "Location not provided"}
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  ["Risk index", `${selected.risk_index}/100`],
                  ["Bookings", String(selected.bookings)],
                  ["Flagged", String(selected.suspicious_bookings)],
                  ["Points redeemed", formatPoints(selected.points_redeemed)],
                  ["Suspicious points", formatPoints(selected.suspicious_points)],
                  ["High-risk accounts", String(selected.high_risk_accounts)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md border border-line p-2.5">
                    <div className="font-mono text-sm font-semibold">{v}</div>
                    <div className="meta-label mt-0.5 !text-[10px]">{k}</div>
                  </div>
                ))}
              </div>

              {selected.cluster_ids.length > 0 && (
                <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 mb-4 flex gap-2">
                  <AlertTriangle size={14} strokeWidth={1.5} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-txt-2">
                    Linked to coordinated cluster{selected.cluster_ids.length > 1 ? "s" : ""}:{" "}
                    <span className="font-mono text-red-400">{selected.cluster_ids.join(", ")}</span>
                  </p>
                </div>
              )}

              <h4 className="meta-label mb-2">Linked accounts ({selected.linked_accounts.length})</h4>
              <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1 mb-4">
                {selected.linked_accounts.map((a) => (
                  <li key={a.account_id} className="flex items-center justify-between gap-2">
                    <Link to={`/accounts/${a.account_id}`} className="font-mono text-xs text-accent hover:underline">
                      {a.account_id}
                    </Link>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-txt-3">{a.risk_score}</span>
                      <RiskBadge status={a.risk_status} />
                    </span>
                  </li>
                ))}
              </ul>

              <h4 className="meta-label mb-2">Recent bookings</h4>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {selected.recent_bookings.map((b) => (
                  <li key={b.id} className="rounded-md border border-line p-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium truncate">{b.guest_name}</span>
                      {b.suspicious && <SeverityBadge severity="High" />}
                    </div>
                    <div className="font-mono text-[10px] text-txt-3 mt-0.5">
                      {b.booking_date} · {formatPoints(b.points_used)} pts ·{" "}
                      <Link to={`/accounts/${b.account_id}`} className="text-accent hover:underline">{b.account_id}</Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="card p-5 text-sm text-txt-3" data-testid="property-panel-empty">
              Click a property marker or table row to open the investigation panel: linked accounts, bookings,
              clusters and risk metrics.
            </div>
          )}

          {data.unmapped.length > 0 && (
            <div className="card p-4 text-xs text-txt-3" data-testid="unmapped-note">
              <AlertTriangle size={13} strokeWidth={1.5} className="inline mr-1 text-amber-400" />
              {data.unmapped.length} propert{data.unmapped.length > 1 ? "ies" : "y"} without coordinates
              (not shown on map): {data.unmapped.join(", ")}. Include latitude/longitude columns in booking
              uploads to map them.
            </div>
          )}
        </aside>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Property table */}
        <div className="card overflow-x-auto" data-testid="property-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                {["Property", "Risk idx", "Bookings", "Flagged", "Susp. points"].map((h) => (
                  <th key={h} className="meta-label text-left px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.properties.map((p) => (
                <tr
                  key={p.name}
                  onClick={() => setSelected(p)}
                  className={cn("border-b border-line last:border-0 cursor-pointer hover:bg-surface-2 transition-colors",
                    selected?.name === p.name && "bg-accent/5")}
                  data-testid={`property-row-${p.name.replace(/ /g, "-")}`}
                >
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold" style={{ color: riskColor(p.risk_index) }}>{p.risk_index}</span>
                  </td>
                  <td className="px-4 py-3 font-mono">{p.bookings}</td>
                  <td className="px-4 py-3 font-mono">{p.suspicious_bookings}</td>
                  <td className="px-4 py-3 font-mono">{formatPoints(p.suspicious_points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Destination rollup */}
        <div className="card overflow-x-auto" data-testid="destination-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                {["Destination", "Properties", "Bookings", "Flagged", "Suspicion ratio"].map((h) => (
                  <th key={h} className="meta-label text-left px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.destinations.map((d) => (
                <tr key={d.country} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{d.country}</td>
                  <td className="px-4 py-3 font-mono">{d.properties}</td>
                  <td className="px-4 py-3 font-mono">{d.bookings}</td>
                  <td className="px-4 py-3 font-mono">{d.suspicious_bookings}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.round(d.suspicious_ratio * 100)}%`, background: riskColor(d.suspicious_ratio * 100) }}
                        />
                      </div>
                      <span className="font-mono text-xs">{Math.round(d.suspicious_ratio * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
