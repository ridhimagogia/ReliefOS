import { useEffect, useMemo, useRef, useState } from "react";
import ReliefMap from "./components/ReliefMap";
import { demands, depots, inventory, locations, moves, reviewReports, type Urgency } from "./data/mockData";
import { api, MOCK_MODE } from "./services/api";
import { getQueuedReports, queueReport, removeQueuedReport, seedDemoQueue, type QueuedReport } from "./offline/reportQueue";

type PageKey = "dashboard" | "intake" | "review" | "matching" | "stock" | "needs" | "offline";
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
  return <span className={`status ${tone || String(children).toLowerCase().replaceAll(" ", "-")}`}>{children}</span>;
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
  const content = <><span className="kpi-icon">{icon}</span><div><b>{value}</b><span>{label}</span>{note && <small>{note}</small>}</div>{onClick && <span className="kpi-arrow">›</span>}</>;
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
      <button type="button" className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">☰</button>
      <aside className={mobileOpen ? "open" : ""}>
        <div className="brand">Relief<span>OS</span><small>Disaster Relief Coordination</small></div>
        <nav aria-label="Primary navigation">
          {NAV.map((item) => <button type="button" className={page === item.key ? "active" : ""} key={item.key} onClick={() => { setPage(item.key); setMobileOpen(false); }}><i>{item.glyph}</i>{item.label}{item.key === "review" && <em>7</em>}</button>)}
        </nav>
        <div className="sidebar-art"><div className="monument" aria-hidden="true">⌂ ◇ ⌂</div><b>ReliefOS</b><span>Safer communities.<br />Stronger tomorrows.</span></div>
      </aside>
      <div className="app-main">
        <header>
          <div className="crumb"><span>⌂</span> Operations <b>/</b> <strong>{TITLES[page]}</strong></div>
          <div className="account"><span className={online ? "dot online" : "dot"} /> {online ? "Online" : "Offline"}<button type="button" onClick={() => setPage("offline")}>⌘ Queued: {queueCount}</button><span className="bell">♧</span><span className="avatar">AJ</span><span className="account-name">Aastha Jha</span></div>
        </header>
        {!online && <div className="offline-banner">You are offline. New field reports will be stored securely on this device and sent when connectivity returns.</div>}
        <div className="demo-ribbon">ⓘ &nbsp; SIMULATED DATA — DEMO ENVIRONMENT</div>
        <main>{children}</main>
      </div>
    </div>
  );
}

function Dashboard({ go, online }: { go: (page: PageKey) => void; online: boolean }) {
  const [updated, setUpdated] = useState(new Date());
  useEffect(() => { const timer = window.setInterval(() => setUpdated(new Date()), 5000); return () => clearInterval(timer); }, []);
  return <>
    <PageHeader title="Command dashboard" subtitle="Punjab relief operations" actions={<><span className="updated">Last updated {updated.toLocaleTimeString()} · Auto-refresh 5s</span><button className="btn secondary" onClick={() => setUpdated(new Date())}>↻ Refresh</button></>} />
    <div className="kpi-grid five"><Kpi icon="◇" value="12,480" label="Available stock" /><Kpi icon="♧" value="38" label="Active demands" /><Kpi icon="▤" value="7" label="Pending reviews" onClick={() => go("review")} /><Kpi icon="△" value="4" label="Critical shortages" /><Kpi icon="∿" value={online ? "Online" : "Offline"} label="System mode" /></div>
    <Filters />
    <div className="dashboard-grid">
      <Panel title="Punjab: Depots and Camps" className="map-panel"><ReliefMap locations={locations} route={moves[0]} /></Panel>
      <div className="stack">
        <Panel title="Pending reviews" action={<button className="link" onClick={() => go("review")}>View all →</button>}>
          <div className="compact-list">{reviewReports.slice(0, 3).map((report) => <button key={report.id} onClick={() => go("review")}><span>▤</span><b>{report.title}<small>{report.camp} · {report.district}</small></b><time>{report.time}</time><Status tone={report.urgency.toLowerCase()}>{report.urgency}</Status><i>›</i></button>)}</div>
        </Panel>
        <Panel title="Critical shortages" action={<button className="link" onClick={() => go("needs")}>View all →</button>}>
          <table><thead><tr><th>Item</th><th>Missing quantity</th><th>Camp</th></tr></thead><tbody>{[["Drinking water", "5,000 units", "Camp 17"], ["Tents", "200 units", "Camp 4"], ["Medical kits", "150 units", "Camp 8"], ["Food packets", "1,200 units", "Camp 12"]].map((row) => <tr key={row[0]}><td>{row[0]}</td><td className="danger-text">{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table>
        </Panel>
        <Panel title="Quick actions"><div className="quick-actions"><button className="btn primary" onClick={() => go("intake")}>▤ New report</button><button className="btn secondary" onClick={() => go("matching")}>⌘ Run matching</button></div></Panel>
      </div>
    </div>
    <Panel title="Recent activity" action={<button className="link">View all →</button>}><table><thead><tr><th>Time</th><th>Event</th><th>Details</th><th>Status</th></tr></thead><tbody><tr><td>10:41</td><td>Report approved</td><td>Camp 9 — 300 food packets</td><td><Status>Approved</Status></td></tr><tr><td>10:37</td><td>Stock reserved</td><td>500 water units from Ludhiana depot</td><td><Status>Reserved</Status></td></tr><tr><td>10:35</td><td>New report received</td><td>Camp 21 — medical supplies</td><td><Status>Pending review</Status></td></tr></tbody></table></Panel>
  </>;
}

function Intake({ online, onQueued }: { online: boolean; onQueued: () => void }) {
  const MAX = 500;
  const [text, setText] = useState("");
  const [source, setSource] = useState("Field form (on site)");
  const [district, setDistrict] = useState("");
  const [camp, setCamp] = useState("");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!text.trim()) return setError("Enter a report message before submitting.");
    if (text.length > MAX) return setError(`Report messages must be ${MAX} characters or fewer.`);
    if (!district || !camp) return setError("Select both a district and camp / area.");
    setError(""); setSending(true);
    const report: QueuedReport = { uuid: crypto.randomUUID(), createdAt: new Date().toISOString(), text, source, district, camp, state: "Waiting" };
    try {
      if (!online) throw new Error("offline");
      await api.submitReport(report);
      setNotice({ tone: "success", text: "Report received, waiting for review" });
      setText("");
    } catch {
      await queueReport(report);
      onQueued();
      setNotice({ tone: "info", text: "You are offline. This report is queued and will send automatically." });
    } finally { setSending(false); }
  };
  return <>
    <PageHeader title="Field Report Intake" subtitle="Submit a field report from the ground" actions={<button className="btn secondary">▢ View guidelines</button>} />
    {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}
    <div className="intake-grid">
      <Panel className="form-panel" title="1  Report details" action={<div className="language"><button className="active">English</button><button>Hinglish (हिंग्लिश)</button></div>}>
        <label className="field"><span>Report message *</span><textarea value={text} maxLength={MAX + 50} onChange={(event) => setText(event.target.value)} placeholder="Example: Camp 17 needs drinking water for approximately 600 people." /><small>{text.length}/{MAX} characters</small></label>
        {error && <div className="field-error">{error}</div>}
        <div className="examples"><b>Quick examples</b><div>{["Drinking water needed", "Tents for displaced families", "Medical supplies required"].map((example) => <button key={example} onClick={() => setText(example)}>{example}</button>)}</div></div>
        <div className="form-grid">
          <Select label="Source *" value={source} onChange={setSource}><option>Field form (on site)</option><option>Pasted SMS</option><option>Pasted WhatsApp</option></Select>
          <label className="field"><span>Location *</span><button type="button" className="location-btn" onClick={() => { setDistrict("Gurdaspur"); setCamp("Camp 17"); }}>⌖ Use my location</button></label>
          <Select label="District *" value={district} onChange={setDistrict}><option value="">Select district</option><option>Gurdaspur</option><option>Ludhiana</option><option>Firozpur</option><option>Hoshiarpur</option></Select>
          <Select label="Camp / Area *" value={camp} onChange={setCamp}><option value="">Select camp / area</option><option>Camp 17</option><option>Camp 4</option><option>Camp 8</option><option>Camp 12</option></Select>
        </div>
        <label className="field"><span>Add photo or file (optional)</span><div className="upload"><input type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={(event) => setFile(event.target.files?.[0])} /><b>↑</b><span>{file ? file.name : "Click to upload or drag and drop"}</span><small>PNG, JPG, or PDF (Max 5 MB)</small>{file && <button type="button" onClick={() => setFile(undefined)}>Remove</button>}</div></label>
        <div className="form-actions"><button className="btn secondary" onClick={() => { setText(""); setError(""); setFile(undefined); }}>× Clear</button><button className="btn primary sticky-submit" disabled={sending} onClick={submit}>{sending ? "Sending…" : "◇ Submit report"}</button></div>
      </Panel>
      <div className="stack">
        <Panel title="2  Preview & validate" action={<Status tone={text.trim() ? "approved" : "waiting"}>{text.trim() ? "Looks good" : "Waiting"}</Status>}>
          <div className="report-preview"><strong>▤ &nbsp; {text || "Your report preview will appear here."}</strong><dl><div><dt>Source</dt><dd>{source}</dd></div><div><dt>Location</dt><dd>{district ? "30.7333° N, 76.7794° E" : "Not selected"}</dd></div><div><dt>District</dt><dd>{district || "—"}</dd></div><div><dt>Camp / Area</dt><dd>{camp || "—"}</dd></div><div><dt>Photo</dt><dd>{file ? "1 file selected" : "None"}</dd></div></dl></div>
        </Panel>
        <Panel title="3  Submission status"><div className="timeline"><div className="done">✓<span>Sending</span></div><i /><div>○<span>Sent</span></div><i /><div>○<span>Pending review</span></div><i /><div>○<span>Approved / Rejected</span></div></div><div className="info-box">ⓘ If you are offline, this report will be saved on this device and sent automatically when you are back online.</div></Panel>
        <Panel title="Recent submissions" action={<button className="link">View all →</button>}><table><thead><tr><th>Time</th><th>Message (preview)</th><th>Location</th><th>Status</th></tr></thead><tbody><tr><td>10:41</td><td>Tents needed for 200 people…</td><td>Camp 4</td><td><Status>Sent</Status></td></tr><tr><td>09:28</td><td>Medical supplies required…</td><td>Camp 8</td><td><Status>Pending review</Status></td></tr><tr><td>Yesterday</td><td>Drinking water for 600 people…</td><td>Camp 17</td><td><Status>Approved</Status></td></tr></tbody></table></Panel>
      </div>
    </div>
  </>;
}

function ReviewQueue() {
  const [tab, setTab] = useState("Pending");
  const [selected, setSelected] = useState(reviewReports[0]);
  const [quantity, setQuantity] = useState("600");
  const [beneficiaries, setBeneficiaries] = useState("600");
  const [urgency, setUrgency] = useState<Urgency>("Critical");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [rejecting, setRejecting] = useState(false);
  const act = async (action: "approve" | "reject") => {
    if (+quantity <= 0 || !selected.camp) return setNotice({ tone: "error", text: "Quantity and location are required." });
    if (action === "reject" && !notes.trim()) { setRejecting(true); return setNotice({ tone: "error", text: "Add a rejection reason in reviewer notes." }); }
    action === "approve" ? await api.approveReport(selected.id) : await api.rejectReport(selected.id, notes);
    setNotice({ tone: "success", text: `Report ${action === "approve" ? "approved and eligible for matching" : "rejected"}.` });
    setRejecting(false);
  };
  return <>
    <PageHeader title="Review Queue" subtitle="Verify extracted requests before they count as demand." actions={<div className="mini-kpis"><Kpi icon="▤" value="7" label="awaiting review" /><Kpi icon="△" value="2" label="low confidence" /></div>} />
    {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}
    <div className="review-tools"><div className="tabs">{["Pending", "Approved", "Rejected"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item} ({item === "Pending" ? 7 : item === "Approved" ? 12 : 3})</button>)}</div><div className="search"><input placeholder="Search reports (camp, location, keyword…)" /><button className="btn secondary">▽ Filter</button></div></div>
    <div className="review-layout">
      <Panel className="review-list">{reviewReports.map((report) => <button key={report.id} className={selected.id === report.id ? "selected" : ""} onClick={() => setSelected(report)}><i className={`urgency-dot ${report.urgency.toLowerCase()}`} /><span><b>{report.title}</b><small>{report.camp} — {report.district}</small><small>{report.source}</small></span><span><Status tone={report.urgency.toLowerCase()}>{report.urgency}</Status><time>{report.time}</time></span></button>)}</Panel>
      <Panel title="Original field report" className="original-report"><blockquote>{selected.id === 1 ? "Camp 17 needs drinking water for approximately 600 people. Families have been waiting since yesterday." : selected.title}</blockquote><div className="meta-list"><span>⌖ {selected.camp}, {selected.district}</span><span>◉ {selected.source}</span><span>◷ Submitted: {selected.time}, 18 Oct 2026</span><span>♙ Reported by: Field Worker (ID: FW1023)</span></div><h3>Report history</h3><ol className="history"><li><b>10:32 AM</b> Report submitted (offline)<small>Queued on device (no internet)</small></li><li><b>11:05 AM</b> Received by server<small>AI extraction completed</small></li><li><b>11:05 AM</b> Added to review queue<small>Awaiting human verification</small></li></ol><h3>Attached files (1)</h3><div className="attachment">▧ <span><b>IMG_20261018_1032.jpg</b><small>2.4 MB · Image</small></span></div></Panel>
      <Panel title="AI suggested fields — verify before approval" action={<span className="provider">Parsed by: Rules</span>} className="extract-fields">
        <div className="form-grid three"><Select label="Item category *"><option>Drinking water</option><option>Tents</option></Select><label className="field"><span>Quantity *</span><input type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><Select label="Unit *"><option>units</option><option>litres</option></Select></div>
        <div className="form-grid review-row"><label className="field"><span>Beneficiaries (people) *</span><input type="number" value={beneficiaries} onChange={(event) => setBeneficiaries(event.target.value)} /></label><div className="field"><span>Urgency *</span><div className="urgency-buttons">{(["Critical", "High", "Medium", "Low"] as Urgency[]).map((item) => <button className={urgency === item ? "active" : ""} onClick={() => setUrgency(item)} key={item}>{item}</button>)}</div></div></div>
        <Select label="Location *"><option>{selected.camp} — {selected.district}</option></Select>
        <div className="confidence"><div><b>Confidence score</b><strong>0.62</strong></div><progress value="62" max="100" /><div className="warning-box">Low confidence — please verify the extracted fields.</div></div>
        <label className="field"><span>Notes {rejecting && "(rejection reason required)"}</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add any notes about this report…" /></label>
        <div className="review-actions"><button className="btn secondary" onClick={() => setNotice({ tone: "success", text: "Edits saved." })}>Save edits</button><button className="btn danger" onClick={() => act("reject")}>Reject</button><button className="btn primary" onClick={() => act("approve")}>Approve report</button></div>
      </Panel>
      <Panel title="Location preview" className="review-map"><ReliefMap locations={locations.filter((item) => item.id === "c17")} mode="camps" selectedId="c17" /><p><span className="dot online" /> Location resolved</p><small>{selected.camp}, {selected.district}<br />Punjab</small><h3>AI extraction details</h3><dl><div><dt>Provider</dt><dd>Rules</dd></div><div><dt>Confidence</dt><dd>0.62</dd></div><div><dt>Extracted at</dt><dd>11:05 AM</dd></div><div><dt>Language</dt><dd>English</dd></div></dl></Panel>
    </div>
  </>;
}

function Matching() {
  const [selected, setSelected] = useState(moves[0]);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const run = async () => { setProcessing(true); await api.runMatching(); setProcessing(false); setNotice({ tone: "success", text: "Matching refreshed with 28 recommended moves." }); };
  const approve = async () => { setProcessing(true); try { await api.approveMove(selected.id); setNotice({ tone: "success", text: "Move approved. Stock and demand coverage have been refreshed." }); } catch { setNotice({ tone: "error", text: "The move could not be approved." }); } finally { setProcessing(false); } };
  return <>
    <PageHeader title="Matching Results" subtitle="Recommended moves to meet approved demands" actions={<><button className="btn secondary" disabled={processing} onClick={run}>↻ Re-run matching</button><button className="btn primary" disabled={processing} onClick={approve}>✓ Approve selected move</button></>} />
    {notice && <div className={`notice ${notice.tone}`}>{notice.text}</div>}
    <div className="kpi-grid five"><Kpi icon="▣" value="12" label="Approved demands" /><Kpi icon="→" value="28" label="Recommended moves" /><Kpi icon="▤" value="4" label="Needs manual review" /><Kpi icon="◔" value="92%" label="Estimated coverage" /><Kpi icon="□" value="10:42" label="Last matching run" note="18 Oct 2026" /></div><Filters />
    <div className="matching-grid">
      <Panel title="Recommended moves (28)" action={<Select><option>Priority (High to Low)</option></Select>} className="move-list">{moves.map((move, index) => <button key={move.id} className={selected.id === move.id ? "selected" : ""} onClick={() => setSelected(move)}><em>{index + 1}</em><span><b>{move.item} → {move.to}</b><small>{move.from} → {move.to} ({move.district})</small><small>◷ {move.distance} km &nbsp; · &nbsp; {move.time} hr &nbsp; · &nbsp; {move.vehicle}</small></span><Status tone={move.urgency.toLowerCase()}>{move.urgency}</Status><i>›</i></button>)}</Panel>
      <Panel title="Recommended moves on map" className="match-map"><ReliefMap locations={locations} route={selected} selectedId={selected.toId} /></Panel>
      <Panel title={`${selected.item} → ${selected.to}`} action={<Status tone={selected.urgency.toLowerCase()}>{selected.urgency}</Status>} className="move-detail"><div className="tabs mini"><button className="active">Details</button><button>Route</button><button>Items</button><button>Demand</button></div><dl>{[["From", selected.from], ["To", `${selected.to} (${selected.district})`], ["Distance", `${selected.distance} km (est.)`], ["Travel time", `${selected.time} hours (est.)`], ["Distance source", selected.source], ["Item", selected.item], ["Transport", selected.vehicle], ["Demand status", "Approved"], ["Coverage after move", `${selected.coverage}%`]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><details open><summary>Why this move?</summary><p>Recommended because this depot has sufficient stock, a shorter estimated route, and serves a high-urgency demand.</p></details><div className="score-bars"><span>Urgency <progress max="100" value="95" /></span><span>Fill <progress max="100" value="100" /></span><span>Proximity <progress max="100" value="82" /></span></div><button className="btn primary full" disabled={processing} onClick={approve}>{processing ? "Approving…" : "✓ Approve move"}</button></Panel>
    </div>
    <div className="bottom-grid"><Panel title="Alternative matches"><table><thead><tr><th>Depot</th><th>Distance</th><th>Travel time</th><th>Available stock</th><th>Coverage</th><th /></tr></thead><tbody>{depots.slice(1, 4).map((depot, index) => <tr key={depot.id}><td>{depot.name}</td><td>{45 + index * 17} km</td><td>{6 + index} hr</td><td>{depot.units.toLocaleString()} units</td><td><progress value={100 - index * 10} max="100" /> {100 - index * 10}%</td><td><button className="mini-btn">Select</button></td></tr>)}</tbody></table></Panel><Panel title="AI matching reasoning (simulated)"><ul className="reasoning"><li>{selected.from} has sufficient available stock.</li><li>Shortest estimated distance is {selected.distance} km.</li><li>{selected.to} has {selected.urgency.toLowerCase()} urgency.</li><li>Other depots are farther or have lower stock.</li></ul></Panel></div>
  </>;
}

function Stock() {
  const [selected, setSelected] = useState(depots[0]);
  const [search, setSearch] = useState("");
  const filtered = depots.filter((depot) => depot.name.toLowerCase().includes(search.toLowerCase()));
  return <>
    <PageHeader title="Stock & Depots" subtitle="View stock levels, reservations and depot details" actions={<button className="btn primary">＋ Add stock entry</button>} />
    <div className="kpi-grid five"><Kpi icon="◇" value="12,480" label="Total available stock" /><Kpi icon="▽" value="3,240" label="Reserved units" /><Kpi icon="▥" value="5" label="Depots" /><Kpi icon="▦" value="28" label="Stock items" /><Kpi icon="◷" value="10:42" label="Last updated" note="18 Oct 2026" /></div>
    <div className="stock-grid">
      <Panel title="Depots" className="depot-list"><input className="panel-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="⌕ Search depots…" />{filtered.map((depot) => <button className={depot.id === selected.id ? "selected" : ""} key={depot.id} onClick={() => setSelected(depot)}><span>⌂</span><b>{depot.name}<small>{depot.district}, Punjab</small><small>{depot.items} items · {depot.units.toLocaleString()} units</small></b><i>›</i></button>)}</Panel>
      <Panel title="Depot locations" className="stock-map"><ReliefMap locations={locations} mode="depots" selectedId={selected.id} onSelect={(location) => { const depot = depots.find((item) => item.id === location.id); if (depot) setSelected(depot); }} /></Panel>
      <Panel title={selected.name} action={<button className="btn secondary">✎ Edit depot</button>} className="inventory"><p>⌖ {selected.district}, Punjab</p><div className="tabs mini"><button className="active">Stock items</button><button>Details</button><button>Activity</button></div><table><thead><tr><th>Item</th><th>Available</th><th>Reserved</th><th>Total</th><th>Last updated</th></tr></thead><tbody>{inventory.map((row) => <tr key={row.item}><td>{row.item}</td><td>{row.available.toLocaleString()}</td><td className="danger-text">{row.reserved.toLocaleString()}</td><td><b>{row.total.toLocaleString()}</b></td><td>{row.updated}</td></tr>)}</tbody></table></Panel>
    </div>
    <div className="stock-bottom"><Panel title="Stock distribution across depots"><div className="bar-chart">{depots.map((depot, index) => <div key={depot.id}><span className="available-bar" style={{ height: `${42 + (4 - index) * 9}%` }} /><span className="reserved-bar" style={{ height: `${12 + index * 2}%` }} /><small>{depot.district}</small></div>)}</div></Panel><Panel title="Low stock / Out of stock (5)" action={<button className="link">View all →</button>}><table><thead><tr><th>Item</th><th>Depot</th><th>Available</th><th>Status</th></tr></thead><tbody>{[["Tents", "Camp 4", "20", "Low stock"], ["Medical kits", "Camp 8", "0", "Out of stock"], ["Food packets", "Camp 21", "50", "Low stock"], ["Blankets", "Camp 17", "0", "Out of stock"]].map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td className="danger-text">{row[2]}</td><td><Status>{row[3]}</Status></td></tr>)}</tbody></table></Panel></div>
  </>;
}

function Needs() {
  const [selectedId, setSelectedId] = useState<string>();
  return <>
    <PageHeader title="Needs Board" subtitle="Approved demands, coverage and shortages by camp" />
    <div className="filters resettable"><Filters includeStatus /><button className="btn secondary">Reset</button></div>
    <div className="kpi-grid five"><Kpi icon="▤" value="38" label="Total approved demands" /><Kpi icon="♧" value="32" label="Partially / fully covered" /><Kpi icon="△" value="6" label="With shortages" /><Kpi icon="◔" value="84%" label="Need coverage (avg.)" /><Kpi icon="◷" value="10:42" label="Last updated" note="18 Oct 2026" /></div>
    <div className="needs-grid">
      <Panel title="Demands by camp (38)"><table className="demand-table"><thead><tr><th>Camp / Area</th><th>District</th><th>People</th><th>Top needs</th><th>Coverage</th><th>Status</th><th /></tr></thead><tbody>{demands.map((demand) => <tr key={demand.id} className={selectedId === demand.id ? "selected-row" : ""}><td>{demand.name}</td><td>{demand.district}</td><td>{demand.population}</td><td>{demand.needs?.join(", ")}</td><td><progress value={demand.coverage} max="100" /> {demand.coverage}%</td><td><Status tone={demand.coverage === 100 ? "approved" : demand.coverage! < 50 ? "critical" : "medium"}>{demand.coverage === 100 ? "Fulfilled" : demand.coverage! < 50 ? "Open" : "Partial"}</Status></td><td><button onClick={() => setSelectedId(demand.id)}>›</button></td></tr>)}</tbody></table></Panel>
      <Panel title="Needs coverage by camp" className="needs-map"><ReliefMap locations={locations} mode="camps" selectedId={selectedId} onSelect={(location) => setSelectedId(location.id)} /></Panel>
    </div>
    <div className="needs-bottom"><Panel title="Top needed items"><div className="rank-bars">{[["Drinking water", 92, 12], ["Tents", 74, 10], ["Food packets", 56, 8], ["Blankets", 42, 6], ["Medical kits", 41, 6], ["Hygiene kits", 34, 5]].map((row) => <div key={row[0]}><span>{row[0]}</span><progress value={row[1] as number} max="100" /><b>{row[2]}</b></div>)}</div></Panel><Panel title="Shortage overview (6)"><table><thead><tr><th>Camp / Area</th><th>Item</th><th>Requested</th><th>Available</th><th>Shortage</th></tr></thead><tbody>{[["Camp 17", "Drinking water", "5,000", "1,000", "4,000"], ["Camp 21", "Medical kits", "500", "100", "400"], ["Camp 4", "Tents", "300", "50", "250"], ["Camp 9", "Food packets", "800", "200", "600"]].map((row) => <tr key={row[0] + row[1]}>{row.map((cell, index) => <td className={index === 4 ? "danger-text" : ""} key={cell}>{cell}</td>)}</tr>)}</tbody></table></Panel><Panel title="Recent updates" action={<button className="link">View all →</button>}><div className="updates">{[["Camp 8 demand approved", "Medical kits – 300 units", "10:28"], ["Camp 17 shortage flagged", "Drinking water – 4,000 units", "09:50"], ["Camp 3 fully covered", "Water, Hygiene", "08:32"], ["Camp 21 updated", "Medical, Water", "08:10"]].map((row) => <div key={row[0]}><span>✓</span><b>{row[0]}<small>{row[1]}</small></b><time>{row[2]}</time></div>)}</div></Panel></div>
  </>;
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
    <PageHeader title="Offline Status" subtitle="Reports queued on this device and sync history" actions={<button className="btn secondary" disabled={!online || !reports.length} onClick={retryAll}>↻ Retry all ({reports.length})</button>} />
    <div className="kpi-grid four"><Kpi icon="⌁" value={String(reports.length)} label="Queued reports" note="Will sync automatically" /><Kpi icon="⇧" value="12" label="Synced today" note="Last sync: 18 Oct 2026, 10:28" /><Kpi icon="△" value={String(reports.filter((report) => report.state === "Failed").length)} label="Failed (retry)" note="Needs attention" /><Kpi icon="◷" value="18 Oct 2026, 10:28" label="Last successful sync" note="Auto-sync enabled" /></div>
    <div className="offline-grid">
      <Panel title={`Queued reports (${reports.length})`} action={<Select><option>Oldest first</option><option>Newest first</option></Select>} className="queue-list">{!reports.length ? <div className="empty">All reports are synced.</div> : reports.map((report) => <div key={report.uuid} className="queue-item"><span className="queue-icon">▤</span><b>{report.text}<small>{report.camp} &nbsp;·&nbsp; {report.district}</small><small>{new Date(report.createdAt).toLocaleString()}</small><Status tone={report.state === "Failed" ? "failed" : "queued"}>{report.state === "Waiting" ? "Queued (offline)" : report.state}</Status>{report.error && <small className="danger-text">{report.error}</small>}</b><button className="btn secondary" disabled={!online || syncing === report.uuid} onClick={() => retry(report)}>{syncing === report.uuid ? "Sending…" : "Retry"}</button><button className="more">⋮</button></div>)}</Panel>
      <Panel title="Sync history" action={<button className="link">View all →</button>}><table><thead><tr><th>Time</th><th>Event</th><th>Details</th><th>Status</th></tr></thead><tbody>{[["10:28", "3 reports synced", "Queued reports sent to server", "Success"], ["10:15", "1 report failed", "Network error (timeout)", "Failed"], ["09:50", "5 reports synced", "Field intake reports", "Success"], ["08:32", "2 reports queued", "Device was offline", "Queued"], ["08:10", "4 reports synced", "Auto sync after reconnection", "Success"]].map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td><Status>{row[3]}</Status></td></tr>)}</tbody></table></Panel>
    </div>
    <div className="offline-bottom"><Panel title="Device status"><div className="device"><div><span className={`dot ${online ? "online" : ""}`} /><b>{online ? "Online" : "Offline"}</b><small>{online ? "Connected to server" : "Waiting for connection"}</small></div><p>Device ID<br /><b>a3f1-9c7d-4b2e-8f6a</b><br /><br />App version<br />v1.0.0 (offline enabled)</p></div></Panel><Panel title="Storage usage (offline)"><div className="storage"><progress value="12" max="50" /><span>12 MB / 50 MB</span></div><p>Stores reports, photos and form data until synced.</p></Panel><Panel title="Offline mode"><div className="offline-explain"><span>⌁</span><p>You can keep submitting reports while offline. They will be saved on this device and sent automatically when you are back online.<br /><button className="link">Learn more →</button></p></div></Panel></div>
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
      const queued = await getQueuedReports();
      for (const report of queued.filter((item) => item.state !== "Failed")) {
        try { await api.submitReport(report); await removeQueuedReport(report.uuid); } catch { break; }
      }
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
  return <AppShell page={page} setPage={setPage} online={online} queueCount={queue.reports.length}><div className="mock-label">{MOCK_MODE && "Mock data mode"}</div>{content}</AppShell>;
}
