import { useEffect, useMemo, useRef, useState } from "react";
import ReliefMap from "./components/ReliefMap";
import PublicReport from "./components/PublicReport";
import { demands, depots, inventory, locations, moves, reviewReports, type Urgency } from "./data/mockData";
import { api, MOCK_MODE, onToast } from "./services/api";
import type { AuditEntry, Demand, Move, PlanOutput, SupplyLot } from "./types";
import { getQueuedReports, queueReport, removeQueuedReport, replayQueue, seedDemoQueue, type QueuedReport } from "./offline/reportQueue";

type PageKey = "dashboard" | "intake" | "review" | "matching" | "stock" | "needs" | "offline" | "public";
type Notice = { tone: "success" | "error" | "info"; text: string };

const NAV: { key: PageKey; label: string; glyph: string }[] = [
  { key: "dashboard", label: "Dashboard", glyph: "âŒ‚" },
  { key: "intake", label: "Field Intake", glyph: "â–¤" },
  { key: "review", label: "Review Queue", glyph: "â˜·" },
  { key: "matching", label: "Matching Results", glyph: "âŒ˜" },
  { key: "stock", label: "Stock & Depots", glyph: "â—‡" },
  { key: "needs", label: "Needs Board", glyph: "â–¥" },
  { key: "offline", label: "Offline Status", glyph: "âŒ" },
];

const TITLES: Record<PageKey, string> = {
  dashboard: "Command dashboard",
  intake: "Field Report Intake",
  review: "Review Queue",
  matching: "Matching Results",
  stock: "Stock & Depots",
  needs: "Needs Board",
  offline: "Offline Status",
  public: "Public Citizen Report",
};

function useConnectivity() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
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
  return <span className={`status ${tone || String(children).toLowerCase().split(" ").join("-")}`}>{children}</span>;
}

function Panel({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {title && <div className="panel-head"><h2>{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

function Kpi({ icon, value, label, note, onClick }: { icon: string; value: string; label: string; note?: string; onClick?: () => void }) {
  const content = <><span className="kpi-icon">{icon}</span><div><b>{value}</b><span>{label}</span>{note && <small>{note}</small>}</div>{onClick && <span className="kpi-arrow">â€º</span>}</>;
  return onClick ? <button type="button" className="kpi" onClick={onClick}>{content}</button> : <div className="kpi">{content}</div>;
}

function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function Select({ label, children, value, onChange }: { label?: string; children: React.ReactNode; value?: string; onChange?: (value: string) => void }) {
  return <label className="select-field">{label && <span>{label}</span>}<select value={value} onChange={(event) => onChange?.(event.target.value)}>{children}</select></label>;
}

function Filters({ includeStatus = false }: { includeStatus?: boolean }) {
  return <div className="filters"><Select label="District"><option>All districts</option><option>Ludhiana</option><option>Gurdaspur</option></Select><Select label="Camp / Area"><option>All camps</option><option>Camp 17</option><option>Camp 4</option></Select><Select label="Item"><option>All items</option><option>Drinking water</option><option>Medical kits</option></Select>{includeStatus ? <Select label="Status"><option>All</option><option>Open</option><option>Partial</option></Select> : <Select label="Urgency"><option>All urgencies</option><option>Critical</option><option>High</option></Select>}</div>;
}

function AppShell({ page, setPage, online, queueCount, children }: { page: PageKey; setPage: (page: PageKey) => void; online: boolean; queueCount: number; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-shell">
      <button type="button" className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">â˜°</button>
      <aside className={mobileOpen ? "open" : ""}>
        <div className="brand">Relief<span>OS</span><small>Disaster Relief Coordination</small></div>
        <nav aria-label="Primary navigation">
          {NAV.map((item) => <button type="button" className={page === item.key ? "active" : ""} key={item.key} onClick={() => { setPage(item.key); setMobileOpen(false); }}><i>{item.glyph}</i>{item.label}{item.key === "review" && <em>7</em>}</button>)}
        </nav>
        <div className="sidebar-art"><div className="monument" aria-hidden="true">âŒ‚ â—‡ âŒ‚</div><b>ReliefOS</b><span>Safer communities.<br />Stronger tomorrows.</span></div>
      </aside>
      <div className="app-main">
        <header>
          <div className="crumb"><span>âŒ‚</span> Operations <b>/</b> <strong>{TITLES[page]}</strong></div>
          <div className="account"><span className={online ? "dot online" : "dot"} /> {online ? "Online" : "Offline"}<button type="button" onClick={() => setPage("offline")}>âŒ˜ Queued: {queueCount}</button><span className="bell">â™§</span><span className="avatar">AJ</span><span className="account-name">Aastha Jha</span></div>
        </header>
        {!online && (
          <div className="offline-banner">
            Works with zero internet on a local network. Internet adds AI parsing and chat-app intake.
            {queueCount > 0 && ` (${queueCount} report${queueCount > 1 ? "s" : ""} queued on this device)`}
          </div>
        )}
        <div className="demo-ribbon">â“˜ &nbsp; SIMULATED DATA â€” DEMO ENVIRONMENT</div>
        <main>{children}</main>
      </div>
    </div>
  );
}

function Dashboard({ go, online }: { go: (page: PageKey) => void; online: boolean }) {
  const [updated, setUpdated] = useState(new Date());
  const [auditList, setAuditList] = useState<AuditEntry[]>([]);
  const [demandsList, setDemandsList] = useState<Demand[]>([]);
  const [stockList, setStockList] = useState<SupplyLot[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [auditRes, demandsRes, stockRes] = await Promise.all([
        api.getAudit(),
        api.getDemands(),
        api.getStock(),
      ]);
      if (auditRes.ok && auditRes.data) setAuditList(auditRes.data);
      if (demandsRes.ok && demandsRes.data) setDemandsList(demandsRes.data);
      if (stockRes.ok && stockRes.data) setStockList(stockRes.data);
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

  const pendingReviews = useMemo(() => {
    return demandsList
      .filter((d) => d.needs_review || !d.verified)
      .sort((a, b) => (a.urgency === "critical" ? -1 : 1))
      .slice(0, 4);
  }, [demandsList]);

  const criticalShortagesCount = useMemo(() => {
    return demandsList.filter((d) => d.urgency === "critical").length;
  }, [demandsList]);

  return (
    <>
      <PageHeader
        title="Command dashboard"
        subtitle="Punjab relief operations â€¢ WhatsApp chaos in, dispatch plan out"
        actions={
          <>
            <span className="updated">
              Last updated {updated.toLocaleTimeString()} Â· Auto-refresh 8s
            </span>
            <button className="btn secondary" disabled={loading} onClick={loadData}>
              â†» Refresh
            </button>
          </>
        }
      />

      <div className="kpi-grid five">
        <Kpi
          icon="â—‡"
          value={totalStockUnits.toLocaleString()}
          label="Available stock"
          note={`${stockList.length} supply lots`}
          onClick={() => go("stock")}
        />
        <Kpi
          icon="â™§"
          value={String(demandsList.length)}
          label="Active demands"
          note={`${demandsList.filter((d) => d.verified).length} verified`}
          onClick={() => go("needs")}
        />
        <Kpi
          icon="â–¤"
          value={String(demandsList.filter((d) => d.needs_review || !d.verified).length)}
          label="Pending reviews"
          note="Human check required"
          onClick={() => go("review")}
        />
        <Kpi
          icon="â–³"
          value={String(criticalShortagesCount)}
          label="Critical demands"
          note="Life-threatening priority"
          onClick={() => go("needs")}
        />
        <Kpi
          icon="âˆ¿"
          value={online ? "Online" : "Offline local"}
          label="System status"
          note={online ? "Cloud API connected" : "Zero-internet mode"}
        />
      </div>

      <Filters />

      <div className="dashboard-grid">
        <Panel title="Punjab: Depots and Camps" className="map-panel">
          <ReliefMap locations={locations} route={moves[0]} />
        </Panel>

        <div className="stack">
          <Panel
            title="Pending reviews"
            action={
              <button className="link" onClick={() => go("review")}>
                View all ({demandsList.filter((d) => d.needs_review || !d.verified).length}) â†’
              </button>
            }
          >
            <div className="compact-list">
              {pendingReviews.length === 0 ? (
                <div style={{ padding: 16, color: "var(--muted)", textAlign: "center" }}>
                  All demands reviewed and verified.
                </div>
              ) : (
                pendingReviews.map((report) => (
                  <button key={report.id} onClick={() => go("review")}>
                    <span>{report.urgency === "critical" ? "ðŸ“Œ" : "â–¤"}</span>
                    <b>
                      {report.item || "Parsed request"}
                      {report.qty ? ` (${report.qty} ${report.unit || ""})` : ""}
                      {report.report_count > 1 && (
                        <span className="report-count-badge" style={{ marginLeft: 6 }}>
                          {report.report_count} reports
                        </span>
                      )}
                      <small>
                        {report.location_text || report.camp_id || "Punjab"} â€¢ {report.source}
                      </small>
                    </b>
                    <Status tone={report.urgency.toLowerCase()}>
                      {report.urgency.toUpperCase()}
                    </Status>
                    <i>â€º</i>
                  </button>
                ))
              )}
            </div>
          </Panel>

          <Panel
            title="Critical shortages"
            action={
              <button className="link" onClick={() => go("needs")}>
                View all â†’
              </button>
            }
          >
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Missing quantity</th>
                  <th>Camp</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Drinking water", "5,000 units", "Camp 17 (Gurdaspur)"],
                  ["Tents", "200 units", "Camp 4 (Firozpur)"],
                  ["Medical kits", "150 units", "Camp 8 (Hoshiarpur)"],
                  ["Food packets", "1,200 units", "Camp 12 (Ludhiana)"],
                ].map((row) => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td className="danger-text">{row[1]}</td>
                    <td>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Quick actions">
            <div className="quick-actions">
              <button className="btn primary" onClick={() => go("intake")}>
                â–¤ New report
              </button>
              <button className="btn secondary" onClick={() => go("matching")}>
                âŒ˜ Run matching
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
            â†» Refresh ({auditList.length} events) â†’
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
                <td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>
                  No audit events logged yet.
                </td>
              </tr>
            ) : (
              auditList.map((entry) => {
                const date = new Date(entry.timestamp);
                const timeStr = isNaN(date.getTime())
                  ? entry.timestamp
                  : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
                            : entry.action === "rejected" || entry.action === "rejected-public"
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
                    <td>{entry.notes || "â€”"}</td>
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

function Intake({ online, onQueued }: { online: boolean; onQueued: () => void }) {
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

  const submitDemand = async () => {
    if (!text.trim()) return setError("Please paste or type a message before submitting.");
    setError("");
    setSending(true);

    const messagesToProcess = isBulk && detectedMessages.length > 0 ? detectedMessages : [text.trim()];
    const newResults: Demand[] = [];

    try {
      if (!online) {
        // Offline: save to IndexedDB queue and show notification
        for (const msg of messagesToProcess) {
          const queued: QueuedReport = {
            uuid: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            text: msg,
            source: "Pasted Message",
            state: "Waiting",
          };
          await queueReport(queued);

          // Optimistic placeholder for offline UI
          newResults.unshift({
            id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            item: "Queued offline",
            qty: null,
            unit: null,
            location_text: "Stored on device",
            camp_id: null,
            beneficiaries: null,
            urgency: "high",
            confidence: 0,
            provider: "unknown",
            needs_review: true,
            raw_text: msg,
            source: "coordinator",
            verified: false,
            kind: "demand",
            language: /[\u0900-\u097F]/.test(msg) ? "hi" : "en",
            duplicate_of: null,
            report_count: 1,
          });
        }
        onQueued();
        setNotice({
          tone: "info",
          text: `Saved, will send when connected (${messagesToProcess.length} message${messagesToProcess.length > 1 ? "s" : ""} queued on device).`,
        });
        setExtractedDemands((prev) => [...newResults, ...prev]);
        setText("");
        return;
      }

      // Online: submit to API
      for (const msg of messagesToProcess) {
        const res = await api.submitIntake(msg);
        if (res.ok && res.data) {
          newResults.unshift(res.data);
        } else {
          // If server error or network issue
          setError(res.error || "Failed to process message.");
        }
      }

      if (newResults.length > 0) {
        setExtractedDemands((prev) => [...newResults, ...prev]);
        setNotice({
          tone: "success",
          text: `Successfully parsed ${newResults.length} message${newResults.length > 1 ? "s" : ""}. Extracted demand cards shown below.`,
        });
        setText("");
      }
    } catch {
      setNotice({ tone: "error", text: "An error occurred while processing the intake." });
    } finally {
      setSending(false);
    }
  };

  const submitSupplyText = async () => {
    if (!supplyText.trim()) return setError("Please enter supply or inventory text.");
    setError("");
    setSending(true);
    try {
      const res = await api.pasteSupply(supplyText.trim());
      if (res.ok && res.data) {
        setExtractedSupply((prev) => [...res.data!, ...prev]);
        setNotice({ tone: "success", text: `Ingested ${res.data.length} supply lots.` });
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
        setNotice({ tone: "success", text: `Uploaded CSV: parsed ${res.data.length} lots from ${supplyCsvFile.name}.` });
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
              â–¤ Demand Intake
            </button>
            <button
              className={activeTab === "supply" ? "active" : ""}
              onClick={() => setActiveTab("supply")}
            >
              â—‡ Supply Ingest
            </button>
          </div>
        }
      />

      {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

      <div className="intake-grid">
        {/* Left Column: Intake Input */}
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
                  Paste or type the message as you received it (English, Hindi or Hinglish) *
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
                    ? `${detectedMessages.length} message${detectedMessages.length > 1 ? "s" : ""} detected`
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
                      setText("Camp 17 needs drinking water for approx 600 people, urgent")
                    }
                  >
                    Camp 17 Water (Critical)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setText("Camp 4 needs 200 waterproof tents immediately for newly displaced families")
                    }
                  >
                    Camp 4 Tents (High)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setText("Camp 8 ke paas log beemar hain please medical kits bhejo turant")
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
                  Ã— Clear
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
                    ? `â—‡ Parse & Submit ${detectedMessages.length} Messages`
                    : "â—‡ Parse Message"}
                </button>
              </div>

              <div className="info-box" style={{ marginTop: 16 }}>
                â“˜ <b>Zero manual structuring</b>: Never enter item, quantity, or urgency manually.
                The backend AI & rules parser automatically extracts structured needs from raw message text.
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
                  {sending ? "Ingesting..." : "ï¼‹ Ingest Supply Text"}
                </button>
              </div>

              <div className="csv-box">
                <b>Or Upload Stock CSV Spreadsheet</b>
                <p style={{ margin: "6px 0 12px", color: "var(--muted)", fontSize: 11 }}>
                  Upload depot inventory CSV (item, qty, unit, depot_id, lat, lng).
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setSupplyCsvFile(e.target.files?.[0] || null)}
                />
                {supplyCsvFile && (
                  <div style={{ marginTop: 10 }}>
                    <span>Selected: <b>{supplyCsvFile.name}</b></span>
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

        {/* Right Column: Parsed Result Cards */}
        <div className="stack">
          <Panel
            title="2 Parsed Extraction Results"
            action={
              <span className="updated">
                {extractedDemands.length} parsed demand{extractedDemands.length === 1 ? "" : "s"}
              </span>
            }
          >
            {extractedDemands.length === 0 && extractedSupply.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>â–¤</div>
                <b>No messages parsed yet</b>
                <p style={{ fontSize: 11, marginTop: 4 }}>
                  Paste a WhatsApp or SMS message on the left to see extracted structured chips, confidence score, and language detection.
                </p>
              </div>
            ) : null}

            {/* Extracted Demand Result Cards */}
            {extractedDemands.map((demand) => {
              const confPct = Math.round(demand.confidence * 100);
              return (
                <div key={demand.id} className="result-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="result-chips">
                      <span className="chip">
                        ðŸ“¦ <b>Item:</b> {demand.item || "Pending extraction"}
                      </span>
                      <span className="chip">
                        ðŸ”¢ <b>Qty:</b>{" "}
                        {demand.qty ? `${demand.qty.toLocaleString()} ${demand.unit || ""}` : "Unspecified"}
                      </span>
                      <span className={`status ${demand.urgency}`}>
                        {demand.urgency.toUpperCase()}
                      </span>
                      <span className="chip">
                        ðŸ“ <b>Location:</b> {demand.location_text || demand.camp_id || "Unresolved"}
                      </span>
                      {demand.beneficiaries ? (
                        <span className="chip">
                          ðŸ‘¥ <b>People:</b> {demand.beneficiaries}
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <span className="provider">
                        {demand.provider === "gemini" ? "AI (Gemini)" : "Rules Engine"}
                      </span>
                      <span className="provider" style={{ textTransform: "uppercase" }}>
                        {demand.language}
                      </span>
                    </div>
                  </div>

                  <blockquote style={{ margin: "4px 0", padding: "8px 12px", fontSize: 12, textAlign: "left" }}>
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
                        accentColor: confPct >= 80 ? "var(--green)" : "var(--amber)",
                      }}
                    />
                  </div>

                  {demand.needs_review ? (
                    <div className="warning-box" style={{ padding: "6px 10px", fontSize: 11, borderRadius: 3 }}>
                      âš  <b>Sent to Review Queue</b> (confidence below 80% â€” requires coordinator check)
                    </div>
                  ) : (
                    <div
                      className="status low"
                      style={{ display: "inline-flex", padding: "4px 10px", width: "fit-content", borderRadius: 3 }}
                    >
                      âœ“ High confidence â€” Eligible for dispatch matching
                    </div>
                  )}
                </div>
              );
            })}

            {/* Extracted Supply Result Cards */}
            {extractedSupply.map((lot) => (
              <div key={lot.id} className="result-card">
                <div className="result-chips">
                  <span className="chip">
                    â—‡ <b>Supply Lot:</b> {lot.item}
                  </span>
                  <span className="chip">
                    ðŸ”¢ <b>Qty:</b> {lot.qty.toLocaleString()} {lot.unit}
                  </span>
                  <span className="chip">
                    âŒ‚ <b>Depot:</b> {lot.depot_id}
                  </span>
                  <span className="chip">
                    ðŸ•’ <b>Updated:</b> {new Date(lot.updated_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </Panel>

          <Panel title="3 Submission Pipeline & Offline Resilience">
            <div className="timeline">
              <div className="done">âœ“<span>Intake</span></div>
              <i />
              <div className={extractedDemands.length > 0 ? "done" : ""}>
                {extractedDemands.length > 0 ? "âœ“" : "â—‹"}
                <span>AI Parsing</span>
              </div>
              <i />
              <div>â—‹<span>Review</span></div>
              <i />
              <div>â—‹<span>Matching</span></div>
            </div>
            <div className="info-box">
              â“˜ If you lose internet connectivity, ReliefOS queues raw submissions locally and automatically syncs them when the connection is restored.
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
  const [selectedId, setSelectedId] = useState<string>("");
  const [expandedDuplicates, setExpandedDuplicates] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  // Editable fields for coordinator correction
  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [beneficiaries, setBeneficiaries] = useState("");
  const [urgency, setUrgency] = useState<"critical" | "high" | "medium" | "low">("critical");
  const [locationText, setLocationText] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [rejecting, setRejecting] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadDemands = async () => {
    setLoading(true);
    const res = await api.getDemands();
    if (res.ok && res.data) {
      setDemandsList(res.data);
      if (!selectedId && res.data.length > 0) {
        setSelectedId(res.data[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDemands();
  }, []);

  const selected = useMemo(() => {
    return demandsList.find((d) => d.id === selectedId) || demandsList[0];
  }, [demandsList, selectedId]);

  // Sync edit form whenever selected demand changes
  useEffect(() => {
    if (selected) {
      setItem(selected.item || "General Relief");
      setQuantity(selected.qty ? String(selected.qty) : "100");
      setUnit(selected.unit || "units");
      setBeneficiaries(selected.beneficiaries ? String(selected.beneficiaries) : "100");
      setUrgency(selected.urgency || "medium");
      setLocationText(selected.location_text || selected.camp_id || "Punjab");
      setNotes("");
      setRejecting(false);
    }
  }, [selected?.id]);

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

  const handleApprove = async () => {
    if (!selected) return;
    try {
      const res = await api.verifyDemand(selected.id);
      if (res.ok) {
        setNotice({
          tone: "success",
          text: `Demand verified and approved into active matching pool.`,
        });
        await loadDemands();
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
        await loadDemands();
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to reject report." });
    }
  };

  const toggleDuplicates = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDuplicates((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      <PageHeader
        title="Review Queue"
        subtitle="Verify extracted requests, correct AI fields, and validate public submissions before matching."
        actions={
          <div className="mini-kpis">
            <Kpi
              icon="â–¤"
              value={String(demandsList.filter((d) => d.needs_review).length)}
              label="needs review"
            />
            <Kpi
              icon="âš "
              value={String(demandsList.filter((d) => !d.verified).length)}
              label="unverified public"
            />
          </div>
        }
      />

      {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

      <div className="review-tools">
        <div className="tabs">
          <button
            className={tab === "pending" ? "active" : ""}
            onClick={() => setTab("pending")}
          >
            Needs Review ({demandsList.filter((d) => d.needs_review || !d.verified).length})
          </button>
          <button
            className={tab === "unverified" ? "active" : ""}
            onClick={() => setTab("unverified")}
          >
            Unverified Public ({demandsList.filter((d) => !d.verified).length})
          </button>
          <button
            className={tab === "all" ? "active" : ""}
            onClick={() => setTab("all")}
          >
            All Demands ({demandsList.length})
          </button>
        </div>
        <div className="search">
          <input
            placeholder="Search demands (item, location, message text)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn secondary" onClick={loadDemands} disabled={loading}>
            â†» Refresh
          </button>
        </div>
      </div>

      <div className="review-layout">
        {/* Left Column: Demands List with Pinned Criticals & Collapsed Duplicates */}
        <Panel className="review-list">
          {filteredDemands.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
              No demands matching this filter.
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
                    className={`${isSelected ? "selected" : ""} ${isCritical ? "pinned-critical" : ""}`}
                    onClick={() => setSelectedId(demand.id)}
                  >
                    <i className={`urgency-dot ${demand.urgency}`} />
                    <span>
                      <b style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {isCritical && <span style={{ color: "var(--red)" }} title="Pinned: Critical Urgency">ðŸ“Œ</span>}
                        {demand.item || "Parsed item"}
                        {demand.qty ? `(${demand.qty} ${demand.unit || ""})` : ""}
                        {demand.report_count > 1 && (
                          <span className="report-count-badge">
                            {demand.report_count} reports
                          </span>
                        )}
                      </b>
                      <small>
                        ðŸ“ {demand.location_text || demand.camp_id || "Punjab"}
                      </small>
                      <small style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                        <span className={`verify-badge ${demand.verified ? "verified" : "unverified"}`}>
                          {demand.verified ? "âœ“ Verified" : "âš  Unverified"}
                        </span>
                        <span style={{ color: "var(--muted)" }}>â€¢ {demand.source}</span>
                      </small>
                    </span>

                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <Status tone={demand.urgency}>{demand.urgency.toUpperCase()}</Status>
                      {childDups.length > 0 && (
                        <button
                          type="button"
                          className="link"
                          style={{ fontSize: 10, marginTop: 4 }}
                          onClick={(e) => toggleDuplicates(demand.id, e)}
                        >
                          {isExpanded ? `â–² Hide (${childDups.length})` : `â–¼ ${childDups.length} duplicate${childDups.length > 1 ? "s" : ""}`}
                        </button>
                      )}
                    </span>
                  </button>

                  {/* Collapsed Duplicate Reports Under Parent */}
                  {isExpanded && childDups.length > 0 && (
                    <div style={{ background: "rgba(0,0,0,0.03)", borderBottom: "1px solid var(--beige)" }}>
                      {childDups.map((dup) => (
                        <div
                          key={dup.id}
                          className="duplicate-row"
                          style={{ padding: "8px 14px", borderBottom: "1px dashed var(--beige)" }}
                        >
                          <b>â†³ Duplicate report:</b> "{dup.raw_text}"
                          <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                            <span className="verify-badge unverified">âš  Duplicate</span>
                            <span>{dup.source}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </Panel>

        {/* Center-Left: Original Field Report */}
        {selected ? (
          <Panel title="Original field report" className="original-report">
            <blockquote>"{selected.raw_text}"</blockquote>
            <div className="meta-list">
              <span>ðŸ“ {selected.location_text || selected.camp_id || "Punjab"}</span>
              <span>
                â—‰ Source: <b>{selected.source}</b> ({selected.verified ? "Verified feed" : "Public unverified report"})
              </span>
              <span>
                â—· Language: <b>{selected.language.toUpperCase()}</b> â€¢ Provider: <b>{selected.provider}</b>
              </span>
              {selected.report_count > 1 && (
                <span>
                  ðŸ”¥ Aggregation: <b>{selected.report_count} separate reports</b> collapsed into this demand
                </span>
              )}
            </div>

            <h3>Report history</h3>
            <ol className="history">
              <li>
                <b>Step 1</b> Raw text intake received via {selected.source}
                <small>Stored in database draft</small>
              </li>
              <li>
                <b>Step 2</b> Extracted by {selected.provider === "gemini" ? "Gemini AI" : "Rules Engine"}
                <small>Confidence: {(selected.confidence * 100).toFixed(0)}%</small>
              </li>
              <li>
                <b>Step 3</b> Awaiting human verification
                <small>Only coordinators can edit and approve</small>
              </li>
            </ol>
          </Panel>
        ) : null}

        {/* Center-Right: AI Suggested Fields â€” Coordinator Corrections Panel */}
        {selected ? (
          <Panel
            title="Coordinator Corrections & Verification"
            action={
              <span className="provider">
                {selected.provider === "gemini" ? "Parsed: Gemini AI" : "Parsed: Rules"}
              </span>
            }
            className="extract-fields"
          >
            <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 12px" }}>
              Edit extracted fields here if AI misclassified quantity or urgency, then approve to release into matching.
            </p>

            <div className="form-grid three">
              <label className="field">
                <span>Item *</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Quantity *</span>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Unit *</span>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </label>
            </div>

            <div className="form-grid review-row">
              <label className="field">
                <span>Beneficiaries (people)</span>
                <input
                  type="number"
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

            <label className="field" style={{ marginTop: 12 }}>
              <span>Location / Camp Area *</span>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
              />
            </label>

            <div className="confidence">
              <div>
                <b>Confidence score</b>
                <strong>{(selected.confidence * 100).toFixed(0)}%</strong>
              </div>
              <progress
                value={Math.round(selected.confidence * 100)}
                max="100"
                style={{
                  accentColor:
                    selected.confidence >= 0.8 ? "var(--green)" : "var(--amber)",
                }}
              />
              {selected.needs_review && (
                <div className="warning-box">
                  Confidence below 80% â€” verify quantities against original field message before approving.
                </div>
              )}
            </div>

            <label className="field" style={{ marginTop: 12 }}>
              <span>
                Reviewer Notes {rejecting && <b className="danger-text">(rejection reason mandatory)</b>}
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
                âœ• Reject Report
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleApprove}
              >
                âœ“ Approve Demand
              </button>
            </div>
          </Panel>
        ) : null}

        {/* Far-Right: Location & Resolution Preview */}
        {selected ? (
          <Panel title="Location preview" className="review-map">
            <ReliefMap
              locations={locations.filter(
                (l) => l.id === selected.camp_id || l.id === "c17"
              )}
              mode="camps"
              selectedId={selected.camp_id || "c17"}
            />
            <p>
              <span className="dot online" /> Location resolved
            </p>
            <small>
              {selected.location_text || selected.camp_id || "Punjab Area"}
            </small>

            <h3>AI Extraction Details</h3>
            <dl>
              <div>
                <dt>Provider</dt>
                <dd>{selected.provider}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{(selected.confidence * 100).toFixed(0)}%</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{selected.language.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Status</dt>
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
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [notice, setNotice] = useState<Notice>();

  // Edit move dialog state
  const [isEditing, setIsEditing] = useState(false);
  const [editQty, setEditQty] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Reject move dialog state
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const loadPlan = async () => {
    setLoading(true);
    try {
      const res = await api.runMatching();
      if (res.ok && res.data) {
        setPlan(res.data);
        if (!selectedId && res.data.recommendations.length > 0) {
          setSelectedId(res.data.recommendations[0].id);
        }
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to run matching engine." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, []);

  const selectedMove = useMemo(() => {
    if (!plan || !plan.recommendations.length) return null;
    return plan.recommendations.find((m) => m.id === selectedId) || plan.recommendations[0];
  }, [plan, selectedId]);

  // Sync edit form with selected move
  useEffect(() => {
    if (selectedMove) {
      setEditQty(String(selectedMove.qty));
      setEditNotes("");
      setIsEditing(false);
      setIsRejecting(false);
      setRejectReason("");
    }
  }, [selectedMove?.id]);

  const handleApprove = async () => {
    if (!selectedMove) return;
    setActionInProgress(true);
    try {
      const res = await api.approveMove(selectedMove.id);
      if (res.ok) {
        setNotice({
          tone: "success",
          text: `Proposed move ${selectedMove.id} approved. Dispatch authorized.`,
        });
        await loadPlan();
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to approve proposal." });
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedMove) return;
    if (+editQty <= 0) return setNotice({ tone: "error", text: "Enter a valid positive quantity." });
    setActionInProgress(true);
    try {
      const res = await api.editMove(selectedMove.id, {
        qty: parseInt(editQty, 10),
        notes: editNotes.trim() || undefined,
      });
      if (res.ok) {
        setNotice({ tone: "success", text: `Proposal ${selectedMove.id} updated with adjusted quantity.` });
        setIsEditing(false);
        await loadPlan();
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
      return setNotice({ tone: "error", text: "A rejection reason is mandatory before rejecting a proposal." });
    }
    setActionInProgress(true);
    try {
      const res = await api.rejectMove(selectedMove.id, rejectReason.trim());
      if (res.ok) {
        setNotice({ tone: "success", text: `Proposal ${selectedMove.id} rejected.` });
        setIsRejecting(false);
        await loadPlan();
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to reject proposal." });
    } finally {
      setActionInProgress(false);
    }
  };

  // Convert Move to route point for map
  const routeForMap = useMemo(() => {
    if (!selectedMove) return undefined;
    const fromId = selectedMove.stock_id.includes("d1") ? "d1" : selectedMove.stock_id.includes("d2") ? "d2" : selectedMove.stock_id.includes("d3") ? "d3" : selectedMove.stock_id.includes("d4") ? "d4" : "d5";
    const toId = selectedMove.demand_id.includes("c17") ? "c17" : selectedMove.demand_id.includes("c4") ? "c4" : selectedMove.demand_id.includes("c8") ? "c8" : selectedMove.demand_id.includes("c12") ? "c12" : "c21";
    return { fromId, toId };
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
              onClick={loadPlan}
            >
              {loading ? "Calculating..." : "â†» Re-run Matching"}
            </button>
            {selectedMove && selectedMove.state !== "approved" && (
              <button
                className="btn primary"
                disabled={actionInProgress}
                onClick={handleApprove}
              >
                âœ“ Approve Selected Proposal
              </button>
            )}
          </div>
        }
      />

      {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

      {/* Stale Stock Warnings Strip */}
      {plan?.warnings && plan.warnings.length > 0 && (
        <div className="warning-strip">
          <span style={{ fontSize: 16 }}>âš </span>
          <div>
            <b>STALE STOCK WARNINGS:</b>
            {plan.warnings.map((w) => (
              <span key={w.stock_id} style={{ marginLeft: 12 }}>
                â€¢ <b>{w.item}</b> at lot {w.stock_id} ({w.age_hours}h old): {w.message}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="kpi-grid five">
        <Kpi
          icon="â†’"
          value={String(plan?.recommendations.length || 0)}
          label="Proposed moves"
        />
        <Kpi
          icon="âœ“"
          value={String(plan?.recommendations.filter((m) => m.state === "approved").length || 0)}
          label="Approved moves"
        />
        <Kpi
          icon="âš–"
          value={String(plan?.conflicts.length || 0)}
          label="Resolved conflicts"
          note="Three camps, one truck"
        />
        <Kpi
          icon="â–³"
          value={String(plan?.shortages.length || 0)}
          label="Unmet shortages"
        />
        <Kpi
          icon="âˆ¿"
          value="Greedy Matrix"
          label="Solver algorithm"
          note="Haversine x 1.35 road factor"
        />
      </div>

      <div className="matching-grid">
        {/* Left Column: Proposals List */}
        <Panel
          title={`Proposed Dispatch Moves (${plan?.recommendations.length || 0})`}
          className="move-list"
        >
          {!plan?.recommendations.length ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
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
                      Depot: {move.stock_id} â†’ Demand: {move.demand_id}
                    </small>
                    <small>
                      â—· {move.km} km â€¢ {move.eta_h} hr â€¢ {move.vehicle_id}
                    </small>
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
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

        {/* Center: Map Route */}
        <Panel title="Proposed dispatch routes on map" className="match-map">
          <ReliefMap locations={locations} route={routeForMap} selectedId={routeForMap?.toId} />
        </Panel>

        {/* Right Column: Move Proposal Detail & "Why this match" Panel */}
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
            {/* Why This Match Panel */}
            <details open style={{ margin: "10px 0", background: "#fcf9f2" }}>
              <summary style={{ fontSize: 13 }}>ðŸ’¡ Why this match? (Explanation)</summary>
              <blockquote style={{ margin: "8px 0", padding: "10px 12px", textAlign: "left", fontSize: 12 }}>
                "{selectedMove.explain}"
              </blockquote>
              <div style={{ fontSize: 11, color: "var(--muted)", display: "grid", gap: 4 }}>
                <span>â€¢ <b>Road Distance:</b> {selectedMove.km} km ({selectedMove.distance_source})</span>
                <span>â€¢ <b>Estimated Travel Time:</b> {selectedMove.eta_h} hours</span>
                <span>â€¢ <b>Vehicle Type:</b> {selectedMove.vehicle_id} (Trips: {selectedMove.trips})</span>
                <span>â€¢ <b>Match Score:</b> {(selectedMove.score * 100).toFixed(0)}% algorithmic fitness</span>
              </div>
            </details>

            {/* Proposal Details List */}
            <dl>
              <div>
                <dt>Proposal ID</dt>
                <dd><b>{selectedMove.id}</b></dd>
              </div>
              <div>
                <dt>Item & Quantity</dt>
                <dd><b>{selectedMove.qty.toLocaleString()} {selectedMove.item_id}</b></dd>
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
                <dt>Status</dt>
                <dd><b>{selectedMove.state.toUpperCase()}</b></dd>
              </div>
            </dl>

            {/* Edit Proposal Form */}
            {isEditing ? (
              <div style={{ marginTop: 12, padding: 10, background: "#f8f4ec", border: "1px solid var(--beige)" }}>
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
                  <button className="btn secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                  <button className="btn primary" disabled={actionInProgress} onClick={handleSaveEdit}>Save Proposal Changes</button>
                </div>
              </div>
            ) : null}

            {/* Reject Proposal Form */}
            {isRejecting ? (
              <div style={{ marginTop: 12, padding: 10, background: "#fff5f4", border: "1px solid #e8b6b0" }}>
                <b style={{ color: "var(--red)" }}>Reject Proposal (Mandatory Reason)</b>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="State reason why this proposal is rejected..."
                  style={{ minHeight: 50, marginTop: 6 }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn secondary" onClick={() => setIsRejecting(false)}>Cancel</button>
                  <button className="btn danger" disabled={actionInProgress} onClick={handleRejectMove}>Confirm Rejection</button>
                </div>
              </div>
            ) : null}

            {/* Coordinator Action Buttons */}
            {!isEditing && !isRejecting && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setIsEditing(true)}
                >
                  âœŽ Edit Proposal
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => setIsRejecting(true)}
                >
                  âœ• Reject Proposal
                </button>
                <button
                  type="button"
                  className="btn primary full"
                  style={{ gridColumn: "1 / -1", margin: "4px 0" }}
                  disabled={actionInProgress || selectedMove.state === "approved"}
                  onClick={handleApprove}
                >
                  {selectedMove.state === "approved" ? "âœ“ Already Approved" : "âœ“ Approve Proposal"}
                </button>
              </div>
            )}
          </Panel>
        ) : null}
      </div>

      {/* Key Demo: Conflicts Panel ("Three camps, one truck") */}
      <div className="bottom-grid" style={{ marginTop: 14 }}>
        <Panel
          title="Competitive Conflict Resolution ('Three camps, one truck')"
          action={<span className="provider">Algorithm: Strict Priority Matrix</span>}
        >
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 12px 10px" }}>
            When multiple camps compete for the same supply lot, the engine decides based on urgency, remaining hours of safe supply, population, and distance.
          </p>
          <div style={{ padding: "0 12px 12px" }}>
            {plan?.conflicts && plan.conflicts.length > 0 ? (
              plan.conflicts.map((conflict, idx) => (
                <div key={idx} className="conflict-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b>ðŸ“¦ Competing for: {conflict.item}</b>
                    <span className="conflict-winner">
                      ðŸ† Allocated to: {conflict.winner}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, margin: "6px 0", color: "var(--muted)" }}>
                    <b>Competing Camps:</b> {conflict.camps_competing.join(" â€¢ ")}
                  </div>
                  <blockquote style={{ margin: "4px 0", padding: "8px", fontSize: 11, textAlign: "left", background: "#f2ece0" }}>
                    <b>Resolution Rationale:</b> {conflict.reason}
                  </blockquote>
                </div>
              ))
            ) : (
              <div style={{ padding: 12, color: "var(--muted)" }}>No resource conflicts recorded.</div>
            )}
          </div>
        </Panel>

        {/* Shortages and Surplus from the Plan */}
        <Panel title="Shortages & Surplus Overview">
          <div style={{ padding: 12 }}>
            <b style={{ color: "var(--red)", fontSize: 12 }}>Unmet Shortages ({plan?.shortages.length || 0})</b>
            <table style={{ marginTop: 6, marginBottom: 14 }}>
              <thead>
                <tr>
                  <th>Camp</th>
                  <th>Item</th>
                  <th>Requested</th>
                  <th>Available</th>
                  <th>Shortage</th>
                </tr>
              </thead>
              <tbody>
                {plan?.shortages.map((s, i) => (
                  <tr key={i}>
                    <td>{s.camp || s.camp_id || "Camp"}</td>
                    <td>{s.item}</td>
                    <td>{s.requested.toLocaleString()}</td>
                    <td>{s.available.toLocaleString()}</td>
                    <td className="danger-text">{s.shortage.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <b style={{ color: "var(--green)", fontSize: 12 }}>Unassigned Depot Surplus</b>
            <table style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>Depot</th>
                  <th>Item</th>
                  <th>Surplus Qty</th>
                </tr>
              </thead>
              <tbody>
                {plan?.surplus.map((sur, i) => (
                  <tr key={i}>
                    <td>{sur.depot || sur.depot_id || "Depot"}</td>
                    <td>{sur.item}</td>
                    <td><b>{sur.qty.toLocaleString()}</b></td>
                  </tr>
                ))}
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
  const [selectedDepotId, setSelectedDepotId] = useState("d1");
  const [search, setSearch] = useState("");
  const [staleThresholdHours, setStaleThresholdHours] = useState(6);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newText, setNewText] = useState("");
  const [notice, setNotice] = useState<Notice>();

  const loadStock = async () => {
    setLoading(true);
    const res = await api.getStock();
    if (res.ok && res.data) {
      setStockList(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStock();
  }, []);

  const selectedDepot = depots.find((d) => d.id === selectedDepotId) || depots[0];
  const filteredDepots = depots.filter((depot) =>
    depot.name.toLowerCase().includes(search.toLowerCase())
  );

  // Filter supply lots for the selected depot
  const depotLots = useMemo(() => {
    return stockList.filter(
      (lot) => !selectedDepotId || lot.depot_id === selectedDepotId
    );
  }, [stockList, selectedDepotId]);

  const totalUnits = useMemo(() => {
    return stockList.reduce((sum, lot) => sum + (lot.qty || 0), 0);
  }, [stockList]);

  const staleLotsCount = useMemo(() => {
    const now = Date.now();
    return stockList.filter((lot) => {
      const ageHours = (now - new Date(lot.updated_at).getTime()) / (3600 * 1000);
      return ageHours > staleThresholdHours;
    }).length;
  }, [stockList, staleThresholdHours]);

  const handleQuickAddStock = async () => {
    if (!newText.trim()) return;
    try {
      const res = await api.pasteSupply(newText.trim());
      if (res.ok) {
        setNotice({ tone: "success", text: "New stock lot added successfully." });
        setNewText("");
        setShowAddModal(false);
        await loadStock();
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
              â†» Refresh Stock
            </button>
            <button
              className="btn primary"
              onClick={() => setShowAddModal(true)}
            >
              ï¼‹ Add Stock Lot
            </button>
          </div>
        }
      />

      {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}

      {/* Freshness Threshold Controls & Stale Warnings */}
      {staleLotsCount > 0 && (
        <div className="warning-strip">
          <span style={{ fontSize: 16 }}>âš </span>
          <div>
            <b>STALE STOCK ADVISORY:</b> {staleLotsCount} supply lot{staleLotsCount > 1 ? "s" : ""} have not been audited in over {staleThresholdHours} hours.
            Flagged in dispatch proposals: field verification or radio confirmation recommended before dispatching.
          </div>
        </div>
      )}

      <div className="kpi-grid five">
        <Kpi
          icon="â—‡"
          value={totalUnits.toLocaleString()}
          label="Total available stock"
        />
        <Kpi
          icon="â–¥"
          value={String(depots.length)}
          label="Active depots"
        />
        <Kpi
          icon="â–¦"
          value={String(stockList.length)}
          label="Stock lots"
        />
        <Kpi
          icon="âš "
          value={String(staleLotsCount)}
          label="Stale stock lots"
          note={`>${staleThresholdHours}h since audit`}
        />
        <Kpi
          icon="â—·"
          value={`${staleThresholdHours} hours`}
          label="Stale threshold"
          note="Configurable"
        />
      </div>

      {showAddModal && (
        <div className="panel" style={{ padding: 14, marginBottom: 12, background: "#faf6ee" }}>
          <b>Add New Supply Lot via Free Text</b>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 8px" }}>
            Paste unformatted stock receipt (e.g. "Ludhiana Depot: 2000 water bottles, 300 blankets")
          </p>
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Depot name, item, quantity, units..."
            style={{ minHeight: 60 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn primary" onClick={handleQuickAddStock}>Parse & Add Lot</button>
          </div>
        </div>
      )}

      <div className="stock-grid">
        {/* Left: Depots list */}
        <Panel title="Depots" className="depot-list">
          <input
            className="panel-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="âŒ• Search depotsâ€¦"
          />
          {filteredDepots.map((depot) => {
            const isSelected = depot.id === selectedDepotId;
            const depotStock = stockList.filter((s) => s.depot_id === depot.id);
            const lotCount = depotStock.length;
            const depotUnits = depotStock.reduce((sum, s) => sum + (s.qty || 0), 0);

            return (
              <button
                className={isSelected ? "selected" : ""}
                key={depot.id}
                onClick={() => setSelectedDepotId(depot.id)}
              >
                <span>âŒ‚</span>
                <b>
                  {depot.name}
                  <small>{depot.district}, Punjab</small>
                  <small>
                    {lotCount} lot{lotCount === 1 ? "" : "s"} â€¢ {depotUnits.toLocaleString()} units
                  </small>
                </b>
                <i>â€º</i>
              </button>
            );
          })}
        </Panel>

        {/* Center: Depot map */}
        <Panel title="Depot locations" className="stock-map">
          <ReliefMap
            locations={locations}
            mode="depots"
            selectedId={selectedDepotId}
            onSelect={(location) => setSelectedDepotId(location.id)}
          />
        </Panel>

        {/* Right: Selected Depot Inventory & Stale Badges */}
        <Panel
          title={`${selectedDepot.name} Inventory`}
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>Stale threshold:</span>
              <select
                value={staleThresholdHours}
                onChange={(e) => setStaleThresholdHours(parseInt(e.target.value, 10))}
                style={{ height: 26, minHeight: 26, fontSize: 10, padding: "0 6px" }}
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
            ðŸ“ {selectedDepot.district}, Punjab â€¢ Lat: {selectedDepot.lat}, Lng: {selectedDepot.lng}
          </p>
          <div className="tabs mini">
            <button className="active">Supply Lots ({depotLots.length})</button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item & Lot ID</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Last Updated (updated_at)</th>
                <th>Freshness Status</th>
              </tr>
            </thead>
            <tbody>
              {depotLots.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>
                    No supply lots recorded for this depot.
                  </td>
                </tr>
              ) : (
                depotLots.map((lot) => {
                  const now = Date.now();
                  const ageMs = now - new Date(lot.updated_at).getTime();
                  const ageHours = ageMs / (3600 * 1000);
                  const isStale = ageHours > staleThresholdHours;

                  return (
                    <tr key={lot.id}>
                      <td>
                        <b>{lot.item}</b>
                        <small style={{ display: "block", color: "var(--muted)" }}>Lot: {lot.id}</small>
                      </td>
                      <td>
                        <b>{lot.qty.toLocaleString()}</b>
                      </td>
                      <td>{lot.unit}</td>
                      <td>
                        <span title={lot.updated_at}>
                          {new Date(lot.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <small style={{ display: "block", color: "var(--muted)" }}>
                          {ageHours < 1 ? "Just now" : `${ageHours.toFixed(1)}h ago`}
                        </small>
                      </td>
                      <td>
                        {isStale ? (
                          <span
                            className="stale-badge"
                            title={`Updated ${ageHours.toFixed(1)} hours ago (> ${staleThresholdHours}h threshold). Link to matching warning.`}
                          >
                            âš  STALE ({ageHours.toFixed(1)}h)
                          </span>
                        ) : (
                          <span className="status low">âœ“ Fresh</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="stock-bottom">
        <Panel title="Depot capacity & stock distribution">
          <div className="bar-chart">
            {depots.map((depot, index) => (
              <div key={depot.id}>
                <span
                  className="available-bar"
                  style={{ height: `${42 + (4 - index) * 9}%` }}
                />
                <small>{depot.district}</small>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Freshness Audit Guidance">
          <div style={{ padding: 12, fontSize: 11, lineHeight: 1.6, color: "var(--muted)" }}>
            <p>
              <b>Why track updated_at?</b> In rapid flood relief, physical stock fluctuates hourly.
              If a lot's <code>updated_at</code> exceeds <b>{staleThresholdHours} hours</b>, the matching engine
              surfaces a warning banner on proposals to prevent phantom dispatches.
            </p>
            <p style={{ marginTop: 8 }}>
              Coordinators can upload fresh CSV counts or paste WhatsApp inventory updates from warehouse managers at any time.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Needs() {
  const [demandsList, setDemandsList] = useState<Demand[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [expandedDuplicates, setExpandedDuplicates] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<Notice>();

  const loadDemands = async () => {
    const res = await api.getDemands();
    if (res.ok && res.data) {
      setDemandsList(res.data);
      if (!selectedId && res.data.length > 0) {
        setSelectedId(res.data[0].camp_id || res.data[0].id);
      }
    }
  };

  useEffect(() => {
    loadDemands();
  }, []);

  const handleVerifyInline = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.verifyDemand(id);
      if (res.ok) {
        setNotice({ tone: "success", text: "Demand successfully verified and eligible for matching." });
        await loadDemands();
      }
    } catch {
      setNotice({ tone: "error", text: "Failed to verify demand." });
    }
  };

  // Group into parent rows and child duplicates, pin critical to top
  const { parentDemands, duplicateMap } = useMemo(() => {
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

    // Critical urgency pinned to top
    parents.sort((a, b) => {
      if (a.urgency === "critical" && b.urgency !== "critical") return -1;
      if (b.urgency === "critical" && a.urgency !== "critical") return 1;
      return (b.report_count || 1) - (a.report_count || 1);
    });

    return { parentDemands: parents, duplicateMap: dupMap };
  }, [demandsList]);

  return (
    <>
      <PageHeader
        title="Needs Board"
        subtitle="Approved demands, cluster counts, verification status and shortages by camp"
      />
      {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}
      <div className="filters resettable"><Filters includeStatus /><button className="btn secondary" onClick={loadDemands}>â†» Refresh</button></div>
      <div className="kpi-grid five">
        <Kpi icon="â–¤" value={String(demandsList.length)} label="Total demands" />
        <Kpi icon="âœ“" value={String(demandsList.filter(d => d.verified).length)} label="Verified demands" />
        <Kpi icon="âš " value={String(demandsList.filter(d => !d.verified).length)} label="Unverified public" />
        <Kpi icon="â–³" value={String(demandsList.filter(d => d.urgency === "critical").length)} label="Critical demands" />
        <Kpi icon="â—·" value="Auto-sync" label="Backend sync" note="Live API" />
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
                const isSelected = selectedId === demand.camp_id || selectedId === demand.id;
                const isCritical = demand.urgency === "critical";
                const childDups = duplicateMap[demand.id] || [];
                const isExpanded = !!expandedDuplicates[demand.id];

                return (
                  <tr
                    key={demand.id}
                    className={`${isSelected ? "selected-row" : ""} ${isCritical ? "pinned-critical" : ""}`}
                    onClick={() => setSelectedId(demand.camp_id || demand.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <b style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isCritical && <span style={{ color: "var(--red)" }}>ðŸ“Œ</span>}
                        {demand.location_text || demand.camp_id || "Camp Area"}
                      </b>
                      {demand.beneficiaries && <small>{demand.beneficiaries} people</small>}
                    </td>

                    <td>
                      <b>{demand.item || "Relief item"}</b>
                      <div>
                        {demand.qty ? `${demand.qty.toLocaleString()} ${demand.unit || "units"}` : "Unspecified"}
                      </div>
                    </td>

                    <td>
                      <Status tone={demand.urgency}>{demand.urgency.toUpperCase()}</Status>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span className={`verify-badge ${demand.verified ? "verified" : "unverified"}`}>
                          {demand.verified ? "âœ“ Verified" : "âš  Unverified"}
                        </span>
                        <small>{demand.source}</small>
                      </div>
                    </td>

                    <td>
                      {demand.report_count > 1 ? (
                        <span className="report-count-badge">
                          ðŸ”¥ {demand.report_count} reports
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
                              setExpandedDuplicates(prev => ({ ...prev, [demand.id]: !prev[demand.id] }));
                            }}
                          >
                            {isExpanded ? `â–² Collapse (${childDups.length})` : `â–¼ ${childDups.length} duplicate${childDups.length > 1 ? "s" : ""}`}
                          </button>
                        </div>
                      )}
                    </td>

                    <td>
                      {!demand.verified ? (
                        <button
                          type="button"
                          className="mini-btn"
                          style={{ background: "var(--burgundy)", color: "white", borderColor: "var(--burgundy)" }}
                          onClick={(e) => handleVerifyInline(demand.id, e)}
                        >
                          âœ“ Verify
                        </button>
                      ) : (
                        <span style={{ color: "var(--green)", fontSize: 11 }}>Active</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Needs coverage by camp" className="needs-map">
          <ReliefMap locations={locations} mode="camps" selectedId={selectedId} onSelect={(loc) => setSelectedId(loc.id)} />
        </Panel>
      </div>

      <div className="needs-bottom">
        <Panel title="Top needed items">
          <div className="rank-bars">
            {[["Drinking water", 92, 12], ["Tents", 74, 10], ["Food packets", 56, 8], ["Blankets", 42, 6], ["Medical kits", 41, 6], ["Hygiene kits", 34, 5]].map((row) => (
              <div key={row[0]}>
                <span>{row[0]}</span>
                <progress value={row[1] as number} max="100" />
                <b>{row[2]}</b>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Shortage overview (from Matching Engine)">
          <table>
            <thead>
              <tr>
                <th>Camp / Area</th>
                <th>Item</th>
                <th>Requested</th>
                <th>Available</th>
                <th>Shortage</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Camp 17", "Drinking water", "5,000", "1,000", "4,000"],
                ["Camp 21", "Medical kits", "500", "100", "400"],
                ["Camp 4", "Tents", "300", "50", "250"],
                ["Camp 9", "Food packets", "800", "200", "600"],
              ].map((row) => (
                <tr key={row[0] + row[1]}>
                  {row.map((cell, index) => (
                    <td className={index === 4 ? "danger-text" : ""} key={cell}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Recent updates" action={<button className="link" onClick={loadDemands}>Refresh â†’</button>}>
          <div className="updates">
            {[
              ["Camp 17 water report clustered", "30 public reports collapsed into 1 need", "10:32"],
              ["Camp 8 demand flagged for review", "Low confidence extraction (0.65)", "09:50"],
              ["Camp 4 tents approved", "High urgency allocation", "08:32"],
            ].map((row) => (
              <div key={row[0]}>
                <span>âœ“</span>
                <b>
                  {row[0]}
                  <small>{row[1]}</small>
                </b>
                <time>{row[2]}</time>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function OfflineStatus({ reports, refresh, online }: { reports: QueuedReport[]; refresh: () => void; online: boolean }) {
  const [syncing, setSyncing] = useState<string>();
  const retry = async (report: QueuedReport) => {
    if (!online) return;
    setSyncing(report.uuid);
    try { await api.submitReport({ ...report, state: "Sending" }); await removeQueuedReport(report.uuid); await refresh(); } finally { setSyncing(undefined); }
  };
  const retryAll = async () => { for (const report of reports) await retry(report); };
  return <>
    <PageHeader title="Offline Status" subtitle="Reports queued on this device and sync history" actions={<button className="btn secondary" disabled={!online || !reports.length} onClick={retryAll}>â†» Retry all ({reports.length})</button>} />
    <div className="kpi-grid four"><Kpi icon="âŒ" value={String(reports.length)} label="Queued reports" note="Will sync automatically" /><Kpi icon="â‡§" value="12" label="Synced today" note="Last sync: 18 Oct 2026, 10:28" /><Kpi icon="â–³" value={String(reports.filter((report) => report.state === "Failed").length)} label="Failed (retry)" note="Needs attention" /><Kpi icon="â—·" value="18 Oct 2026, 10:28" label="Last successful sync" note="Auto-sync enabled" /></div>
    <div className="offline-grid">
      <Panel title={`Queued reports (${reports.length})`} action={<Select><option>Oldest first</option><option>Newest first</option></Select>} className="queue-list">{!reports.length ? <div className="empty">All reports are synced.</div> : reports.map((report) => <div key={report.uuid} className="queue-item"><span className="queue-icon">â–¤</span><b>{report.text}<small>{report.camp} &nbsp;Â·&nbsp; {report.district}</small><small>{new Date(report.createdAt).toLocaleString()}</small><Status tone={report.state === "Failed" ? "failed" : "queued"}>{report.state === "Waiting" ? "Queued (offline)" : report.state}</Status>{report.error && <small className="danger-text">{report.error}</small>}</b><button className="btn secondary" disabled={!online || syncing === report.uuid} onClick={() => retry(report)}>{syncing === report.uuid ? "Sendingâ€¦" : "Retry"}</button><button className="more">â‹®</button></div>)}</Panel>
      <Panel title="Sync history" action={<button className="link">View all â†’</button>}><table><thead><tr><th>Time</th><th>Event</th><th>Details</th><th>Status</th></tr></thead><tbody>{[["10:28", "3 reports synced", "Queued reports sent to server", "Success"], ["10:15", "1 report failed", "Network error (timeout)", "Failed"], ["09:50", "5 reports synced", "Field intake reports", "Success"], ["08:32", "2 reports queued", "Device was offline", "Queued"], ["08:10", "4 reports synced", "Auto sync after reconnection", "Success"]].map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td><Status>{row[3]}</Status></td></tr>)}</tbody></table></Panel>
    </div>
    <div className="offline-bottom"><Panel title="Device status"><div className="device"><div><span className={`dot ${online ? "online" : ""}`} /><b>{online ? "Online" : "Offline"}</b><small>{online ? "Connected to server" : "Waiting for connection"}</small></div><p>Device ID<br /><b>a3f1-9c7d-4b2e-8f6a</b><br /><br />App version<br />v1.0.0 (offline enabled)</p></div></Panel><Panel title="Storage usage (offline)"><div className="storage"><progress value="12" max="50" /><span>12 MB / 50 MB</span></div><p>Stores reports, photos and form data until synced.</p></Panel><Panel title="Offline mode"><div className="offline-explain"><span>âŒ</span><p>You can keep submitting reports while offline. They will be saved on this device and sent automatically when you are back online.<br /><button className="link">Learn more â†’</button></p></div></Panel></div>
  </>;
}

export default function App() {
  const pageFromHash = window.location.hash.replace("#/", "") as PageKey;
  const [page, setPageState] = useState<PageKey>(NAV.some((item) => item.key === pageFromHash) ? pageFromHash : "dashboard");
  const online = useConnectivity();
  const queue = useQueue();
  const previousOnline = useRef(online);
  const setPage = (next: PageKey) => { setPageState(next); window.location.hash = `/${next}`; window.scrollTo(0, 0); };
  useEffect(() => {
    const onHash = () => { const next = window.location.hash.replace("#/", "") as PageKey; if (NAV.some((item) => item.key === next)) setPageState(next); };
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
  const content = useMemo(() => {
    switch (page) {
      case "dashboard": return <Dashboard go={setPage} online={online} />;
      case "intake": return <Intake online={online} onQueued={queue.refresh} />;
      case "review": return <ReviewQueue />;
      case "matching": return <Matching />;
      case "stock": return <Stock />;
      case "needs": return <Needs />;
      case "offline": return <OfflineStatus reports={queue.reports} refresh={queue.refresh} online={online} />;
    }
  }, [page, online, queue.reports]);
  if (
    page === "public" ||
    pageFromHash === "public" ||
    window.location.hash === "#/public" ||
    window.location.pathname.startsWith("/public")
  ) {
    return <PublicReport />;
  }

  return (
    <AppShell page={page} setPage={setPage} online={online} queueCount={queue.reports.length}>
      <div className="mock-label">{MOCK_MODE && "Mock data mode"}</div>
      {content}
    </AppShell>
  );
}

