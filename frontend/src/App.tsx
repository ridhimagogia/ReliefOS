import { useEffect, useMemo, useRef, useState } from "react";
import ReliefMap from "./components/ReliefMap";
import PublicReport from "./components/PublicReport";
import { api, MOCK_MODE, onToast, type ToastMessage } from "./services/api";
import type {
  AuditEntry,
  CanonicalItem,
  Demand,
  Health,
  JoinInfo,
  Location,
  Move,
  PlanOutput,
  Shortage,
  SupplyLot,
} from "./types";
import {
  getQueuedReports,
  queueReport,
  removeQueuedReport,
  replayQueue,
  seedDemoQueue,
  sendQueued,
  type QueuedReport,
} from "./offline/reportQueue";

type PageKey =
  | "dashboard"
  | "intake"
  | "review"
  | "matching"
  | "stock"
  | "needs"
  | "offline"
  | "join"
  | "public";

type Notice = { tone: "success" | "error" | "info"; text: string };

const NAV: { key: PageKey; label: string; glyph: string }[] = [
  { key: "dashboard", label: "Dashboard", glyph: "⌂" },
  { key: "intake", label: "Field Intake", glyph: "▤" },
  { key: "review", label: "Review Queue", glyph: "☷" },
  { key: "matching", label: "Matching Results", glyph: "⌘" },
  { key: "stock", label: "Stock & Depots", glyph: "◇" },
  { key: "needs", label: "Needs Board", glyph: "▥" },
  { key: "offline", label: "Offline Status", glyph: "⌁" },
];

const TITLES: Record<PageKey, string> = {
  dashboard: "Command dashboard",
  intake: "Field Report Intake",
  review: "Review Queue",
  matching: "Matching Results",
  stock: "Stock & Depots",
  needs: "Needs Board",
  offline: "Offline Status",
  join: "Connect Local Network (Join)",
  public: "Public Citizen Report",
};

export function ToastHost() {
  const [toasts, setToasts] = useState<(ToastMessage & { id: number })[]>([]);

  useEffect(() => {
    return onToast((t) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 5000);
    });
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item ${toast.tone}`}>
          <span>{toast.text}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            aria-label="Dismiss toast"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function useConnectivity() {
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [healthOk, setHealthOk] = useState(true);
  const [healthData, setHealthData] = useState<Health | null>(null);

  const checkHealth = async () => {
    try {
      const res = await api.getHealth();
      if (res.ok && res.data) {
        setHealthOk(true);
        setHealthData(res.data);
      } else {
        setHealthOk(false);
      }
    } catch {
      setHealthOk(false);
    }
  };

  useEffect(() => {
    const update = () => {
      setBrowserOnline(navigator.onLine);
      checkHealth();
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    checkHealth();
    const timer = setInterval(checkHealth, 10000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      clearInterval(timer);
    };
  }, []);

  const online = browserOnline && healthOk;
  return { online, health: healthData };
}

function useQueue() {
  const [reports, setReports] = useState<QueuedReport[]>([]);
  const refresh = async () => setReports(await getQueuedReports());
  useEffect(() => {
    seedDemoQueue().then(refresh);
    window.addEventListener("reliefos-queue", refresh);
    return () => window.removeEventListener("reliefos-queue", refresh);
  }, []);
  return { reports, refresh };
}

function Status({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const text = String(children).toLowerCase().replace(/\s+/g, "-");
  return <span className={`status ${tone || text}`}>{children}</span>;
}

function Panel({
  title,
  action,
  children,
  className = "",
  style,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={`panel ${className}`} style={style}>
      {title && (
        <div className="panel-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Kpi({
  icon,
  value,
  label,
  note,
  onClick,
}: {
  icon: string;
  value: string;
  label: string;
  note?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="kpi-icon">{icon}</span>
      <div>
        <b>{value}</b>
        <span>{label}</span>
        {note && <small>{note}</small>}
      </div>
      {onClick && <span className="kpi-arrow">›</span>}
    </>
  );
  return onClick ? (
    <button type="button" className="kpi" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="kpi">{content}</div>
  );
}

function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

function Select({
  label,
  children,
  value,
  onChange,
}: {
  label?: string;
  children: React.ReactNode;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="select-field">
      {label && <span>{label}</span>}
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

export type FilterValues = {
  district: string;
  item: string;
  urgency: string;
  status: string;
};

function FiltersBar({
  filters,
  onChange,
  districts,
  items,
  includeStatus = false,
}: {
  filters: FilterValues;
  onChange: (f: FilterValues) => void;
  districts: string[];
  items: string[];
  includeStatus?: boolean;
}) {
  return (
    <div className="filters">
      <Select
        label="District"
        value={filters.district}
        onChange={(v) => onChange({ ...filters, district: v })}
      >
        <option value="">All districts</option>
        {districts.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Select
        label="Item"
        value={filters.item}
        onChange={(v) => onChange({ ...filters, item: v })}
      >
        <option value="">All items</option>
        {items.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </Select>
      {includeStatus ? (
        <Select
          label="Status"
          value={filters.status}
          onChange={(v) => onChange({ ...filters, status: v })}
        >
          <option value="">All statuses</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </Select>
      ) : (
        <Select
          label="Urgency"
          value={filters.urgency}
          onChange={(v) => onChange({ ...filters, urgency: v })}
        >
          <option value="">All urgencies</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
      )}
    </div>
  );
}

function AppShell({
  page,
  setPage,
  online,
  health,
  queueCount,
  pendingReviewCount,
  children,
}: {
  page: PageKey;
  setPage: (page: PageKey) => void;
  online: boolean;
  health: Health | null;
  queueCount: number;
  pendingReviewCount: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Mode badge text derived strictly from /api/health
  const modeBadgeText = useMemo(() => {
    if (!health) {
      return online ? "Online · Gemini+Rules" : "Offline · Rules";
    }
    const hasGemini = health.providers?.includes("gemini");
    if (health.mode === "offline" || !online) {
      return "Offline · Rules";
    }
    return hasGemini ? "Online · Gemini+Rules" : "Online · Rules";
  }, [health, online]);

  // Show simulated ribbon only if in explicit mock mode or seeded simulation scenario
  const showSimulatedRibbon =
    MOCK_MODE || health?.scenario === "punjab_flood_sim";

  return (
    <div className="app-shell">
      <ToastHost />
      <button
        type="button"
        className="mobile-menu"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        ☰
      </button>
      <aside className={mobileOpen ? "open" : ""}>
        <div className="brand">
          Relief<span>OS</span>
          <small>Disaster Relief Coordination</small>
        </div>
        <nav aria-label="Primary navigation">
          {NAV.map((item) => (
            <button
              type="button"
              className={page === item.key ? "active" : ""}
              key={item.key}
              onClick={() => {
                setPage(item.key);
                setMobileOpen(false);
              }}
            >
              <i>{item.glyph}</i>
              {item.label}
              {item.key === "review" && pendingReviewCount > 0 && (
                <em>{pendingReviewCount}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-art">
          <div className="monument" aria-hidden="true">
            ⌂ ◇ ⌂
          </div>
          <b>ReliefOS</b>
          <span>
            Safer communities.
            <br />
            Stronger tomorrows.
          </span>
        </div>
      </aside>
      <div className="app-main">
        <header>
          <div className="crumb">
            <span>⌂</span> Operations <b>/</b> <strong>{TITLES[page]}</strong>
          </div>
          <div className="account">
            <span
              className={`dot ${online && health?.mode !== "offline" ? "online" : ""}`}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color:
                  online && health?.mode !== "offline"
                    ? "var(--green)"
                    : "var(--orange)",
                marginRight: 6,
              }}
            >
              {modeBadgeText}
            </span>
            <button type="button" onClick={() => setPage("offline")}>
              ⌘ Queued: {queueCount}
            </button>
            <span className="avatar">AJ</span>
            <span className="account-name">Aastha Jha</span>
          </div>
        </header>

        {(!online || health?.mode === "offline") && (
          <div className="offline-banner">
            Works with zero internet on a local network. Internet adds AI parsing and chat-app intake.
            {queueCount > 0 &&
              ` (${queueCount} report${queueCount > 1 ? "s" : ""} queued on this device)`}
          </div>
        )}

        {showSimulatedRibbon && (
          <div className="demo-ribbon">
            ⓘ &nbsp; SIMULATED DATA — PUNJAB FLOOD SCENARIO
          </div>
        )}

        <main>{children}</main>
      </div>
    </div>
  );
}

function Dashboard({
  go,
  online,
}: {
  go: (page: PageKey) => void;
  online: boolean;
}) {
  const [updated, setUpdated] = useState(new Date());
  const [auditList, setAuditList] = useState<AuditEntry[]>([]);
  const [demandsList, setDemandsList] = useState<Demand[]>([]);
  const [stockList, setStockList] = useState<SupplyLot[]>([]);
  const [locationsList, setLocationsList] = useState<Location[]>([]);
  const [shortagesList, setShortagesList] = useState<Shortage[]>([]);
  const [latestPlan, setLatestPlan] = useState<PlanOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Wire filters
  const [filters, setFilters] = useState<FilterValues>({
    district: "",
    item: "",
    urgency: "",
    status: "",
  });

  const loadData = async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [
        auditRes,
        demandsRes,
        stockRes,
        locationsRes,
        shortagesRes,
        planRes,
      ] = await Promise.all([
        api.getAudit(),
        api.getDemands(),
        api.getStock(),
        api.getLocations(),
        api.getShortages(),
        api.getLatestPlan(),
      ]);

      if (auditRes.ok && auditRes.data) setAuditList(auditRes.data);
      if (demandsRes.ok && demandsRes.data) setDemandsList(demandsRes.data);
      if (stockRes.ok && stockRes.data) setStockList(stockRes.data);
      if (locationsRes.ok && locationsRes.data) setLocationsList(locationsRes.data);
      if (shortagesRes.ok && shortagesRes.data) setShortagesList(shortagesRes.data);
      if (planRes.ok && planRes.data) setLatestPlan(planRes.data);

      if (!demandsRes.ok && demandsRes.status === 0 && !MOCK_MODE) {
        setErrorBanner(
          demandsRes.error || "Cannot reach ReliefOS API server. Verify backend status."
        );
      }
      setUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, 8000);
    return () => clearInterval(timer);
  }, []);

  const totalStockUnits = useMemo(() => {
    return stockList.reduce((sum, s) => sum + (s.qty || 0), 0);
  }, [stockList]);

  // Proper comparator: critical first, then needs_review, then report_count desc
  const pendingReviews = useMemo(() => {
    return demandsList
      .filter((d) => d.needs_review || !d.verified)
      .sort((a, b) => {
        if (a.urgency === "critical" && b.urgency !== "critical") return -1;
        if (b.urgency === "critical" && a.urgency !== "critical") return 1;
        if (a.needs_review && !b.needs_review) return -1;
        if (!a.needs_review && b.needs_review) return 1;
        return (b.report_count || 1) - (a.report_count || 1);
      })
      .slice(0, 4);
  }, [demandsList]);

  const criticalShortagesCount = useMemo(() => {
    return demandsList.filter((d) => d.urgency === "critical").length;
  }, [demandsList]);

  const uniqueDistricts = useMemo(() => {
    const set = new Set<string>();
    locationsList.forEach((l) => l.district && set.add(l.district));
    return Array.from(set).sort();
  }, [locationsList]);

  const uniqueItems = useMemo(() => {
    const set = new Set<string>();
    demandsList.forEach((d) => d.item && set.add(d.item));
    return Array.from(set).sort();
  }, [demandsList]);

  // Derive route for dashboard map from latest plan's top move
  const firstMoveRoute = useMemo(() => {
    if (!latestPlan || !latestPlan.recommendations.length) return undefined;
    const move = latestPlan.recommendations[0];
    const fromId = move.origin_location_id || move.stock_id;
    const toId = move.dest_location_id || move.demand_id;
    return {
      fromId,
      toId,
      km: move.km,
      eta_h: move.eta_h,
      explain: move.explain,
      item: move.item_id,
    };
  }, [latestPlan]);

  // Top 4 critical shortages from API
  const topShortages = useMemo(() => {
    return [...shortagesList]
      .sort((a, b) => (b.shortage || 0) - (a.shortage || 0))
      .slice(0, 4);
  }, [shortagesList]);

  return (
    <>
      <PageHeader
        title="Command dashboard"
        subtitle="Punjab relief operations • WhatsApp chaos in, dispatch plan out"
        actions={
          <>
            <span className="updated">
              Last updated {updated.toLocaleTimeString()} · Auto-refresh 8s
            </span>
            <button
              className="btn secondary"
              disabled={loading}
              onClick={loadData}
            >
              ↻ Refresh
            </button>
          </>
        }
      />

      {errorBanner && (
        <div
          className="notice error"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚠ {errorBanner}</span>
          <button
            type="button"
            className="btn secondary"
            style={{ height: 26, padding: "0 10px", fontSize: 11 }}
            onClick={loadData}
          >
            Retry Connection
          </button>
        </div>
      )}

      <div className="kpi-grid five">
        <Kpi
          icon="◇"
          value={totalStockUnits.toLocaleString()}
          label="Available stock"
          note={`${stockList.length} supply lots`}
          onClick={() => go("stock")}
        />
        <Kpi
          icon="♧"
          value={String(demandsList.length)}
          label="Active demands"
          note={`${demandsList.filter((d) => d.verified).length} verified`}
          onClick={() => go("needs")}
        />
        <Kpi
          icon="▤"
          value={String(
            demandsList.filter((d) => d.needs_review || !d.verified).length
          )}
          label="Pending reviews"
          note="Human check required"
          onClick={() => go("review")}
        />
        <Kpi
          icon="△"
          value={String(criticalShortagesCount)}
          label="Critical demands"
          note="Life-threatening priority"
          onClick={() => go("needs")}
        />
        <Kpi
          icon="◷"
          value={updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          label="Backend sync"
          note={online ? "Live API connected" : "Zero-internet mode"}
        />
      </div>

      <FiltersBar
        filters={filters}
        onChange={setFilters}
        districts={uniqueDistricts}
        items={uniqueItems}
      />

      <div className="dashboard-grid">
        <Panel title="Punjab: Depots and Camps" className="map-panel">
          <ReliefMap
            locations={locationsList}
            demands={demandsList}
            route={firstMoveRoute}
          />
        </Panel>

        <div className="stack">
          <Panel
            title="Pending reviews"
            action={
              <button className="link" onClick={() => go("review")}>
                View all (
                {demandsList.filter((d) => d.needs_review || !d.verified).length}
                ) →
              </button>
            }
          >
            <div className="compact-list">
              {pendingReviews.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    color: "var(--muted)",
                    textAlign: "center",
                  }}
                >
                  All demands reviewed and verified.
                </div>
              ) : (
                pendingReviews.map((report) => (
                  <button key={report.id} onClick={() => go("review")}>
                    <span>{report.urgency === "critical" ? "📌" : "▤"}</span>
                    <b>
                      {report.item || "Parsed request"}
                      {report.qty ? ` (${report.qty} ${report.unit || ""})` : ""}
                      {(report.report_count || 1) > 1 && (
                        <span
                          className="report-count-badge"
                          style={{ marginLeft: 6 }}
                        >
                          {report.report_count} reports
                        </span>
                      )}
                      <small>
                        {report.location_text || report.camp_id || "Punjab"} •{" "}
                        {report.source}
                      </small>
                    </b>
                    <Status tone={report.urgency.toLowerCase()}>
                      {report.urgency.toUpperCase()}
                    </Status>
                    <i>›</i>
                  </button>
                ))
              )}
            </div>
          </Panel>

          <Panel
            title="Critical shortages"
            action={
              <button className="link" onClick={() => go("needs")}>
                View all →
              </button>
            }
          >
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Missing quantity</th>
                  <th>Camp / District</th>
                </tr>
              </thead>
              <tbody>
                {topShortages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        textAlign: "center",
                        padding: 14,
                        color: "var(--muted)",
                      }}
                    >
                      No critical shortages recorded.
                    </td>
                  </tr>
                ) : (
                  topShortages.map((s, idx) => (
                    <tr key={idx}>
                      <td>{s.item}</td>
                      <td className="danger-text">
                        {s.shortage.toLocaleString()} units
                      </td>
                      <td>
                        {s.camp || s.district
                          ? `${s.camp || "Camp"}${s.district ? ` (${s.district})` : ""}`
                          : "Punjab Area"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Panel>

          <Panel title="Quick actions">
            <div className="quick-actions">
              <button className="btn primary" onClick={() => go("intake")}>
                ▤ New report
              </button>
              <button className="btn secondary" onClick={() => go("matching")}>
                ⌘ Run matching
              </button>
            </div>
          </Panel>
        </div>
      </div>

      {/* Live Recent Activity / Audit Log Panel */}
      <Panel
        title="Recent Activity & Audit Trail"
        action={
          <button className="link" onClick={loadData}>
            ↻ Refresh ({auditList.length} events) →
          </button>
        }
      >
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Coordinator / Actor</th>
              <th>Action</th>
              <th>Target ID</th>
              <th>Reviewer Notes & Justification</th>
            </tr>
          </thead>
          <tbody>
            {auditList.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: 20,
                    color: "var(--muted)",
                  }}
                >
                  No audit events logged yet.
                </td>
              </tr>
            ) : (
              auditList.map((entry) => {
                const date = new Date(entry.timestamp);
                const timeStr = isNaN(date.getTime())
                  ? entry.timestamp
                  : date.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                return (
                  <tr key={entry.id}>
                    <td>
                      <b>{timeStr}</b>
                    </td>
                    <td>{entry.user}</td>
                    <td>
                      <span
                        className={`status ${
                          entry.action === "approved" || entry.action === "verified"
                            ? "approved"
                            : entry.action === "rejected" ||
                              entry.action === "rejected-public"
                            ? "rejected"
                            : "partial"
                        }`}
                      >
                        {entry.action.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <code>{entry.target_id}</code>
                    </td>
                    <td>{entry.notes || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function Intake({
  online,
  onQueued,
}: {
  online: boolean;
  onQueued: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"demand" | "supply">("demand");
  const [isBulk, setIsBulk] = useState(false);
  const [text, setText] = useState("");
  const [supplyText, setSupplyText] = useState("");
  const [supplyCsvFile, setSupplyCsvFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [sending, setSending] = useState(false);
  const [extractedDemands, setExtractedDemands] = useState<Demand[]>([]);
  const [extractedSupply, setExtractedSupply] = useState<SupplyLot[]>([]);

  // Calculate detected messages in bulk mode
  const detectedMessages = useMemo(() => {
    if (!text.trim()) return [];
    return text
      .split(/\n\s*\n+|(?:\r?\n)?---+|\r?\n(?=(?:Camp|\d+\.|\bfrom:))/i)
      .map((m) => m.trim())
      .filter((m) => m.length > 5);
  }, [text]);

  const queueSingleDemand = async (msg: string) => {
    const uuid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();
    const queued: QueuedReport = {
      uuid,
      createdAt,
      text: msg,
      source: "Pasted Message",
      kind: "intake",
      state: "Waiting",
    };
    await queueReport(queued);

    return {
      id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      client_uuid: uuid,
      client_created_at: createdAt,
      created_at: createdAt,
      item: "Queued offline",
      qty: null,
      unit: null,
      location_text: "Stored on device",
      camp_id: null,
      beneficiaries: null,
      urgency: "high" as const,
      confidence: 0,
      provider: "unknown" as const,
      needs_review: true,
      raw_text: msg,
      source: "coordinator" as const,
      verified: false,
      kind: "demand" as const,
      language: /[\u0900-\u097F]/.test(msg)
        ? ("hi" as const)
        : ("en" as const),
      duplicate_of: null,
      report_count: 1,
    };
  };

  const submitDemand = async () => {
    if (!text.trim())
      return setError("Please paste or type a message before submitting.");
    setError("");
    setSending(true);

    const messagesToProcess =
      isBulk && detectedMessages.length > 0 ? detectedMessages : [text.trim()];
    const newResults: Demand[] = [];

    try {
      if (!online) {
        for (const msg of messagesToProcess) {
          const placeholder = await queueSingleDemand(msg);
          newResults.unshift(placeholder);
        }
        onQueued();
        setNotice({
          tone: "info",
          text: `Saved, will send when connected (${messagesToProcess.length} message${
            messagesToProcess.length > 1 ? "s" : ""
          } queued on device).`,
        });
        setExtractedDemands((prev) => [...newResults, ...prev]);
        setText("");
        return;
      }

      // Online: submit to API, but queue on network failure too (res.status === 0)
      for (const msg of messagesToProcess) {
        const client_uuid =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `uuid-${Date.now()}`;
        const client_created_at = new Date().toISOString();
        const res = await api.submitIntake(msg, {
          client_uuid,
          client_created_at,
        });

        if (res.ok && res.data) {
          newResults.unshift(res.data);
        } else if (res.status === 0) {
          // Fallback to queue on network error
          const queuedPlaceholder = await queueSingleDemand(msg);
          newResults.unshift(queuedPlaceholder);
          onQueued();
          setNotice({
            tone: "info",
            text: "Server unreachable. Saved, will send when connected.",
          });
        } else {
          setError(res.error || "Failed to process message.");
        }
      }

      if (newResults.length > 0) {
        setExtractedDemands((prev) => [...newResults, ...prev]);
        if (!notice) {
          setNotice({
            tone: "success",
            text: `Successfully parsed ${newResults.length} message${
              newResults.length > 1 ? "s" : ""
            }. Extracted demand cards shown below.`,
          });
        }
        setText("");
      }
    } catch {
      setNotice({
        tone: "error",
        text: "An error occurred while processing the intake.",
      });
    } finally {
      setSending(false);
    }
  };

  const submitSupplyText = async () => {
    if (!supplyText.trim())
      return setError("Please enter supply or inventory text.");
    setError("");
    setSending(true);
    try {
      const res = await api.pasteSupply(supplyText.trim());
      if (res.ok && res.data) {
        setExtractedSupply((prev) => [...res.data!, ...prev]);
        setNotice({
          tone: "success",
          text: `Ingested ${res.data.length} supply lots.`,
        });
        setSupplyText("");
      } else {
        setError(res.error || "Failed to parse supply text.");
      }
    } catch {
      setError("Failed to submit supply.");
    } finally {
      setSending(false);
    }
  };

  const submitSupplyCsv = async () => {
    if (!supplyCsvFile) return setError("Please select a CSV file to upload.");
    setError("");
    setSending(true);
    try {
      const res = await api.uploadSupplyCsv(supplyCsvFile);
      if (res.ok && res.data) {
        setExtractedSupply((prev) => [...res.data!, ...prev]);
        setNotice({
          tone: "success",
          text: `Uploaded CSV: parsed ${res.data.length} lots from ${supplyCsvFile.name}.`,
        });
        setSupplyCsvFile(null);
      } else {
        setError(res.error || "Failed to upload supply CSV.");
      }
    } catch {
      setError("Failed to upload CSV.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Field Report Intake"
        subtitle="Unstructured intake: WhatsApp chaos in, structured dispatch plan out"
        actions={
          <div className="tabs mini">
            <button
              className={activeTab === "demand" ? "active" : ""}
              onClick={() => setActiveTab("demand")}
            >
              ▤ Demand Intake
            </button>
            <button
              className={activeTab === "supply" ? "active" : ""}
              onClick={() => setActiveTab("supply")}
            >
              ◇ Supply Ingest
            </button>
          </div>
        }
      />

      {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

      <div className="intake-grid">
        <div className="stack">
          {activeTab === "demand" ? (
            <Panel
              className="form-panel"
              title="1 Unstructured Field Intake"
              action={
                <div className="sub-tabs" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={`sub-tab-btn ${!isBulk ? "active" : ""}`}
                    onClick={() => setIsBulk(false)}
                  >
                    Single Message
                  </button>
                  <button
                    type="button"
                    className={`sub-tab-btn ${isBulk ? "active" : ""}`}
                    onClick={() => setIsBulk(true)}
                  >
                    Bulk-Paste Mode
                  </button>
                </div>
              }
            >
              <label className="field" style={{ marginTop: 12 }}>
                <span>
                  Paste or type the message as you received it (English, Hindi or
                  Hinglish) *
                </span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    isBulk
                      ? "Paste multiple forwarded WhatsApp/SMS messages separated by a blank line:\n\nCamp 17 needs drinking water for approx 600 people, urgent\n\nCamp 4 needs 200 tents immediately for displaced families\n\nCamp 21 paani bilkul khatam ho chuka hai 300 log hain urgent"
                      : "Example: Camp 17 needs drinking water for approx 600 people, urgent"
                  }
                  style={{ minHeight: isBulk ? 160 : 120 }}
                />
                <small>
                  {isBulk && detectedMessages.length > 0
                    ? `${detectedMessages.length} message${
                        detectedMessages.length > 1 ? "s" : ""
                      } detected`
                    : `${text.length} characters`}
                </small>
              </label>

              {error && <div className="field-error">{error}</div>}

              <div className="examples">
                <b>One-click test examples</b>
                <div style={{ flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() =>
                      setText(
                        "Camp 17 needs drinking water for approx 600 people, urgent"
                      )
                    }
                  >
                    Camp 17 Water (Critical)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setText(
                        "Camp 4 needs 200 waterproof tents immediately for newly displaced families"
                      )
                    }
                  >
                    Camp 4 Tents (High)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setText(
                        "Camp 8 ke paas log beemar hain please medical kits bhejo turant"
                      )
                    }
                  >
                    Camp 8 Hinglish Medical
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulk(true);
                      setText(
                        "Camp 17 needs drinking water for approx 600 people, urgent\n\nCamp 4 needs 200 tents immediately\n\nCamp 21 paani bilkul khatam ho chuka hai 300 log hain urgent"
                      );
                    }}
                  >
                    Load 3 Bulk Messages
                  </button>
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setText("");
                    setError("");
                  }}
                >
                  × Clear
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={sending || !text.trim()}
                  onClick={submitDemand}
                >
                  {sending
                    ? "Parsing..."
                    : isBulk && detectedMessages.length > 1
                    ? `◇ Parse & Submit ${detectedMessages.length} Messages`
                    : "◇ Parse Message"}
                </button>
              </div>

              <div className="info-box" style={{ marginTop: 16 }}>
                ⓘ <b>Zero manual structuring</b>: Never enter item, quantity, or
                urgency manually. The backend AI & rules parser automatically extracts
                structured needs from raw message text.
              </div>
            </Panel>
          ) : (
            <Panel className="form-panel" title="1 Supply / Stock Ingest">
              <label className="field" style={{ marginTop: 12 }}>
                <span>Free-text stock declaration</span>
                <textarea
                  value={supplyText}
                  onChange={(e) => setSupplyText(e.target.value)}
                  placeholder="Example: Ludhiana Depot: 5000 litres drinking water available immediately, 2 trucks standing by"
                  style={{ minHeight: 95 }}
                />
              </label>

              <div className="examples">
                <b>Quick supply example</b>
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setSupplyText(
                        "Ludhiana Depot: 5000 litres drinking water available immediately"
                      )
                    }
                  >
                    Ludhiana 5000L Water
                  </button>
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn primary"
                  disabled={sending || !supplyText.trim()}
                  onClick={submitSupplyText}
                >
                  {sending ? "Ingesting..." : "＋ Ingest Supply Text"}
                </button>
              </div>

              <div className="csv-box">
                <b>Or Upload Stock CSV Spreadsheet</b>
                <p
                  style={{
                    margin: "6px 0 12px",
                    color: "var(--muted)",
                    fontSize: 11,
                  }}
                >
                  Upload depot inventory CSV (item, qty, unit, depot_id, lat, lng).
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setSupplyCsvFile(e.target.files?.[0] || null)}
                />
                {supplyCsvFile && (
                  <div style={{ marginTop: 10 }}>
                    <span>
                      Selected: <b>{supplyCsvFile.name}</b>
                    </span>
                    <button
                      type="button"
                      className="btn primary"
                      style={{ marginLeft: 10 }}
                      disabled={sending}
                      onClick={submitSupplyCsv}
                    >
                      {sending ? "Uploading..." : "Upload & Parse CSV"}
                    </button>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        <div className="stack">
          <Panel
            title="2 Parsed Extraction Results"
            action={
              <span className="updated">
                {extractedDemands.length} parsed demand
                {extractedDemands.length === 1 ? "" : "s"}
              </span>
            }
          >
            {extractedDemands.length === 0 && extractedSupply.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--muted)",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>▤</div>
                <b>No messages parsed yet</b>
                <p style={{ fontSize: 11, marginTop: 4 }}>
                  Paste a WhatsApp or SMS message on the left to see extracted
                  structured chips, confidence score, and language detection.
                </p>
              </div>
            ) : null}

            {extractedDemands.map((demand) => {
              const confPct = Math.round(demand.confidence * 100);
              const providerLabel =
                demand.provider === "gemini"
                  ? "AI (Gemini)"
                  : demand.provider === "gemini_failed"
                  ? "AI unavailable, rules used"
                  : "Rules engine";

              return (
                <div key={demand.id} className="result-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div className="result-chips">
                      <span className="chip">
                        📦 <b>Item:</b> {demand.item || "Pending extraction"}
                      </span>
                      <span className="chip">
                        🔢 <b>Qty:</b>{" "}
                        {demand.qty
                          ? `${demand.qty.toLocaleString()} ${demand.unit || ""}`
                          : "Unspecified"}
                      </span>
                      <span className={`status ${demand.urgency}`}>
                        {demand.urgency.toUpperCase()}
                      </span>
                      <span className="chip">
                        📍 <b>Location:</b>{" "}
                        {demand.location_text || demand.camp_id || "Unresolved"}
                      </span>
                      {demand.beneficiaries ? (
                        <span className="chip">
                          👥 <b>People:</b> {demand.beneficiaries}
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <span className="provider">{providerLabel}</span>
                      {demand.language && (
                        <span
                          className="provider"
                          style={{ textTransform: "uppercase" }}
                        >
                          {demand.language}
                        </span>
                      )}
                    </div>
                  </div>

                  <blockquote
                    style={{
                      margin: "4px 0",
                      padding: "8px 12px",
                      fontSize: 12,
                      textAlign: "left",
                    }}
                  >
                    "{demand.raw_text}"
                  </blockquote>

                  <div className="confidence" style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11 }}>
                      <span>Extraction confidence</span>
                      <b>{confPct}%</b>
                    </div>
                    <progress
                      value={confPct}
                      max="100"
                      style={{
                        height: 6,
                        margin: "4px 0",
                        accentColor:
                          confPct >= 80 ? "var(--green)" : "var(--amber)",
                      }}
                    />
                  </div>

                  {demand.needs_review ? (
                    <div
                      className="warning-box"
                      style={{
                        padding: "6px 10px",
                        fontSize: 11,
                        borderRadius: 3,
                      }}
                    >
                      ⚠ <b>Sent to Review Queue</b> (flagged for review — requires
                      coordinator check)
                    </div>
                  ) : (
                    <div
                      className="status low"
                      style={{
                        display: "inline-flex",
                        padding: "4px 10px",
                        width: "fit-content",
                        borderRadius: 3,
                      }}
                    >
                      ✓ High confidence — Eligible for dispatch matching
                    </div>
                  )}
                </div>
              );
            })}

            {extractedSupply.map((lot) => (
              <div key={lot.id} className="result-card">
                <div className="result-chips">
                  <span className="chip">
                    ◇ <b>Supply Lot:</b> {lot.item}
                  </span>
                  <span className="chip">
                    🔢 <b>Qty:</b> {lot.qty.toLocaleString()} {lot.unit}
                  </span>
                  <span className="chip">
                    ⌂ <b>Depot:</b> {lot.depot_name || lot.depot_id}
                  </span>
                  <span className="chip">
                    🕒 <b>Updated:</b> {new Date(lot.updated_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="3 Submission Pipeline & Offline Resilience">
            <div className="timeline">
              <div className="done">
                ✓<span>Intake</span>
              </div>
              <i />
              <div className={extractedDemands.length > 0 ? "done" : ""}>
                {extractedDemands.length > 0 ? "✓" : "○"}
                <span>AI Parsing</span>
              </div>
              <i />
              <div>
                ○<span>Review</span>
              </div>
              <i />
              <div>
                ○<span>Matching</span>
              </div>
            </div>
            <div className="info-box">
              ⓘ If you lose internet connectivity, ReliefOS queues raw
              submissions locally and automatically syncs them when the
              connection is restored.
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function ReviewQueue() {
  const [tab, setTab] = useState<"pending" | "unverified" | "all">("pending");
  const [demandsList, setDemandsList] = useState<Demand[]>([]);
  const [locationsList, setLocationsList] = useState<Location[]>([]);
  const [canonicalItems, setCanonicalItems] = useState<CanonicalItem[]>([
    { item_id: "water", name: "Drinking Water", unit: "litres", category: "water" },
    { item_id: "food", name: "Food Packet", unit: "packets", category: "food" },
    { item_id: "tent", name: "Tent", unit: "units", category: "shelter" },
    { item_id: "blanket", name: "Blanket", unit: "units", category: "shelter" },
    { item_id: "medkit", name: "Medical Kit", unit: "kits", category: "medical" },
  ]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [expandedDuplicates, setExpandedDuplicates] = useState<
    Record<string, boolean>
  >({});
  const [search, setSearch] = useState("");

  // Editable fields for coordinator correction
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [beneficiaries, setBeneficiaries] = useState("");
  const [urgency, setUrgency] = useState<"critical" | "high" | "medium" | "low">(
    "critical"
  );
  const [locationText, setLocationText] = useState("");
  const [campId, setCampId] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [rejecting, setRejecting] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [demandsRes, locationsRes, itemsRes] = await Promise.all([
      api.getDemands(),
      api.getLocations(),
      api.getItems(),
    ]);

    if (demandsRes.ok && demandsRes.data) {
      setDemandsList(demandsRes.data);
      if (!selectedId && demandsRes.data.length > 0) {
        setSelectedId(demandsRes.data[0].id);
      }
    }
    if (locationsRes.ok && locationsRes.data) {
      setLocationsList(locationsRes.data);
    }
    if (itemsRes.ok && itemsRes.data) {
      setCanonicalItems(itemsRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const selected = useMemo(() => {
    return demandsList.find((d) => d.id === selectedId) || demandsList[0];
  }, [demandsList, selectedId]);

  // Sync edit form whenever selected demand changes - KILL FAKE DEFAULTS
  useEffect(() => {
    if (selected) {
      const canonicalMatch = canonicalItems.find(
        (ci) => ci.item_id === selected.item_id || ci.name === selected.item
      );
      setItemId(canonicalMatch ? canonicalMatch.item_id : selected.item_id || "water");
      setItemName(selected.item || (canonicalMatch ? canonicalMatch.name : ""));
      setQuantity(selected.qty !== null && selected.qty !== undefined ? String(selected.qty) : "");
      setUnit(selected.unit || (canonicalMatch ? canonicalMatch.unit : ""));
      setBeneficiaries(
        selected.beneficiaries !== null && selected.beneficiaries !== undefined
          ? String(selected.beneficiaries)
          : ""
      );
      setUrgency(selected.urgency || "medium");
      setLocationText(selected.location_text || "");
      setCampId(selected.camp_id || "");
      setNotes("");
      setRejecting(false);
    }
  }, [selected?.id, canonicalItems]);

  // Handle canonical item dropdown change
  const handleItemSelect = (selectedKey: string) => {
    setItemId(selectedKey);
    const matched = canonicalItems.find((ci) => ci.item_id === selectedKey);
    if (matched) {
      setItemName(matched.name);
      if (!unit || unit === "units" || unit === "litres" || unit === "packets") {
        setUnit(matched.unit);
      }
    }
  };

  // Hierarchical list: Parent demands with their grouped duplicates
  const { topLevelDemands, duplicateMap } = useMemo(() => {
    const dupMap: Record<string, Demand[]> = {};
    const parents: Demand[] = [];

    for (const d of demandsList) {
      if (d.duplicate_of) {
        if (!dupMap[d.duplicate_of]) dupMap[d.duplicate_of] = [];
        dupMap[d.duplicate_of].push(d);
      } else {
        parents.push(d);
      }
    }

    // Sort: Critical urgency strictly pinned to the top!
    parents.sort((a, b) => {
      if (a.urgency === "critical" && b.urgency !== "critical") return -1;
      if (b.urgency === "critical" && a.urgency !== "critical") return 1;
      if (a.needs_review && !b.needs_review) return -1;
      if (!a.needs_review && b.needs_review) return 1;
      return (b.report_count || 1) - (a.report_count || 1);
    });

    return { topLevelDemands: parents, duplicateMap: dupMap };
  }, [demandsList]);

  // Filtered by tab and search
  const filteredDemands = useMemo(() => {
    return topLevelDemands.filter((d) => {
      if (tab === "pending" && !d.needs_review && d.verified) return false;
      if (tab === "unverified" && d.verified) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          d.raw_text.toLowerCase().includes(q) ||
          (d.item && d.item.toLowerCase().includes(q)) ||
          (d.location_text && d.location_text.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [topLevelDemands, tab, search]);

  const resolvedCamp = useMemo(() => {
    if (!selected) return undefined;
    return locationsList.find((l) => l.id === selected.camp_id);
  }, [locationsList, selected]);

  const handleApprove = async () => {
    if (!selected) return;

    // Check if coordinator fields differ from parsed values
    const hasEdits =
      itemId !== (selected.item_id || "") ||
      quantity !== (selected.qty ? String(selected.qty) : "") ||
      unit !== (selected.unit || "") ||
      beneficiaries !== (selected.beneficiaries ? String(selected.beneficiaries) : "") ||
      urgency !== selected.urgency ||
      locationText !== (selected.location_text || "") ||
      campId !== (selected.camp_id || "");

    try {
      if (hasEdits) {
        const correctRes = await api.correctDemand(selected.id, {
          item_id: itemId,
          item: itemName,
          qty: quantity ? parseInt(quantity, 10) : undefined,
          unit: unit || undefined,
          beneficiaries: beneficiaries ? parseInt(beneficiaries, 10) : undefined,
          urgency,
          location_text: locationText || undefined,
          camp_id: campId || undefined,
          notes: notes.trim() || "Approved with coordinator corrections",
        });
        if (!correctRes.ok) {
          setNotice({
            tone: "error",
            text: correctRes.error || "Failed to save corrections.",
          });
          return;
        }
      }

      const res = await api.verifyDemand(selected.id);
      if (res.ok) {
        setNotice({
          tone: "success",
          text: `Demand verified and approved into active matching pool.`,
        });
        await loadData();
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Failed to approve demand.",
        });
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to approve demand." });
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!notes.trim()) {
      setRejecting(true);
      return setNotice({
        tone: "error",
        text: "A rejection reason is required before rejecting this report.",
      });
    }
    try {
      const res = await api.rejectDemand(selected.id, notes.trim());
      if (res.ok) {
        setNotice({ tone: "success", text: "Report rejected and archived." });
        setRejecting(false);
        await loadData();
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Failed to reject report.",
        });
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to reject report." });
    }
  };

  const toggleDuplicates = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDuplicates((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const providerLabel = useMemo(() => {
    if (!selected) return "";
    if (selected.provider === "gemini") return "Parsed: Gemini AI";
    if (selected.provider === "gemini_failed")
      return "Parsed: Rules (AI Unavailable)";
    return "Parsed: Rules";
  }, [selected]);

  return (
    <>
      <PageHeader
        title="Review Queue"
        subtitle="Human verification & correction: AI proposes, human coordinator decides"
        actions={
          <div className="heading-actions">
            <button
              className="btn secondary"
              disabled={loading}
              onClick={loadData}
            >
              ↻ Refresh Queue
            </button>
            <div className="tabs mini">
              <button
                className={tab === "pending" ? "active" : ""}
                onClick={() => setTab("pending")}
              >
                Needs Review ({demandsList.filter((d) => d.needs_review).length})
              </button>
              <button
                className={tab === "unverified" ? "active" : ""}
                onClick={() => setTab("unverified")}
              >
                Unverified ({demandsList.filter((d) => !d.verified).length})
              </button>
              <button
                className={tab === "all" ? "active" : ""}
                onClick={() => setTab("all")}
              >
                All ({demandsList.length})
              </button>
            </div>
          </div>
        }
      />

      {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

      <div className="review-grid">
        <Panel
          title={`Incoming Reports (${filteredDemands.length})`}
          className="report-list"
          action={
            <input
              type="search"
              placeholder="Filter list..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                width: 140,
                height: 26,
              }}
            />
          }
        >
          {filteredDemands.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              No reports in this tab.
            </div>
          ) : (
            filteredDemands.map((demand) => {
              const isSelected = selected?.id === demand.id;
              const isCritical = demand.urgency === "critical";
              const childDups = duplicateMap[demand.id] || [];
              const isExpanded = !!expandedDuplicates[demand.id];

              return (
                <div key={demand.id}>
                  <button
                    className={`${isSelected ? "selected" : ""} ${
                      isCritical ? "pinned-critical" : ""
                    }`}
                    onClick={() => setSelectedId(demand.id)}
                    style={{ position: "relative" }}
                  >
                    <i className={`urgency-dot ${demand.urgency}`} />
                    <span>
                      <b style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {isCritical && (
                          <span
                            style={{ color: "var(--red)" }}
                            title="Pinned: Critical Urgency"
                          >
                            📌
                          </span>
                        )}
                        {demand.item || "Unclassified need"}
                        {demand.qty ? ` (${demand.qty} ${demand.unit || ""})` : ""}
                        {(demand.report_count || 1) > 1 && (
                          <span className="report-count-badge">
                            🔥 {demand.report_count} reports
                          </span>
                        )}
                      </b>
                      <small>
                        📍 {demand.location_text || demand.camp_id || "Punjab Area"} •{" "}
                        {demand.source === "public" ? "Citizen Web" : "Coordinator"}
                      </small>
                      <small className="raw-snippet">"{demand.raw_text}"</small>
                    </span>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 4,
                      }}
                    >
                      <Status tone={demand.urgency}>
                        {demand.urgency.toUpperCase()}
                      </Status>
                      <span
                        className={`verify-badge ${
                          demand.verified ? "verified" : "unverified"
                        }`}
                        style={{ fontSize: 9 }}
                      >
                        {demand.verified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  </button>

                  {childDups.length > 0 && (
                    <div style={{ paddingLeft: 28, background: "#f9f6f0" }}>
                      <button
                        type="button"
                        className="link"
                        style={{ fontSize: 10, padding: "4px 8px" }}
                        onClick={(e) => toggleDuplicates(demand.id, e)}
                      >
                        {isExpanded
                          ? `▲ Collapse ${childDups.length} duplicate reports`
                          : `▼ ${childDups.length} near-identical reports clustered into this need`}
                      </button>
                      {isExpanded &&
                        childDups.map((dup) => (
                          <div
                            key={dup.id}
                            style={{
                              padding: "4px 10px",
                              fontSize: 11,
                              borderLeft: "2px solid var(--beige)",
                              margin: "2px 0",
                            }}
                          >
                            <small style={{ color: "var(--muted)" }}>
                              {dup.source}: "{dup.raw_text}"
                            </small>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </Panel>

        {selected ? (
          <Panel
            title="Coordinator Corrections & Verification"
            action={<span className="provider">{providerLabel}</span>}
            className="extract-fields"
          >
            <p
              style={{
                fontSize: 11,
                color: "var(--muted)",
                margin: "8px 0 12px",
              }}
            >
              Edit extracted fields here if AI misclassified quantity or urgency,
              then approve to release into matching.
            </p>

            <div className="form-grid three">
              <label className="field">
                <span>Canonical Item *</span>
                <select
                  value={itemId}
                  onChange={(e) => handleItemSelect(e.target.value)}
                >
                  {canonicalItems.map((ci) => (
                    <option key={ci.item_id} value={ci.item_id}>
                      {ci.name} ({ci.unit})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Quantity * {!quantity && <small>(not extracted)</small>}</span>
                <input
                  type="number"
                  placeholder="e.g. 600"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Unit *</span>
                <input
                  type="text"
                  placeholder="litres, packets, etc."
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </label>
            </div>

            <div className="form-grid review-row">
              <label className="field">
                <span>
                  Beneficiaries (people){" "}
                  {!beneficiaries && <small>(not extracted)</small>}
                </span>
                <input
                  type="number"
                  placeholder="e.g. 600"
                  value={beneficiaries}
                  onChange={(e) => setBeneficiaries(e.target.value)}
                />
              </label>
              <div className="field">
                <span>Urgency *</span>
                <div className="urgency-buttons">
                  {(["critical", "high", "medium", "low"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={urgency === u ? "active" : ""}
                      onClick={() => setUrgency(u)}
                    >
                      {u.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field">
                <span>Location Free-Text *</span>
                <input
                  type="text"
                  placeholder="e.g. Camp 17, Gurdaspur"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Camp Location Map Link</span>
                <select
                  value={campId}
                  onChange={(e) => setCampId(e.target.value)}
                >
                  <option value="">Unresolved (Pick a Camp)</option>
                  {locationsList
                    .filter((l) => l.type === "camp")
                    .map((camp) => (
                      <option key={camp.id} value={camp.id}>
                        {camp.name} ({camp.district})
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="confidence" style={{ marginTop: 14 }}>
              <div>
                <b>Confidence score</b>
                <strong>{(selected.confidence * 100).toFixed(0)}%</strong>
              </div>
              <progress
                value={Math.round(selected.confidence * 100)}
                max="100"
                style={{
                  accentColor:
                    selected.confidence >= 0.8
                      ? "var(--green)"
                      : "var(--amber)",
                }}
              />
              {selected.needs_review && (
                <div className="warning-box">
                  Flagged for review — verify quantities against original field
                  message before approving.
                </div>
              )}
            </div>

            <label className="field" style={{ marginTop: 12 }}>
              <span>
                Reviewer Notes{" "}
                {rejecting && (
                  <b className="danger-text">(rejection reason mandatory)</b>
                )}
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter verification notes or mandatory rejection reason..."
                style={{ minHeight: 60 }}
              />
            </label>

            <div className="review-actions">
              <button
                type="button"
                className="btn danger"
                onClick={handleReject}
              >
                ✕ Reject Report
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!quantity && !beneficiaries}
                title={
                  !quantity && !beneficiaries
                    ? "Fill quantity or beneficiaries before approving"
                    : ""
                }
                onClick={handleApprove}
              >
                ✓ Approve Demand
              </button>
            </div>
          </Panel>
        ) : null}

        {selected ? (
          <Panel title="Location preview" className="review-map">
            <ReliefMap
              locations={
                resolvedCamp
                  ? [resolvedCamp]
                  : locationsList.filter((l) => l.type === "camp")
              }
              mode="camps"
              selectedId={selected.camp_id || undefined}
              demands={demandsList}
            />
            <p style={{ marginTop: 8 }}>
              {resolvedCamp ? (
                <>
                  <span className="dot online" /> Location resolved:{" "}
                  <b>{resolvedCamp.name}</b> ({resolvedCamp.district})
                </>
              ) : (
                <span className="danger-text">
                  ⚠ Location unresolved: set camp manually in dropdown
                </span>
              )}
            </p>
            <small>
              Raw extracted: {selected.location_text || "None specified"}
            </small>

            <h3 style={{ marginTop: 14 }}>AI Extraction Details</h3>
            <dl>
              <div>
                <dt>Provider</dt>
                <dd>{providerLabel}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{(selected.confidence * 100).toFixed(0)}%</dd>
              </div>
              {selected.language && (
                <div>
                  <dt>Language</dt>
                  <dd>{selected.language.toUpperCase()}</dd>
                </div>
              )}
              <div>
                <dt>Verification</dt>
                <dd>{selected.verified ? "Verified" : "Unverified"}</dd>
              </div>
            </dl>
          </Panel>
        ) : null}
      </div>
    </>
  );
}

function Matching() {
  const [plan, setPlan] = useState<PlanOutput | null>(null);
  const [locationsList, setLocationsList] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [notice, setNotice] = useState<Notice>();

  // Weight sliders & algorithm toggle
  const [urgencyWeight, setUrgencyWeight] = useState(0.5);
  const [fillWeight, setFillWeight] = useState(0.25);
  const [proximityWeight, setProximityWeight] = useState(0.25);
  const [algorithm, setAlgorithm] = useState("greedy");

  // Edit move dialog state
  const [isEditing, setIsEditing] = useState(false);
  const [editQty, setEditQty] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Reject move dialog state
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const loadLocations = async () => {
    const res = await api.getLocations();
    if (res.ok && res.data) setLocationsList(res.data);
  };

  const loadPlan = async (isExplicitRun = false) => {
    setLoading(true);
    try {
      let res;
      if (isExplicitRun) {
        res = await api.runMatching({
          weights: {
            urgency: urgencyWeight,
            fill: fillWeight,
            proximity: proximityWeight,
          },
          algorithm,
        });
      } else {
        res = await api.getLatestPlan();
      }

      if (res.ok && res.data) {
        setPlan(res.data);
        if (!selectedId && res.data.recommendations.length > 0) {
          setSelectedId(res.data.recommendations[0].id);
        }
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to load matching plan." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
    loadPlan(false);
  }, []);

  const selectedMove = useMemo(() => {
    if (!plan || !plan.recommendations.length) return null;
    return (
      plan.recommendations.find((m) => m.id === selectedId) ||
      plan.recommendations[0]
    );
  }, [plan, selectedId]);

  useEffect(() => {
    if (selectedMove) {
      setEditQty(String(selectedMove.qty));
      setEditNotes("");
      setIsEditing(false);
      setIsRejecting(false);
      setRejectReason("");
    }
  }, [selectedMove?.id]);

  // Update local move state directly without a disruptive full re-run
  const updateMoveStateLocal = (
    moveId: string,
    state: "approved" | "edited" | "rejected",
    updatedQty?: number
  ) => {
    if (!plan) return;
    const updatedRecs = plan.recommendations.map((m) => {
      if (m.id === moveId) {
        return {
          ...m,
          state,
          qty: updatedQty !== undefined ? updatedQty : m.qty,
        };
      }
      return m;
    });
    setPlan({ ...plan, recommendations: updatedRecs });
  };

  const handleApprove = async () => {
    if (!selectedMove) return;
    setActionInProgress(true);
    try {
      const res = await api.approveMove(selectedMove.id);
      if (res.ok) {
        setNotice({
          tone: "success",
          text: `Proposal ${selectedMove.id} approved. Dispatch plan updated.`,
        });
        updateMoveStateLocal(selectedMove.id, "approved");
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Failed to approve proposal.",
        });
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to approve proposal." });
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedMove) return;
    if (+editQty <= 0)
      return setNotice({
        tone: "error",
        text: "Enter a valid positive quantity.",
      });
    setActionInProgress(true);
    try {
      const newQty = parseInt(editQty, 10);
      const res = await api.editMove(selectedMove.id, {
        qty: newQty,
        notes: editNotes.trim() || undefined,
      });
      if (res.ok) {
        setNotice({
          tone: "success",
          text: `Proposal ${selectedMove.id} updated with adjusted quantity.`,
        });
        setIsEditing(false);
        updateMoveStateLocal(selectedMove.id, "edited", newQty);
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Failed to save edits.",
        });
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to save edits to proposal." });
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRejectMove = async () => {
    if (!selectedMove) return;
    if (!rejectReason.trim()) {
      return setNotice({
        tone: "error",
        text: "A rejection reason is mandatory before rejecting a proposal.",
      });
    }
    setActionInProgress(true);
    try {
      const res = await api.rejectMove(selectedMove.id, rejectReason.trim());
      if (res.ok) {
        setNotice({
          tone: "success",
          text: `Proposal ${selectedMove.id} rejected.`,
        });
        setIsRejecting(false);
        updateMoveStateLocal(selectedMove.id, "rejected");
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Failed to reject proposal.",
        });
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to reject proposal." });
    } finally {
      setActionInProgress(false);
    }
  };

  // Convert Move to route point using real IDs
  const routeForMap = useMemo(() => {
    if (!selectedMove) return undefined;
    const fromId = selectedMove.origin_location_id || selectedMove.stock_id;
    const toId = selectedMove.dest_location_id || selectedMove.demand_id;
    return {
      fromId,
      toId,
      km: selectedMove.km,
      eta_h: selectedMove.eta_h,
      explain: selectedMove.explain,
      item: selectedMove.item_id,
    };
  }, [selectedMove]);

  return (
    <>
      <PageHeader
        title="Matching Results & Dispatch Proposals"
        subtitle="AI/Algorithm matches supply lots to approved demands. Human coordinator approves, edits, or rejects."
        actions={
          <div className="heading-actions">
            <button
              className="btn secondary"
              disabled={loading}
              onClick={() => loadPlan(true)}
            >
              {loading ? "Calculating..." : "↻ Re-run Matching"}
            </button>
            {selectedMove && selectedMove.state !== "approved" && (
              <button
                className="btn primary"
                disabled={actionInProgress}
                onClick={handleApprove}
              >
                ✓ Approve Selected Proposal
              </button>
            )}
          </div>
        }
      />

      {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

      {/* Weight sliders & algorithm toggle */}
      <Panel
        title="Matching Engine Settings & Weight Optimization"
        style={{ marginBottom: 12 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            padding: "8px 12px 14px",
            alignItems: "center",
          }}
        >
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>
              Urgency Weight: <b>{(urgencyWeight * 100).toFixed(0)}%</b>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={urgencyWeight}
              onChange={(e) => setUrgencyWeight(parseFloat(e.target.value))}
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>
              Fill Ratio Weight: <b>{(fillWeight * 100).toFixed(0)}%</b>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={fillWeight}
              onChange={(e) => setFillWeight(parseFloat(e.target.value))}
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>
              Proximity Weight: <b>{(proximityWeight * 100).toFixed(0)}%</b>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={proximityWeight}
              onChange={(e) => setProximityWeight(parseFloat(e.target.value))}
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              style={{ height: 30, marginTop: 4, width: "100%" }}
            >
              <option value="greedy">Greedy Priority Matrix</option>
              <option value="lp">Linear Program (LP Optimization)</option>
            </select>
          </div>
        </div>
      </Panel>

      {/* Stale Stock Warnings Strip */}
      {plan?.warnings && plan.warnings.length > 0 && (
        <div className="warning-strip">
          <span style={{ fontSize: 16 }}>⚠</span>
          <div>
            <b>STALE STOCK WARNINGS:</b>
            {plan.warnings.map((w) => (
              <span key={w.stock_id} style={{ marginLeft: 12 }}>
                • <b>{w.item}</b> at lot {w.stock_id} ({w.age_hours}h old):{" "}
                {w.message}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="kpi-grid five">
        <Kpi
          icon="→"
          value={String(plan?.recommendations.length || 0)}
          label="Proposed moves"
        />
        <Kpi
          icon="✓"
          value={String(
            plan?.recommendations.filter((m) => m.state === "approved").length || 0
          )}
          label="Approved moves"
        />
        <Kpi
          icon="⚖"
          value={String(plan?.conflicts.length || 0)}
          label="Resolved conflicts"
          note="Three camps, one truck"
        />
        <Kpi
          icon="△"
          value={String(plan?.shortages.length || 0)}
          label="Unmet shortages"
        />
        <Kpi
          icon="∿"
          value={plan?.algorithm || "Greedy Matrix"}
          label="Solver algorithm"
          note="Haversine x 1.3 road factor"
        />
      </div>

      <div className="matching-grid">
        <Panel
          title={`Proposed Dispatch Moves (${plan?.recommendations.length || 0})`}
          className="move-list"
        >
          {!plan?.recommendations.length ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              No proposed moves generated yet. Click Re-run Matching.
            </div>
          ) : (
            plan.recommendations.map((move, index) => {
              const isSelected = selectedMove?.id === move.id;
              return (
                <button
                  key={move.id}
                  className={isSelected ? "selected" : ""}
                  onClick={() => setSelectedId(move.id)}
                >
                  <em>{index + 1}</em>
                  <span>
                    <b>
                      {move.qty.toLocaleString()} {move.item_id}
                    </b>
                    <small>
                      Depot: {move.stock_id} → Demand: {move.demand_id}
                    </small>
                    <small>
                      ◷ {move.km} km • {move.eta_h} hr •{" "}
                      {move.vehicle_id || "No vehicle assigned"}
                    </small>
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                    }}
                  >
                    <span
                      className={`status ${
                        move.state === "approved"
                          ? "approved"
                          : move.state === "rejected"
                          ? "rejected"
                          : move.state === "edited"
                          ? "partial"
                          : "waiting"
                      }`}
                    >
                      {move.state.toUpperCase()}
                    </span>
                    <small style={{ fontSize: 10, color: "var(--muted)" }}>
                      Score: {(move.score * 100).toFixed(0)}%
                    </small>
                  </div>
                </button>
              );
            })
          )}
        </Panel>

        <Panel title="Proposed dispatch routes on map" className="match-map">
          <ReliefMap
            locations={locationsList}
            route={routeForMap}
            selectedId={routeForMap?.toId}
          />
        </Panel>

        {selectedMove ? (
          <Panel
            title={`Proposal: ${selectedMove.item_id}`}
            action={
              <span
                className={`status ${
                  selectedMove.state === "approved"
                    ? "approved"
                    : selectedMove.state === "rejected"
                    ? "rejected"
                    : "waiting"
                }`}
              >
                {selectedMove.state.toUpperCase()}
              </span>
            }
            className="move-detail"
          >
            <details open style={{ margin: "10px 0", background: "#fcf9f2" }}>
              <summary style={{ fontSize: 13 }}>
                💡 Why this match? (Explanation)
              </summary>
              <blockquote
                style={{
                  margin: "8px 0",
                  padding: "10px 12px",
                  textAlign: "left",
                  fontSize: 12,
                }}
              >
                "{selectedMove.explain}"
              </blockquote>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  display: "grid",
                  gap: 4,
                }}
              >
                <span>
                  • <b>Distance:</b> {selectedMove.km} km (
                  {selectedMove.distance_source === "haversine"
                    ? "Straight-line x1.3 estimate"
                    : selectedMove.distance_source === "osrm"
                    ? "Road (OSRM)"
                    : selectedMove.distance_source}
                  )
                </span>
                <span>
                  • <b>Estimated Travel Time:</b> {selectedMove.eta_h} hours
                </span>
                <span>
                  • <b>Vehicle Type:</b>{" "}
                  {selectedMove.vehicle_id || "No vehicle available"} (Trips:{" "}
                  {selectedMove.trips})
                </span>
                <span>
                  • <b>Match Score:</b>{" "}
                  {(selectedMove.score * 100).toFixed(0)}% algorithmic fitness
                </span>
              </div>
            </details>

            <dl>
              <div>
                <dt>Proposal ID</dt>
                <dd>
                  <b>{selectedMove.id}</b>
                </dd>
              </div>
              <div>
                <dt>Item & Quantity</dt>
                <dd>
                  <b>
                    {selectedMove.qty.toLocaleString()} {selectedMove.item_id}
                  </b>
                </dd>
              </div>
              <div>
                <dt>Origin Supply Lot</dt>
                <dd>{selectedMove.stock_id}</dd>
              </div>
              <div>
                <dt>Destination Demand</dt>
                <dd>{selectedMove.demand_id}</dd>
              </div>
              <div>
                <dt>Proposal Status</dt>
                <dd>
                  <b>{selectedMove.state.toUpperCase()}</b>
                </dd>
              </div>
            </dl>

            {isEditing ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "#f8f4ec",
                  border: "1px solid var(--beige)",
                }}
              >
                <b>Edit Proposed Dispatch Quantity</b>
                <label className="field" style={{ marginTop: 6 }}>
                  <span>Proposed Quantity</span>
                  <input
                    type="number"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                  />
                </label>
                <label className="field" style={{ marginTop: 6 }}>
                  <span>Coordinator Edit Notes</span>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Reason for adjustment..."
                  />
                </label>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    className="btn secondary"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn primary"
                    disabled={actionInProgress}
                    onClick={handleSaveEdit}
                  >
                    Save Proposal Changes
                  </button>
                </div>
              </div>
            ) : null}

            {isRejecting ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "#fff5f4",
                  border: "1px solid #e8b6b0",
                }}
              >
                <b style={{ color: "var(--red)" }}>
                  Reject Proposal (Mandatory Reason)
                </b>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="State reason why this proposal is rejected..."
                  style={{ minHeight: 50, marginTop: 6 }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    className="btn secondary"
                    onClick={() => setIsRejecting(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn danger"
                    disabled={actionInProgress}
                    onClick={handleRejectMove}
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            ) : null}

            {!isEditing && !isRejecting && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setIsEditing(true)}
                >
                  ✎ Edit Proposal
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => setIsRejecting(true)}
                >
                  ✕ Reject Proposal
                </button>
                <button
                  type="button"
                  className="btn primary full"
                  style={{ gridColumn: "1 / -1", margin: "4px 0" }}
                  disabled={
                    actionInProgress || selectedMove.state === "approved"
                  }
                  onClick={handleApprove}
                >
                  {selectedMove.state === "approved"
                    ? "✓ Proposal Approved"
                    : "✓ Approve Proposal"}
                </button>
              </div>
            )}
          </Panel>
        ) : null}
      </div>

      <div className="bottom-grid" style={{ marginTop: 14 }}>
        <Panel
          title="Competitive Conflict Resolution ('Three camps, one truck')"
          action={
            <span className="provider">Algorithm: Strict Priority Matrix</span>
          }
        >
          <p
            style={{
              fontSize: 11,
              color: "var(--muted)",
              margin: "8px 12px 10px",
            }}
          >
            When multiple camps compete for the same supply lot, the engine decides
            based on urgency, remaining hours of safe supply, population, and
            distance.
          </p>
          <div style={{ padding: "0 12px 12px" }}>
            {plan?.conflicts && plan.conflicts.length > 0 ? (
              plan.conflicts.map((conflict, idx) => (
                <div key={idx} className="conflict-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <b>📦 Competing for: {conflict.item}</b>
                    <span className="conflict-winner">
                      🏆 Allocated to: {conflict.winner}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      margin: "6px 0",
                      color: "var(--muted)",
                    }}
                  >
                    <b>Competing Camps:</b>{" "}
                    {conflict.camps_competing.join(" • ")}
                  </div>
                  <blockquote
                    style={{
                      margin: "4px 0",
                      padding: "8px",
                      fontSize: 11,
                      textAlign: "left",
                      background: "#f2ece0",
                    }}
                  >
                    <b>Resolution Rationale:</b> {conflict.reason}
                  </blockquote>
                </div>
              ))
            ) : (
              <div style={{ padding: 12, color: "var(--muted)" }}>
                No resource conflicts recorded.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Shortages & Surplus Overview">
          <div style={{ padding: 12 }}>
            <b style={{ color: "var(--red)", fontSize: 12 }}>
              Unmet Shortages ({plan?.shortages.length || 0})
            </b>
            <table style={{ marginTop: 6, marginBottom: 14 }}>
              <thead>
                <tr>
                  <th>Camp / District</th>
                  <th>Item</th>
                  <th>Shortage</th>
                  <th>Nearest Source</th>
                </tr>
              </thead>
              <tbody>
                {!plan?.shortages || plan.shortages.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      No unmet shortages.
                    </td>
                  </tr>
                ) : (
                  plan.shortages.map((s, i) => (
                    <tr key={i}>
                      <td>{s.camp || s.district || "Punjab Area"}</td>
                      <td>{s.item}</td>
                      <td className="danger-text">
                        {s.shortage.toLocaleString()} units
                      </td>
                      <td>
                        {s.nearest_source
                          ? `${s.nearest_source.name} (${s.nearest_source.km} km)`
                          : s.message || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <b style={{ color: "var(--green)", fontSize: 12 }}>
              Unassigned Depot Surplus
            </b>
            <table style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>Depot</th>
                  <th>Item</th>
                  <th>Surplus Qty</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {!plan?.surplus || plan.surplus.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      No surplus stock.
                    </td>
                  </tr>
                ) : (
                  plan.surplus.map((sur, i) => (
                    <tr key={i}>
                      <td>{sur.depot || sur.depot_id || "Depot"}</td>
                      <td>{sur.item}</td>
                      <td>
                        <b>{sur.qty.toLocaleString()}</b>
                      </td>
                      <td>{sur.message || "Unreserved"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Stock() {
  const [stockList, setStockList] = useState<SupplyLot[]>([]);
  const [locationsList, setLocationsList] = useState<Location[]>([]);
  const [latestPlan, setLatestPlan] = useState<PlanOutput | null>(null);
  const [selectedDepotId, setSelectedDepotId] = useState("");
  const [search, setSearch] = useState("");
  const [staleThresholdHours, setStaleThresholdHours] = useState(6);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newText, setNewText] = useState("");
  const [notice, setNotice] = useState<Notice>();

  const loadStock = async () => {
    setLoading(true);
    const [stockRes, locationsRes, planRes] = await Promise.all([
      api.getStock(),
      api.getLocations(),
      api.getLatestPlan(),
    ]);

    if (stockRes.ok && stockRes.data) {
      setStockList(stockRes.data);
    }
    if (locationsRes.ok && locationsRes.data) {
      const depots = locationsRes.data.filter((l) => l.type === "depot");
      setLocationsList(locationsRes.data);
      if (!selectedDepotId && depots.length > 0) {
        setSelectedDepotId(depots[0].id);
      }
    }
    if (planRes.ok && planRes.data) {
      setLatestPlan(planRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStock();
  }, []);

  const depots = useMemo(() => {
    return locationsList.filter((l) => l.type === "depot");
  }, [locationsList]);

  const selectedDepot = useMemo(() => {
    return depots.find((d) => d.id === selectedDepotId) || depots[0];
  }, [depots, selectedDepotId]);

  const filteredDepots = useMemo(() => {
    return depots.filter((depot) =>
      depot.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [depots, search]);

  const depotLots = useMemo(() => {
    return stockList.filter(
      (lot) => !selectedDepot || lot.depot_id === selectedDepot.id
    );
  }, [stockList, selectedDepot]);

  const totalUnits = useMemo(() => {
    return stockList.reduce((sum, lot) => sum + (lot.qty || 0), 0);
  }, [stockList]);

  const staleLotsCount = useMemo(() => {
    const now = Date.now();
    return stockList.filter((lot) => {
      const ageHours =
        (now - new Date(lot.updated_at).getTime()) / (3600 * 1000);
      return ageHours > staleThresholdHours;
    }).length;
  }, [stockList, staleThresholdHours]);

  const warnedStockIds = useMemo(() => {
    const set = new Set<string>();
    if (latestPlan?.warnings) {
      latestPlan.warnings.forEach((w) => set.add(w.stock_id));
    }
    return set;
  }, [latestPlan]);

  const handleQuickAddStock = async () => {
    if (!newText.trim()) return;
    try {
      const res = await api.pasteSupply(newText.trim());
      if (res.ok) {
        setNotice({
          tone: "success",
          text: "New stock lot added successfully.",
        });
        setNewText("");
        setShowAddModal(false);
        await loadStock();
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Failed to add stock.",
        });
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to add stock." });
    }
  };

  return (
    <>
      <PageHeader
        title="Stock & Depots"
        subtitle="Live depot inventory, freshness monitoring, and reservation status"
        actions={
          <div className="heading-actions">
            <button
              className="btn secondary"
              onClick={loadStock}
              disabled={loading}
            >
              ↻ Refresh Stock
            </button>
            <button
              className="btn primary"
              onClick={() => setShowAddModal(true)}
            >
              ＋ Add Stock Lot
            </button>
          </div>
        }
      />

      {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

      {staleLotsCount > 0 && (
        <div className="warning-strip">
          <span style={{ fontSize: 16 }}>⚠</span>
          <div>
            <b>STALE STOCK ADVISORY:</b> {staleLotsCount} supply lot
            {staleLotsCount > 1 ? "s" : ""} have not been audited in over{" "}
            {staleThresholdHours} hours. Flagged in dispatch proposals: field
            verification or radio confirmation recommended before dispatching.
          </div>
        </div>
      )}

      <div className="kpi-grid five">
        <Kpi
          icon="◇"
          value={totalUnits.toLocaleString()}
          label="Total available stock"
        />
        <Kpi
          icon="▥"
          value={String(depots.length)}
          label="Active depots"
        />
        <Kpi
          icon="▦"
          value={String(stockList.length)}
          label="Stock lots"
        />
        <Kpi
          icon="⚠"
          value={String(staleLotsCount)}
          label="Stale stock lots"
          note={`>${staleThresholdHours}h since audit`}
        />
        <Kpi
          icon="◷"
          value={`${staleThresholdHours} hours`}
          label="Stale threshold"
          note="Configurable"
        />
      </div>

      {showAddModal && (
        <div
          className="panel"
          style={{ padding: 14, marginBottom: 12, background: "#faf6ee" }}
        >
          <b>Add New Supply Lot via Free Text</b>
          <p
            style={{
              fontSize: 11,
              color: "var(--muted)",
              margin: "4px 0 8px",
            }}
          >
            Paste unformatted stock receipt (e.g. "Ludhiana Depot: 2000 water
            bottles, 300 blankets")
          </p>
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Depot name, item, quantity, units..."
            style={{ minHeight: 60 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              className="btn secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </button>
            <button className="btn primary" onClick={handleQuickAddStock}>
              Parse & Add Lot
            </button>
          </div>
        </div>
      )}

      <div className="stock-grid">
        <Panel title="Depots" className="depot-list">
          <input
            className="panel-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="⌕ Search depots…"
          />
          {filteredDepots.map((depot) => {
            const isSelected = selectedDepot && depot.id === selectedDepot.id;
            const depotStock = stockList.filter((s) => s.depot_id === depot.id);
            const lotCount = depotStock.length;
            const depotUnits = depotStock.reduce(
              (sum, s) => sum + (s.qty || 0),
              0
            );

            return (
              <button
                className={isSelected ? "selected" : ""}
                key={depot.id}
                onClick={() => setSelectedDepotId(depot.id)}
              >
                <span>⌂</span>
                <b>
                  {depot.name}
                  <small>{depot.district}, Punjab</small>
                  <small>
                    {lotCount} lot{lotCount === 1 ? "" : "s"} •{" "}
                    {depotUnits.toLocaleString()} units
                  </small>
                </b>
                <i>›</i>
              </button>
            );
          })}
        </Panel>

        <Panel title="Depot locations" className="stock-map">
          <ReliefMap
            locations={locationsList}
            mode="depots"
            selectedId={selectedDepot?.id}
            onSelect={(location) => setSelectedDepotId(location.id)}
          />
        </Panel>

        {selectedDepot && (
          <Panel
            title={`${selectedDepot.name} Inventory`}
            action={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>
                  Stale threshold:
                </span>
                <select
                  value={staleThresholdHours}
                  onChange={(e) =>
                    setStaleThresholdHours(parseInt(e.target.value, 10))
                  }
                  style={{
                    height: 26,
                    minHeight: 26,
                    fontSize: 10,
                    padding: "0 6px",
                  }}
                >
                  <option value={4}>4 hours</option>
                  <option value={6}>6 hours (default)</option>
                  <option value={8}>8 hours</option>
                  <option value={12}>12 hours</option>
                </select>
              </div>
            }
            className="inventory"
          >
            <p style={{ padding: "8px 12px 0", color: "var(--muted)" }}>
              📍 {selectedDepot.district}, Punjab • Lat: {selectedDepot.lat}, Lng:{" "}
              {selectedDepot.lng}
            </p>
            <div className="tabs mini">
              <button className="active">
                Supply Lots ({depotLots.length})
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item & Lot ID</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Last Updated</th>
                  <th>Freshness Status</th>
                </tr>
              </thead>
              <tbody>
                {depotLots.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        padding: 20,
                        color: "var(--muted)",
                      }}
                    >
                      No supply lots recorded for this depot.
                    </td>
                  </tr>
                ) : (
                  depotLots.map((lot) => {
                    const now = Date.now();
                    const ageMs = now - new Date(lot.updated_at).getTime();
                    const ageHours = ageMs / (3600 * 1000);
                    const isStale = ageHours > staleThresholdHours;
                    const isEngineWarned = warnedStockIds.has(lot.id);

                    return (
                      <tr key={lot.id}>
                        <td>
                          <b>{lot.item}</b>
                          <small
                            style={{ display: "block", color: "var(--muted)" }}
                          >
                            Lot: {lot.id}
                          </small>
                        </td>
                        <td>
                          <b>{lot.qty.toLocaleString()}</b>
                        </td>
                        <td>{lot.unit}</td>
                        <td>
                          <span title={lot.updated_at}>
                            {new Date(lot.updated_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <small
                            style={{ display: "block", color: "var(--muted)" }}
                          >
                            {ageHours < 1
                              ? "Just now"
                              : `${ageHours.toFixed(1)}h ago`}
                          </small>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            {isStale ? (
                              <span
                                className="stale-badge"
                                title={`Updated ${ageHours.toFixed(
                                  1
                                )} hours ago (> ${staleThresholdHours}h threshold).`}
                              >
                                ⚠ STALE ({ageHours.toFixed(1)}h)
                              </span>
                            ) : (
                              <span className="status low">✓ Fresh</span>
                            )}
                            {isEngineWarned && (
                              <span
                                className="stale-badge"
                                style={{ background: "#711f1c" }}
                                title="Flagged in matching engine warnings"
                              >
                                Flagged by matching engine
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Panel>
        )}
      </div>

      <div className="stock-bottom">
        <Panel title="Depot capacity & stock distribution">
          <div className="bar-chart">
            {depots.map((depot) => {
              const count = stockList
                .filter((s) => s.depot_id === depot.id)
                .reduce((sum, s) => sum + (s.qty || 0), 0);
              const maxCount = totalUnits || 1;
              const heightPct = Math.max(
                12,
                Math.min(95, Math.round((count / maxCount) * 100))
              );

              return (
                <div key={depot.id}>
                  <span
                    className="available-bar"
                    style={{ height: `${heightPct}%` }}
                    title={`${depot.name}: ${count.toLocaleString()} units`}
                  />
                  <small>{depot.district}</small>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Freshness Audit Guidance">
          <div
            style={{
              padding: 12,
              fontSize: 11,
              lineHeight: 1.6,
              color: "var(--muted)",
            }}
          >
            <p>
              <b>Why track updated_at?</b> In rapid flood relief, physical stock
              fluctuates hourly. If a lot's <code>updated_at</code> exceeds{" "}
              <b>{staleThresholdHours} hours</b>, the matching engine surfaces a
              warning banner on proposals to prevent phantom dispatches.
            </p>
            <p style={{ marginTop: 8 }}>
              Coordinators can upload fresh CSV counts or paste WhatsApp inventory
              updates from warehouse managers at any time.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Needs() {
  const [demandsList, setDemandsList] = useState<Demand[]>([]);
  const [locationsList, setLocationsList] = useState<Location[]>([]);
  const [shortagesList, setShortagesList] = useState<Shortage[]>([]);
  const [auditList, setAuditList] = useState<AuditEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [expandedDuplicates, setExpandedDuplicates] = useState<
    Record<string, boolean>
  >({});
  const [notice, setNotice] = useState<Notice>();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState<string>("Auto-sync");

  // Filter state
  const [filters, setFilters] = useState<FilterValues>({
    district: "",
    item: "",
    urgency: "",
    status: "",
  });

  const loadData = async () => {
    const [demandsRes, locationsRes, shortagesRes, auditRes] =
      await Promise.all([
        api.getDemands(),
        api.getLocations(),
        api.getShortages(),
        api.getAudit(),
      ]);

    if (demandsRes.ok && demandsRes.data) {
      setDemandsList(demandsRes.data);
      if (!selectedId && demandsRes.data.length > 0) {
        setSelectedId(demandsRes.data[0].camp_id || demandsRes.data[0].id);
      }
    }
    if (locationsRes.ok && locationsRes.data) {
      setLocationsList(locationsRes.data);
    }
    if (shortagesRes.ok && shortagesRes.data) {
      setShortagesList(shortagesRes.data);
    }
    if (auditRes.ok && auditRes.data) {
      setAuditList(auditRes.data);
    }
    setLastSyncTime(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const uniqueDistricts = useMemo(() => {
    const set = new Set<string>();
    locationsList.forEach((l) => l.district && set.add(l.district));
    return Array.from(set).sort();
  }, [locationsList]);

  const uniqueItems = useMemo(() => {
    const set = new Set<string>();
    demandsList.forEach((d) => d.item && set.add(d.item));
    return Array.from(set).sort();
  }, [demandsList]);

  const handleVerifyInline = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.verifyDemand(id);
      if (res.ok) {
        setNotice({
          tone: "success",
          text: "Demand successfully verified and eligible for matching.",
        });
        await loadData();
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Failed to verify demand.",
        });
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to verify demand." });
    }
  };

  const handleRejectInline = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rejectReason.trim()) {
      setNotice({
        tone: "error",
        text: "A mandatory rejection reason is required.",
      });
      return;
    }
    try {
      const res = await api.rejectDemand(id, rejectReason.trim());
      if (res.ok) {
        setNotice({
          tone: "success",
          text: "Demand rejected and removed from needs board.",
        });
        setRejectId(null);
        setRejectReason("");
        await loadData();
      } else {
        setNotice({
          tone: "error",
          text: res.error || "Failed to reject demand.",
        });
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to reject demand." });
    }
  };

  // Group into parent rows and child duplicates, pin critical to top, apply filters
  const { parentDemands, duplicateMap } = useMemo(() => {
    const dupMap: Record<string, Demand[]> = {};
    const parents: Demand[] = [];

    const filtered = demandsList.filter((d) => {
      if (filters.district) {
        const campLoc = locationsList.find((l) => l.id === d.camp_id);
        const matchesDistrict =
          (campLoc && campLoc.district === filters.district) ||
          (d.location_text &&
            d.location_text.toLowerCase().includes(filters.district.toLowerCase()));
        if (!matchesDistrict) return false;
      }
      if (filters.item && d.item !== filters.item) return false;
      if (filters.urgency && d.urgency !== filters.urgency) return false;
      if (filters.status) {
        if (filters.status === "verified" && !d.verified) return false;
        if (filters.status === "unverified" && d.verified) return false;
      }
      return true;
    });

    for (const d of filtered) {
      if (d.duplicate_of) {
        if (!dupMap[d.duplicate_of]) dupMap[d.duplicate_of] = [];
        dupMap[d.duplicate_of].push(d);
      } else {
        parents.push(d);
      }
    }

    // Critical urgency pinned to top
    parents.sort((a, b) => {
      if (a.urgency === "critical" && b.urgency !== "critical") return -1;
      if (b.urgency === "critical" && a.urgency !== "critical") return 1;
      return (b.report_count || 1) - (a.report_count || 1);
    });

    return { parentDemands: parents, duplicateMap: dupMap };
  }, [demandsList, locationsList, filters]);

  // Derive top needed items from real demands
  const topNeededItems = useMemo(() => {
    const itemMap: Record<string, number> = {};
    for (const d of demandsList) {
      if (!d.item) continue;
      itemMap[d.item] = (itemMap[d.item] || 0) + (d.qty || 100);
    }
    const maxVal = Math.max(...Object.values(itemMap), 1);
    return Object.entries(itemMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, qty]) => ({
        name,
        pct: Math.round((qty / maxVal) * 100),
        qty,
      }));
  }, [demandsList]);

  return (
    <>
      <PageHeader
        title="Needs Board"
        subtitle="Approved demands, cluster counts, verification status and shortages by camp"
      />
      {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}
      <div className="filters resettable">
        <FiltersBar
          filters={filters}
          onChange={setFilters}
          districts={uniqueDistricts}
          items={uniqueItems}
          includeStatus
        />
        <button className="btn secondary" onClick={loadData}>
          ↻ Refresh
        </button>
      </div>
      <div className="kpi-grid five">
        <Kpi
          icon="▤"
          value={String(demandsList.length)}
          label="Total demands"
        />
        <Kpi
          icon="✓"
          value={String(demandsList.filter((d) => d.verified).length)}
          label="Verified demands"
        />
        <Kpi
          icon="⚠"
          value={String(demandsList.filter((d) => !d.verified).length)}
          label="Unverified public"
        />
        <Kpi
          icon="△"
          value={String(
            demandsList.filter((d) => d.urgency === "critical").length
          )}
          label="Critical demands"
        />
        <Kpi
          icon="◷"
          value={lastSyncTime}
          label="Backend sync"
          note="Live API"
        />
      </div>

      <div className="needs-grid">
        <Panel title={`Demands & Needs Board (${demandsList.length})`}>
          <table className="demand-table">
            <thead>
              <tr>
                <th>Camp / Area</th>
                <th>Item & Qty</th>
                <th>Urgency</th>
                <th>Verification</th>
                <th>Cluster / Duplicates</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {parentDemands.map((demand) => {
                const isSelected =
                  selectedId === demand.camp_id || selectedId === demand.id;
                const isCritical = demand.urgency === "critical";
                const childDups = duplicateMap[demand.id] || [];
                const isExpanded = !!expandedDuplicates[demand.id];
                const isThisRejecting = rejectId === demand.id;

                return (
                  <tr
                    key={demand.id}
                    className={`${isSelected ? "selected-row" : ""} ${
                      isCritical ? "pinned-critical" : ""
                    }`}
                    onClick={() => setSelectedId(demand.camp_id || demand.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <b
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {isCritical && (
                          <span style={{ color: "var(--red)" }}>📌</span>
                        )}
                        {demand.location_text || demand.camp_id || "Camp Area"}
                      </b>
                      {demand.beneficiaries && (
                        <small>{demand.beneficiaries} people</small>
                      )}
                    </td>

                    <td>
                      <b>{demand.item || "Relief item"}</b>
                      <div>
                        {demand.qty
                          ? `${demand.qty.toLocaleString()} ${
                              demand.unit || "units"
                            }`
                          : "Unspecified"}
                      </div>
                    </td>

                    <td>
                      <Status tone={demand.urgency}>
                        {demand.urgency.toUpperCase()}
                      </Status>
                    </td>

                    <td>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 3,
                        }}
                      >
                        <span
                          className={`verify-badge ${
                            demand.verified ? "verified" : "unverified"
                          }`}
                        >
                          {demand.verified ? "✓ Verified" : "⚠ Unverified"}
                        </span>
                        <small>{demand.source}</small>
                      </div>
                    </td>

                    <td>
                      {(demand.report_count || 1) > 1 ? (
                        <span className="report-count-badge">
                          🔥 {demand.report_count} reports
                        </span>
                      ) : (
                        <small>1 report</small>
                      )}
                      {childDups.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <button
                            type="button"
                            className="link"
                            style={{ fontSize: 10 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDuplicates((prev) => ({
                                ...prev,
                                [demand.id]: !prev[demand.id],
                              }));
                            }}
                          >
                            {isExpanded
                              ? `▲ Collapse (${childDups.length})`
                              : `▼ ${childDups.length} duplicate${
                                  childDups.length > 1 ? "s" : ""
                                }`}
                          </button>
                        </div>
                      )}
                    </td>

                    <td>
                      {!demand.verified ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {isThisRejecting ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: "flex", gap: 4 }}
                            >
                              <input
                                type="text"
                                placeholder="Mandatory reason..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                style={{ height: 24, fontSize: 10, width: 110 }}
                              />
                              <button
                                type="button"
                                className="mini-btn"
                                style={{
                                  background: "var(--red)",
                                  color: "white",
                                }}
                                onClick={(e) => handleRejectInline(demand.id, e)}
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                className="mini-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRejectId(null);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="mini-btn"
                                style={{
                                  background: "var(--burgundy)",
                                  color: "white",
                                  borderColor: "var(--burgundy)",
                                }}
                                onClick={(e) => handleVerifyInline(demand.id, e)}
                              >
                                ✓ Verify
                              </button>
                              <button
                                type="button"
                                className="mini-btn"
                                style={{
                                  background: "#fff",
                                  color: "var(--red)",
                                  borderColor: "var(--red)",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRejectId(demand.id);
                                }}
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--green)", fontSize: 11 }}>
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Needs coverage by camp" className="needs-map">
          <ReliefMap
            locations={locationsList}
            mode="camps"
            selectedId={selectedId}
            onSelect={(loc) => setSelectedId(loc.id)}
            demands={demandsList}
          />
        </Panel>
      </div>

      <div className="needs-bottom">
        <Panel title="Top needed items">
          <div className="rank-bars">
            {topNeededItems.map((row) => (
              <div key={row.name}>
                <span>{row.name}</span>
                <progress value={row.pct} max="100" />
                <b>{row.qty.toLocaleString()}</b>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Shortage overview (from Matching Engine)">
          <table>
            <thead>
              <tr>
                <th>Camp / District</th>
                <th>Item</th>
                <th>Shortage</th>
                <th>Nearest Source</th>
              </tr>
            </thead>
            <tbody>
              {shortagesList.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: "var(--muted)" }}>
                    No shortages reported by matching engine.
                  </td>
                </tr>
              ) : (
                shortagesList.map((s, idx) => (
                  <tr key={idx}>
                    <td>{s.camp || s.district || "Punjab Area"}</td>
                    <td>{s.item}</td>
                    <td className="danger-text">
                      {s.shortage.toLocaleString()} units
                    </td>
                    <td>
                      {s.nearest_source
                        ? `${s.nearest_source.name} (${s.nearest_source.km} km)`
                        : s.message || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Recent updates"
          action={
            <button className="link" onClick={loadData}>
              Refresh →
            </button>
          }
        >
          <div className="updates">
            {auditList.slice(0, 5).map((entry) => (
              <div key={entry.id}>
                <span>✓</span>
                <b>
                  {entry.action.toUpperCase()}: {entry.target_id}
                  <small>{entry.notes || `Updated by ${entry.user}`}</small>
                </b>
                <time>
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function OfflineStatus({
  reports,
  refresh,
  online,
  go,
}: {
  reports: QueuedReport[];
  refresh: () => void;
  online: boolean;
  go: (page: PageKey) => void;
}) {
  const [syncing, setSyncing] = useState<string>();
  const [deviceId] = useState(() => {
    if (typeof localStorage !== "undefined") {
      let id = localStorage.getItem("reliefos-device-id");
      if (!id) {
        id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `dev-${Date.now()}`;
        localStorage.setItem("reliefos-device-id", id);
      }
      return id;
    }
    return "dev-local";
  });

  const [storageEstimate, setStorageEstimate] = useState<string>("Calculating…");

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        const usedMb = ((est.usage || 0) / (1024 * 1024)).toFixed(1);
        const quotaMb = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
        setStorageEstimate(`${usedMb} MB / ${quotaMb} MB`);
      });
    } else {
      setStorageEstimate("Local IndexedDB active");
    }
  }, []);

  const retry = async (report: QueuedReport) => {
    if (!online) return;
    setSyncing(report.uuid);
    try {
      await sendQueued(report);
      await refresh();
    } finally {
      setSyncing(undefined);
    }
  };

  const retryAll = async () => {
    await replayQueue();
    await refresh();
  };

  return (
    <>
      <PageHeader
        title="Offline Status"
        subtitle="Reports queued on this device and sync history"
        actions={
          <div className="heading-actions">
            <button
              className="btn secondary"
              disabled={!online || !reports.length}
              onClick={retryAll}
            >
              ↻ Retry all ({reports.length})
            </button>
            <button className="btn primary" onClick={() => go("join")}>
              📲 Show Join QR Code
            </button>
          </div>
        }
      />
      <div className="kpi-grid four">
        <Kpi
          icon="⌁"
          value={String(reports.length)}
          label="Queued reports"
          note="Will sync automatically"
        />
        <Kpi
          icon="⇧"
          value={String(reports.filter((r) => r.state === "Waiting").length)}
          label="Waiting replay"
          note="Strict FIFO order"
        />
        <Kpi
          icon="△"
          value={String(reports.filter((r) => r.state === "Failed").length)}
          label="Failed (retry)"
          note="Needs attention"
        />
        <Kpi
          icon="◷"
          value={online ? "Online" : "Offline local"}
          label="Link status"
          note="Auto-sync active"
        />
      </div>

      <div className="offline-grid">
        <Panel
          title={`Queued reports (${reports.length})`}
          className="queue-list"
        >
          {!reports.length ? (
            <div className="empty">All reports are synced.</div>
          ) : (
            reports.map((report) => (
              <div key={report.uuid} className="queue-item">
                <span className="queue-icon">▤</span>
                <b>
                  {report.text}
                  <small>
                    {report.camp || report.location_text || "Punjab Area"} &nbsp;·&nbsp;{" "}
                    {report.kind === "public" ? "Citizen Web Report" : "Coordinator Intake"}
                  </small>
                  <small>{new Date(report.createdAt).toLocaleString()}</small>
                  <Status
                    tone={
                      report.state === "Failed"
                        ? "failed"
                        : report.state === "Sending"
                        ? "partial"
                        : "queued"
                    }
                  >
                    {report.state === "Waiting"
                      ? "Queued (offline)"
                      : report.state}
                  </Status>
                  {report.error && (
                    <small className="danger-text">{report.error}</small>
                  )}
                </b>
                <button
                  className="btn secondary"
                  disabled={!online || syncing === report.uuid}
                  onClick={() => retry(report)}
                >
                  {syncing === report.uuid ? "Sending…" : "Retry"}
                </button>
              </div>
            ))
          )}
        </Panel>

        <Panel title="Local Queue Guidance">
          <div
            style={{
              padding: 14,
              fontSize: 12,
              lineHeight: 1.6,
              color: "var(--muted)",
            }}
          >
            <p>
              <b>Strict FIFO Ordering:</b> Reports submitted offline are stored in
              IndexedDB with unique client UUIDs. When internet connectivity or local
              LAN access is restored, the queue replays in strict chronological
              order.
            </p>
            <p style={{ marginTop: 8 }}>
              <b>Citizen vs. Coordinator Integrity:</b> Public submissions queued
              offline retain their unverified citizen origin upon replay and are
              never improperly laundered as verified coordinator inputs.
            </p>
          </div>
        </Panel>
      </div>

      <div className="offline-bottom">
        <Panel title="Device status">
          <div className="device">
            <div>
              <span className={`dot ${online ? "online" : ""}`} />
              <b>{online ? "Online" : "Offline"}</b>
              <small>
                {online ? "Connected to server" : "Waiting for connection"}
              </small>
            </div>
            <p>
              Device ID
              <br />
              <b>{deviceId}</b>
              <br />
              <br />
              App version
              <br />
              v1.0.0 (offline enabled)
            </p>
          </div>
        </Panel>
        <Panel title="Storage usage (offline)">
          <div className="storage">
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {storageEstimate}
            </span>
          </div>
          <p>Stores reports, basemap geometry and queue until synced.</p>
        </Panel>
        <Panel title="Offline mode">
          <div className="offline-explain">
            <span>⌁</span>
            <p>
              Works with zero internet on a local network. Internet adds AI parsing
              and chat-app intake.
              <br />
              <button className="link" onClick={() => go("join")}>
                View Local Hotspot QR →
              </button>
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}

function JoinPage() {
  const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getJoin()
      .then((res) => {
        if (res.ok && res.data) setJoinInfo(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const isSafeSvg =
    joinInfo?.qr_svg && joinInfo.qr_svg.trim().startsWith("<svg");

  return (
    <>
      <PageHeader
        title="Connect Local Network"
        subtitle="Zero-internet hotspot QR code for coordinators and field teams"
      />
      <div
        style={{
          maxWidth: 520,
          margin: "20px auto",
          background: "#ffffff",
          padding: 24,
          border: "1px solid var(--beige)",
          borderRadius: 4,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>
          Scan to Access ReliefOS
        </h2>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
          Connect phones or laptops to the local Wi-Fi / hotspot. Scan the QR code
          or navigate to the URL directly. Zero cloud internet required.
        </p>

        {loading ? (
          <div style={{ padding: 40, color: "var(--muted)" }}>
            Loading network configuration…
          </div>
        ) : (
          <>
            {isSafeSvg ? (
              <div
                style={{
                  display: "inline-block",
                  padding: 12,
                  background: "#fff",
                  border: "1px solid var(--beige)",
                }}
                dangerouslySetInnerHTML={{ __html: joinInfo!.qr_svg! }}
              />
            ) : (
              <div
                style={{
                  padding: 30,
                  background: "#faf6ee",
                  borderRadius: 4,
                  fontSize: 14,
                }}
              >
                QR generator inactive on this platform. Access via URL below:
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  display: "block",
                }}
              >
                Local Network URL:
              </span>
              <b
                style={{
                  fontSize: 20,
                  color: "var(--burgundy)",
                  display: "block",
                  marginTop: 4,
                  wordBreak: "break-all",
                }}
              >
                {joinInfo?.url ||
                  `http://${window.location.hostname}:${window.location.port}`}
              </b>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function App() {
  const pageFromHash = window.location.hash.replace("#/", "") as PageKey;
  const [page, setPageState] = useState<PageKey>(
    NAV.some((item) => item.key === pageFromHash) || pageFromHash === "join"
      ? pageFromHash
      : "dashboard"
  );
  const { online, health } = useConnectivity();
  const queue = useQueue();
  const previousOnline = useRef(online);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  // Poll demands to dynamically keep the nav count accurate
  useEffect(() => {
    const checkReviews = async () => {
      const res = await api.getDemands();
      if (res.ok && res.data) {
        const count = res.data.filter((d) => d.needs_review || !d.verified).length;
        setPendingReviewCount(count);
      }
    };
    checkReviews();
    const timer = setInterval(checkReviews, 10000);
    return () => clearInterval(timer);
  }, []);

  const setPage = (next: PageKey) => {
    setPageState(next);
    window.location.hash = `/${next}`;
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash.replace("#/", "") as PageKey;
      if (NAV.some((item) => item.key === next) || next === "join") {
        setPageState(next);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const reconnected = online && !previousOnline.current;
    previousOnline.current = online;
    if (!reconnected) return;
    const sync = async () => {
      await replayQueue();
      queue.refresh();
    };
    const timer = window.setTimeout(sync, 1000);
    return () => window.clearTimeout(timer);
  }, [online]);

  if (
    page === "public" ||
    pageFromHash === "public" ||
    window.location.hash === "#/public" ||
    window.location.pathname.startsWith("/public")
  ) {
    return (
      <>
        <ToastHost />
        <PublicReport />
      </>
    );
  }

  const renderContent = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard go={setPage} online={online} />;
      case "intake":
        return <Intake online={online} onQueued={queue.refresh} />;
      case "review":
        return <ReviewQueue />;
      case "matching":
        return <Matching />;
      case "stock":
        return <Stock />;
      case "needs":
        return <Needs />;
      case "offline":
        return (
          <OfflineStatus
            reports={queue.reports}
            refresh={queue.refresh}
            online={online}
            go={setPage}
          />
        );
      case "join":
        return <JoinPage />;
      default:
        return <Dashboard go={setPage} online={online} />;
    }
  };

  return (
    <AppShell
      page={page}
      setPage={setPage}
      online={online}
      health={health}
      queueCount={queue.reports.length}
      pendingReviewCount={pendingReviewCount}
    >
      <div className="mock-label">{MOCK_MODE && "Mock data mode"}</div>
      {renderContent()}
    </AppShell>
  );
}
