import { api, MOCK_MODE } from "../services/api";

export type QueuedReport = {
  uuid: string;
  createdAt: string;
  text: string;
  source: string;
  camp?: string;
  district?: string;
  kind?: "intake" | "public";
  location_text?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  state: "Waiting" | "Sending" | "Failed";
  error?: string;
  retryCount?: number;
};

const DB_NAME = "reliefos-offline";
const STORE = "reports";
const DB_VERSION = 2;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "uuid" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Migrate any lingering items from localStorage fallback
async function migrateLocalStorageQueue() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const localRaw = localStorage.getItem("reliefos-public-queue");
    if (localRaw) {
      const items = JSON.parse(localRaw);
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await queueReport({
            uuid: item.client_uuid || item.uuid || crypto.randomUUID(),
            createdAt: item.client_created_at || item.createdAt || new Date().toISOString(),
            text: item.text || "",
            source: "Public Web",
            kind: "public",
            location_text: item.location_text,
            lat: item.lat,
            lng: item.lng,
            phone: item.phone,
            state: "Waiting",
          });
        }
        localStorage.removeItem("reliefos-public-queue");
      }
    }
  } catch {
    // Ignore migration parse errors
  }
}

export async function queueReport(report: QueuedReport) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(report);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event("reliefos-queue"));
}

export async function updateQueuedReport(report: QueuedReport) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(report);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event("reliefos-queue"));
}

export async function getQueuedReports(): Promise<QueuedReport[]> {
  await migrateLocalStorageQueue();
  const db = await openDb();
  const reports = await new Promise<QueuedReport[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  // Strictly FIFO: sort ascending by creation timestamp so items replay in order
  return reports.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeQueuedReport(uuid: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(uuid);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event("reliefos-queue"));
}

/**
 * Sends a single queued item through the appropriate API endpoint according to its kind.
 * Does not remove it on failure.
 */
export async function sendQueued(report: QueuedReport): Promise<{ ok: boolean; error?: string }> {
  try {
    await updateQueuedReport({ ...report, state: "Sending" });
    let res: { ok: boolean; error?: string; status?: number };
    if (report.kind === "public") {
      res = await api.submitPublicReport({
        text: report.text,
        location_text: report.location_text,
        lat: report.lat,
        lng: report.lng,
        phone: report.phone,
        client_uuid: report.uuid,
        client_created_at: report.createdAt,
      });
    } else {
      res = await api.submitIntake(report.text, {
        client_uuid: report.uuid,
        client_created_at: report.createdAt,
      });
    }

    if (res.ok) {
      await removeQueuedReport(report.uuid);
      return { ok: true };
    }

    // HTTP 4xx (except 429) is a permanent reject; 5xx/network/429 are retryable
    const isRetryable = !res.status || res.status >= 500 || res.status === 429;
    const errorMsg = res.error || "Submission failed";
    await updateQueuedReport({
      ...report,
      state: "Failed",
      error: errorMsg,
      retryCount: (report.retryCount || 0) + 1,
    });
    return { ok: false, error: errorMsg };
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || "Network replay failed";
    await updateQueuedReport({
      ...report,
      state: "Failed",
      error: errorMsg,
      retryCount: (report.retryCount || 0) + 1,
    });
    return { ok: false, error: errorMsg };
  }
}

/**
 * Replays queued reports in strict FIFO order when connectivity returns.
 * Stops on the first network error so later reports don't fail prematurely.
 */
export async function replayQueue(): Promise<{ processed: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  const reports = await getQueuedReports();
  let processed = 0;
  let failed = 0;

  for (const report of reports) {
    // Retry Failed items up to 3 times automatically
    if (report.state === "Failed" && (report.retryCount || 0) >= 3) {
      continue;
    }

    const outcome = await sendQueued(report);
    if (outcome.ok) {
      processed++;
    } else {
      failed++;
      // Stop replay on network disconnect/unreachable to preserve strict FIFO
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        break;
      }
    }
  }

  window.dispatchEvent(new Event("reliefos-queue"));
  return { processed, failed };
}

export async function seedDemoQueue() {
  if (!MOCK_MODE) return;
  const existing = await getQueuedReports();
  if (existing.length || (typeof localStorage !== "undefined" && localStorage.getItem("reliefos-seeded"))) return;
  const samples: QueuedReport[] = [
    {
      uuid: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `seed-1`,
      createdAt: "2026-10-18T10:22:00.000Z",
      text: "Camp 12 needs food packets for 400 people",
      source: "Pasted WhatsApp",
      camp: "Camp 12",
      district: "Ludhiana",
      kind: "intake",
      state: "Waiting",
    },
    {
      uuid: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `seed-2`,
      createdAt: "2026-10-18T10:35:00.000Z",
      text: "Medical supplies required urgently",
      source: "Pasted SMS",
      camp: "Camp 8",
      district: "Hoshiarpur",
      kind: "intake",
      state: "Failed",
      error: "Network timeout during upload",
    },
    {
      uuid: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `seed-3`,
      createdAt: "2026-10-18T10:41:00.000Z",
      text: "Tents for displaced families",
      source: "Pasted WhatsApp",
      camp: "Camp 4",
      district: "Firozpur",
      kind: "intake",
      state: "Waiting",
    },
  ];
  for (const report of samples) await queueReport(report);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("reliefos-seeded", "true");
  }
}
