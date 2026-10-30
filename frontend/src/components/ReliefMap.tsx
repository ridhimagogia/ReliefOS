import { useEffect, useMemo, useState } from "react";
import type { Demand, Location } from "../types";

export type MoveRoute = {
  fromId: string;
  toId: string;
  km?: number;
  eta_h?: number;
  explain?: string;
  state?: string;
  item?: string;
  vehicle?: string;
};

type GeoJsonDistrict = {
  properties?: { district?: string; name?: string; state?: string };
  geometry: {
    type: string;
    coordinates: any;
  };
};

export default function ReliefMap({
  locations,
  selectedId,
  onSelect,
  route,
  mode = "all",
  demands = [],
}: {
  locations: Location[];
  selectedId?: string;
  onSelect?: (location: Location) => void;
  route?: MoveRoute;
  mode?: "all" | "depots" | "camps";
  demands?: Demand[];
}) {
  const [zoom, setZoom] = useState(1);
  const [openId, setOpenId] = useState<string>();
  const [showRouteExplanation, setShowRouteExplanation] = useState(false);
  const [geoDistricts, setGeoDistricts] = useState<GeoJsonDistrict[]>([]);

  // Maps API key from environment (if provided)
  const mapsApiKey = import.meta.env.VITE_MAPS_API_KEY || "";
  const [tileError, setTileError] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setTileError(false);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Only consider online map if an explicit API key is provided, online, and no error
  const usingOnlineTiles = Boolean(mapsApiKey && isOnline && !tileError);
  const tileUrl = mapsApiKey
    ? `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${mapsApiKey}`
    : "";

  // Load offline local basemap GeoJSON
  useEffect(() => {
    fetch("/basemap/punjab_districts.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Local basemap not found");
        return res.json();
      })
      .then((data) => {
        if (data?.features && Array.isArray(data.features)) {
          setGeoDistricts(data.features);
        }
      })
      .catch(() => {
        // Fallback to built-in SVG state shape if fetch fails
      });
  }, []);

  const minLng = 73.8;
  const maxLng = 76.9;
  const minLat = 29.8;
  const maxLat = 32.5;

  const projectToSvg = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 80 + 10;
    const y = 90 - ((lat - minLat) / (maxLat - minLat)) * 80;
    return { x, y };
  };

  const valid = useMemo(() => {
    return locations
      .filter(
        (location) =>
          Number.isFinite(location.lat) &&
          Number.isFinite(location.lng) &&
          (mode === "all" ||
            (mode === "depots" && location.type === "depot") ||
            (mode === "camps" && location.type === "camp"))
      )
      .map((loc) => {
        const { x, y } = projectToSvg(loc.lat, loc.lng);
        return { ...loc, x, y };
      });
  }, [locations, mode]);

  const routePoints = useMemo(() => {
    if (!route) return undefined;
    const from = valid.find((l) => l.id === route.fromId);
    const to = valid.find((l) => l.id === route.toId);
    return from && to ? { from, to, route } : undefined;
  }, [route, valid]);

  // Convert GeoJSON GPS coordinates safely guarding Polygon and MultiPolygon
  const geoPathData = useMemo(() => {
    if (!geoDistricts.length) return [];
    const results: { district: string; path: string }[] = [];

    for (const feature of geoDistricts) {
      const geom = feature.geometry;
      if (!geom || !geom.coordinates) continue;
      const districtName = feature.properties?.district || feature.properties?.name || "Punjab";

      if (geom.type === "Polygon") {
        const ring = geom.coordinates[0];
        if (Array.isArray(ring)) {
          const points = ring
            .filter((pt: any) => Array.isArray(pt) && pt.length >= 2)
            .map(([lng, lat]: [number, number]) => {
              const { x, y } = projectToSvg(lat, lng);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            });
          if (points.length) {
            results.push({ district: districtName, path: `M${points.join(" L")} Z` });
          }
        }
      } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates) {
          const ring = poly[0];
          if (Array.isArray(ring)) {
            const points = ring
              .filter((pt: any) => Array.isArray(pt) && pt.length >= 2)
              .map(([lng, lat]: [number, number]) => {
                const { x, y } = projectToSvg(lat, lng);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              });
            if (points.length) {
              results.push({ district: districtName, path: `M${points.join(" L")} Z` });
            }
          }
        }
      }
    }
    return results;
  }, [geoDistricts]);

  // Map demands to camp status/urgency
  const campDemandsMap = useMemo(() => {
    const map: Record<string, { maxUrgency: string; hasUnverified: boolean }> = {};
    for (const d of demands) {
      if (!d.camp_id) continue;
      const cur = map[d.camp_id] || { maxUrgency: "low", hasUnverified: false };
      if (!d.verified) cur.hasUnverified = true;
      if (d.urgency === "critical") cur.maxUrgency = "critical";
      else if (d.urgency === "high" && cur.maxUrgency !== "critical") cur.maxUrgency = "high";
      else if (d.urgency === "medium" && cur.maxUrgency !== "critical" && cur.maxUrgency !== "high") cur.maxUrgency = "medium";
      map[d.camp_id] = cur;
    }
    return map;
  }, [demands]);

  if (!valid.length) {
    return <div className="map-empty">No mapped locations match these filters.</div>;
  }

  return (
    <div className="relief-map" aria-label="Interactive map of Punjab relief locations">
      {/* Online / Offline Basemap Badge */}
      <div className={`map-mode-badge ${usingOnlineTiles ? "online" : "offline"}`}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: usingOnlineTiles ? "#16814b" : "#d97718",
          }}
        />
        {usingOnlineTiles ? "Online map" : "Offline basemap"}
      </div>

      {/* Map Zoom Controls */}
      <div className="map-controls">
        <button
          type="button"
          onClick={() => setZoom((v) => Math.min(1.4, v + 0.1))}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom((v) => Math.max(0.85, v - 0.1))}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      <svg viewBox="0 0 100 100" role="img" style={{ transform: `scale(${zoom})` }}>
        {/* Background Tile layer only if an explicit API key is provided */}
        {usingOnlineTiles && tileUrl && (
          <image
            href={tileUrl}
            x="0"
            y="0"
            width="100"
            height="100"
            preserveAspectRatio="xMidYMid slice"
            opacity="0.22"
            onError={() => setTileError(true)}
          />
        )}

        {/* Offline Vector Basemap: Local Punjab districts GeoJSON */}
        {geoPathData.length > 0 ? (
          <g className="geojson-districts">
            {geoPathData.map((d, i) => (
              <path
                key={i}
                d={d.path}
                className="state-shape"
                style={{ fill: "#ede7de", stroke: "#c3bbb0", strokeWidth: 0.4 }}
              />
            ))}
          </g>
        ) : (
          <>
            <path
              className="state-shape"
              d="M20 10 L40 7 48 13 60 9 70 16 79 20 82 31 90 39 86 50 92 62 81 72 79 88 63 91 53 85 42 94 31 85 18 83 16 70 8 62 14 49 9 36 18 27Z"
            />
            <g className="district-lines">
              <path d="M20 10L29 37L18 50L31 85M40 7L42 28L29 37L48 43L37 80M60 9L58 31L48 43L62 58L53 85M79 20L67 25L58 31L75 48L86 50M18 50L37 60L48 43M37 60L37 80L58 72L62 58M58 72L75 75L81 72" />
            </g>
          </>
        )}

        {/* District and Region Labels */}
        <g className="map-labels">
          <text x="24" y="25">Amritsar</text>
          <text x="57" y="20">Gurdaspur</text>
          <text x="68" y="38">Hoshiarpur</text>
          <text x="42" y="39">Jalandhar</text>
          <text x="55" y="54">Ludhiana</text>
          <text x="18" y="65">Firozpur</text>
          <text x="34" y="75">Bathinda</text>
          <text x="53" y="74">Sangrur</text>
          <text x="75" y="70">Patiala</text>
          <text className="region-label" x="2" y="44">PAKISTAN</text>
          <text className="region-label" x="78" y="95">HARYANA</text>
        </g>

        {/* Proposed / Approved Move Routes */}
        {routePoints && (
          <g
            style={{ cursor: "pointer" }}
            onClick={() => setShowRouteExplanation(true)}
            role="button"
            tabIndex={0}
            aria-label="View route explanation"
          >
            <line
              x1={routePoints.from.x}
              y1={routePoints.from.y}
              x2={routePoints.to.x}
              y2={routePoints.to.y}
              stroke="transparent"
              strokeWidth="5"
            />
            <line
              className="route-line"
              x1={routePoints.from.x}
              y1={routePoints.from.y}
              x2={routePoints.to.x}
              y2={routePoints.to.y}
            />
            <circle
              cx={(routePoints.from.x + routePoints.to.x) / 2}
              cy={(routePoints.from.y + routePoints.to.y) / 2}
              r="2.2"
              fill="var(--burgundy)"
              stroke="#ffffff"
              strokeWidth="0.5"
            />
            <text
              x={(routePoints.from.x + routePoints.to.x) / 2}
              y={(routePoints.from.y + routePoints.to.y) / 2 + 0.8}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="1.8"
              fontWeight="bold"
            >
              i
            </text>
          </g>
        )}

        {/* Markers: Depots & Camps */}
        {valid.map((location) => {
          const isSelected = selectedId === location.id;
          const campDemand = campDemandsMap[location.id];
          const isUnverified = location.type === "camp" && (Boolean(campDemand?.hasUnverified) || Boolean(location.unverified));
          const urgencyClass = campDemand?.maxUrgency || (location as any).urgency?.toLowerCase() || "";

          const size =
            location.type === "camp"
              ? Math.max(2.2, Math.min(4, (location.population || 250) / 180))
              : 2.6;

          return (
            <g
              key={location.id}
              className={`map-marker ${location.type} ${urgencyClass} ${
                isSelected ? "selected" : ""
              }`}
              onClick={() => {
                setOpenId(location.id);
                onSelect?.(location);
              }}
              role="button"
              tabIndex={0}
              aria-label={`${location.name}, ${location.district}`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onSelect?.(location);
                }
              }}
            >
              {/* Selected Ring */}
              {isSelected && (
                <circle
                  className="marker-ring"
                  cx={location.x}
                  cy={location.y}
                  r={size + 3}
                />
              )}

              {/* Unverified Public Report Amber Ring */}
              {isUnverified && !isSelected && (
                <circle
                  className="marker-ring unverified"
                  cx={location.x}
                  cy={location.y}
                  r={size + 2.5}
                />
              )}

              {location.type === "depot" ? (
                <rect
                  x={location.x - size / 2}
                  y={location.y - size / 2}
                  width={size}
                  height={size}
                />
              ) : (
                <circle cx={location.x} cy={location.y} r={size / 2} />
              )}
            </g>
          );
        })}
      </svg>

      {/* Marker Location Popup */}
      {openId && (() => {
        const location = valid.find((item) => item.id === openId);
        if (!location) return null;
        const campDemand = campDemandsMap[location.id];
        const isUnverified = location.type === "camp" && (Boolean(campDemand?.hasUnverified) || Boolean(location.unverified));

        return (
          <div className="map-popup">
            <button
              type="button"
              onClick={() => setOpenId(undefined)}
              aria-label="Close popup"
            >
              ×
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{location.name}</strong>
              {isUnverified && (
                <span className="verify-badge unverified" style={{ marginLeft: 6 }}>
                  ⚠ Unverified
                </span>
              )}
            </div>
            <span>
              {location.district} · {location.type === "depot" ? "Depot" : "Camp"}
            </span>
            <span>
              {location.type === "camp"
                ? `${location.population || 250} people · Urgency: ${(campDemand?.maxUrgency || "Normal").toUpperCase()}`
                : "Active Stock Depot"}
            </span>
            <small style={{ color: "var(--muted)", marginTop: 2 }}>
              Coordinates: {location.lat.toFixed(3)}° N, {location.lng.toFixed(3)}° E
            </small>
          </div>
        );
      })()}

      {/* Route "Why this match" Explanation Popup */}
      {showRouteExplanation && routePoints && (
        <div
          className="map-popup"
          style={{ maxWidth: "300px", zIndex: 10, background: "#fcfaf6" }}
        >
          <button
            type="button"
            onClick={() => setShowRouteExplanation(false)}
            aria-label="Close explanation popup"
          >
            ×
          </button>
          <b style={{ color: "var(--burgundy)", fontSize: "12px" }}>
            💡 Why this match?
          </b>
          <p style={{ margin: "4px 0 6px", fontSize: "11px", lineHeight: 1.4 }}>
            {routePoints.route.explain ||
              `${routePoints.from.name} is the optimal depot source (${routePoints.route.km || "—"} km) to ${routePoints.to.name}.`}
          </p>
          <div style={{ fontSize: "10px", color: "var(--muted)", display: "flex", gap: "10px" }}>
            <span><b>Distance:</b> {routePoints.route.km ?? "—"} km</span>
            <span><b>ETA:</b> {routePoints.route.eta_h ?? "—"} hrs</span>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="map-legend">
        {mode !== "camps" && (
          <span>
            <i className="legend-square" /> Depot
          </span>
        )}
        {mode !== "depots" && (
          <span>
            <i className="legend-circle" /> Camp
          </span>
        )}
        {mode !== "depots" && (
          <span>
            <i className="legend-critical" /> Critical
          </span>
        )}
        {mode !== "depots" && (
          <span>
            <i className="legend-unverified" /> Unverified Report
          </span>
        )}
        {route && (
          <span>
            <i className="legend-route" /> Proposed Move
          </span>
        )}
      </div>
    </div>
  );
}
