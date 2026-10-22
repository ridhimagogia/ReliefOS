export type QueuedReport = {
  uuid: string;
  createdAt: string;
  text: string;
  source: string;
  camp?: string;
  district?: string;
  state: "Waiting" | "Sending" | "Failed";
  error?: string;
};

const DB_NAME = "reliefos-offline";
const STORE = "reports";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "uuid" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueReport(report: QueuedReport) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(report);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
  window.dispatchEvent(new Event("reliefos-queue"));
}

export async function getQueuedReports(): Promise<QueuedReport[]> {
  const db = await openDb();
  const reports = await new Promise<QueuedReport[]>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return reports.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeQueuedReport(uuid: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(uuid);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
  window.dispatchEvent(new Event("reliefos-queue"));
}

export async function seedDemoQueue() {
  const existing = await getQueuedReports();
  if (existing.length || localStorage.getItem("reliefos-seeded")) return;
  const samples: QueuedReport[] = [
    { uuid: crypto.randomUUID(), createdAt: "2026-10-18T10:22:00", text: "Camp 12 needs food packets for 400 people", source: "Field form", camp: "Camp 12", district: "Ludhiana", state: "Waiting" },
    { uuid: crypto.randomUUID(), createdAt: "2026-10-18T10:35:00", text: "Medical supplies required urgently", source: "Pasted SMS", camp: "Camp 8", district: "Hoshiarpur", state: "Failed", error: "Network timeout" },
    { uuid: crypto.randomUUID(), createdAt: "2026-10-18T10:41:00", text: "Tents for displaced families", source: "Pasted WhatsApp", camp: "Camp 4", district: "Firozpur", state: "Waiting" },
  ];
  for (const report of samples) await queueReport(report);
  localStorage.setItem("reliefos-seeded", "true");
}
