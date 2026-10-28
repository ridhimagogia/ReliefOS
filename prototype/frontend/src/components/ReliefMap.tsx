import { useMemo, useState } from "react";
import type { Location } from "../data/mockData";

type Route = { fromId: string; toId: string };

export default function ReliefMap({
  locations,
  selectedId,
  onSelect,
  route,
  mode = "all",
}: {
  locations: Location[];
  selectedId?: string;
  onSelect?: (location: Location) => void;
  route?: Route;
  mode?: "all" | "depots" | "camps";
}) {
  const [zoom, setZoom] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const valid = locations.filter(
    (location) =>
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng) &&
      (mode === "all" || (mode === "depots" && location.type === "depot") || (mode === "camps" && location.type === "camp")),
  );
  const routePoints = useMemo(() => {
    const from = valid.find((location) => location.id === route?.fromId);
    const to = valid.find((location) => location.id === route?.toId);
    return from && to ? { from, to } : undefined;
  }, [route, valid]);

  if (!valid.length) return <div className="map-empty">No mapped locations match these filters.</div>;

  return (
    <div className="relief-map" aria-label="Interactive map of Punjab relief locations">
      <div className="map-controls">
        <button type="button" onClick={() => setZoom((value) => Math.min(1.3, value + 0.1))} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => setZoom((value) => Math.max(0.85, value - 0.1))} aria-label="Zoom out">−</button>
      </div>
      <svg viewBox="0 0 100 100" role="img" style={{ transform: `scale(${zoom})` }}>
        <path className="state-shape" d="M20 10 L40 7 48 13 60 9 70 16 79 20 82 31 90 39 86 50 92 62 81 72 79 88 63 91 53 85 42 94 31 85 18 83 16 70 8 62 14 49 9 36 18 27Z" />
        <g className="district-lines">
          <path d="M20 10L29 37L18 50L31 85M40 7L42 28L29 37L48 43L37 80M60 9L58 31L48 43L62 58L53 85M79 20L67 25L58 31L75 48L86 50M18 50L37 60L48 43M37 60L37 80L58 72L62 58M58 72L75 75L81 72" />
        </g>
        <g className="map-labels">
          <text x="24" y="25">Amritsar</text><text x="57" y="20">Gurdaspur</text><text x="68" y="38">Hoshiarpur</text>
          <text x="42" y="39">Jalandhar</text><text x="55" y="54">Ludhiana</text><text x="18" y="65">Firozpur</text>
          <text x="34" y="75">Bathinda</text><text x="53" y="74">Sangrur</text><text x="75" y="70">Patiala</text>
          <text className="region-label" x="2" y="44">PAKISTAN</text><text className="region-label" x="78" y="95">HARYANA</text>
        </g>
        {routePoints && (
          <line className="route-line" x1={routePoints.from.x} y1={routePoints.from.y} x2={routePoints.to.x} y2={routePoints.to.y} />
        )}
        {valid.map((location) => {
          const isSelected = selectedId === location.id;
          const size = location.type === "camp" ? Math.max(2.2, Math.min(4, (location.population || 250) / 180)) : 2.5;
          return (
            <g
              key={location.id}
              className={`map-marker ${location.type} ${location.urgency?.toLowerCase() || ""} ${isSelected ? "selected" : ""}`}
              onClick={() => {
                setOpenId(location.id);
                onSelect?.(location);
              }}
              role="button"
              tabIndex={0}
              aria-label={`${location.name}, ${location.district}`}
              onKeyDown={(event) => event.key === "Enter" && onSelect?.(location)}
            >
              {isSelected && <circle className="marker-ring" cx={location.x} cy={location.y} r={size + 3} />}
              {location.type === "depot" ? (
                <rect x={location.x - size / 2} y={location.y - size / 2} width={size} height={size} />
              ) : (
                <circle cx={location.x} cy={location.y} r={size / 2} />
              )}
            </g>
          );
        })}
      </svg>
      {openId && (() => {
        const location = valid.find((item) => item.id === openId);
        if (!location) return null;
        return (
          <div className="map-popup">
            <button type="button" onClick={() => setOpenId(undefined)} aria-label="Close popup">×</button>
            <strong>{location.name}</strong>
            <span>{location.district} · {location.type === "depot" ? "Depot" : "Camp"}</span>
            <span>{location.type === "camp" ? `${location.population} people · ${location.urgency}` : "Stock location"}</span>
          </div>
        );
      })()}
      <div className="map-legend">
        {mode !== "camps" && <span><i className="legend-square" /> Depot</span>}
        {mode !== "depots" && <span><i className="legend-circle" /> Camp</span>}
        {mode !== "depots" && <span><i className="legend-critical" /> Critical</span>}
        {route && <span><i className="legend-route" /> Recommended move</span>}
      </div>
    </div>
  );
}
