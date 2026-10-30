import { api } from "../services/api";

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
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "uuid" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
 * Replays queued reports in chronological FIFO order when connectivity returns.
 * If a submission fails, it is marked 'Failed' with error message and preserved,
 * guaranteeing no reports are lost.
 */
export async function replayQueue(): Promise<{ processed: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  const reports = await getQueuedReports();
  let processed = 0;
  let failed = 0;

  for (const report of reports) {
    // Skip reports already flagged failed unless retried explicitly
    if (report.state === "Failed") continue;

    try {
      await updateQueuedReport({ ...report, state: "Sending" });
      const res = await api.submitIntake(report.text);
      if (res.ok) {
        await removeQueuedReport(report.uuid);
        processed++;
      } else {
        await updateQueuedReport({
          ...report,
          state: "Failed",
          error: res.error || "Server rejected message",
        });
        failed++;
      }
    } catch (err: unknown) {
      await updateQueuedReport({
        ...report,
        state: "Failed",
        error: (err as Error).message || "Network replay failed",
      });
      failed++;
      // If we went offline again, break loop
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
    }
  }

  window.dispatchEvent(new Event("reliefos-queue"));
  return { processed, failed };
}

export async function seedDemoQueue() {
  const existing = await getQueuedReports();
  if (existing.length || localStorage.getItem("reliefos-seeded")) return;
  const samples: QueuedReport[] = [
    {
      uuid: crypto.randomUUID(),
      createdAt: "2026-10-18T10:22:00",
      text: "Camp 12 needs food packets for 400 people",
      source: "Pasted WhatsApp",
      camp: "Camp 12",
      district: "Ludhiana",
      state: "Waiting",
    },
    {
      uuid: crypto.randomUUID(),
      createdAt: "2026-10-18T10:35:00",
      text: "Medical supplies required urgently",
      source: "Pasted SMS",
      camp: "Camp 8",
      district: "Hoshiarpur",
      state: "Failed",
      error: "Network timeout during upload",
    },
    {
      uuid: crypto.randomUUID(),
      createdAt: "2026-10-18T10:41:00",
      text: "Tents for displaced families",
      source: "Pasted WhatsApp",
      camp: "Camp 4",
      district: "Firozpur",
      state: "Waiting",
    },
  ];
  for (const report of samples) await queueReport(report);
  localStorage.setItem("reliefos-seeded", "true");
}
