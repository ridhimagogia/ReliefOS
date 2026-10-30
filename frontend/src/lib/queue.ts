// Tiny IndexedDB queue. FIFO, exactly-once replay, failed items are kept (never dropped).
import { api } from './api'

export type QueueKind = 'json' | 'form'

export type QueueItem = {
  seq?: number
  kind: QueueKind
  path: string
  label: string
  json?: unknown
  fields?: Record<string, string>
  blob?: Blob
  blobName?: string
  blobField?: string
  state: 'pending' | 'failed'
  attempts: number
  lastError: string | null
  created_at: string
}

const DB = 'reliefos'
const STORE = 'queue'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const r = fn(t.objectStore(STORE))
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      }),
  )
}

const listeners = new Set<() => void>()
export function onQueueChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function notify() {
  listeners.forEach((f) => f())
}

export async function enqueue(item: Omit<QueueItem, 'seq' | 'state' | 'attempts' | 'lastError' | 'created_at'>): Promise<void> {
  await tx('readwrite', (s) =>
    s.add({ ...item, state: 'pending', attempts: 0, lastError: null, created_at: new Date().toISOString() }),
  )
  notify()
}

export async function listQueue(): Promise<QueueItem[]> {
  const all = await tx<QueueItem[]>('readonly', (s) => s.getAll())
  return all.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
}

async function put(item: QueueItem): Promise<void> {
  await tx('readwrite', (s) => s.put(item))
}
async function remove(seq: number): Promise<void> {
  await tx('readwrite', (s) => s.delete(seq))
}

let replaying = false

/** Replay in order. Stops at the first network failure so order is kept. */
export async function replayQueue(): Promise<{ sent: number; failed: number }> {
  if (replaying) return { sent: 0, failed: 0 }
  replaying = true
  let sent = 0
  let failed = 0
  try {
    const items = await listQueue()
    for (const item of items) {
      if (item.state === 'failed') continue
      const res =
        item.kind === 'json'
          ? await api.post(item.path, item.json)
          : await api.postForm(item.path, buildForm(item))
      if (res.ok) {
        if (item.seq !== undefined) await remove(item.seq)
        sent += 1
      } else if (res.status === 0) {
        break
      } else {
        await put({ ...item, state: 'failed', attempts: item.attempts + 1, lastError: res.error })
        failed += 1
      }
    }
  } finally {
    replaying = false
    notify()
  }
  return { sent, failed }
}

/** Put a failed item back in the line (user pressed Retry). */
export async function retryItem(seq: number): Promise<void> {
  const items = await listQueue()
  const it = items.find((i) => i.seq === seq)
  if (it) await put({ ...it, state: 'pending', lastError: null })
  notify()
  await replayQueue()
}

function buildForm(item: QueueItem): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(item.fields ?? {})) f.append(k, v)
  if (item.blob && item.blobField) f.append(item.blobField, item.blob, item.blobName ?? 'upload')
  return f
}
