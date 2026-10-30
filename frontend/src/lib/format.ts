export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 'unknown time'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export function ageHours(iso: string, now: number = Date.now()): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : Math.max(0, (now - t) / 3_600_000)
}

export function isStale(iso: string, staleHours: number, now: number = Date.now()): boolean {
  return ageHours(iso, now) > staleHours
}

export function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-'
  return new Intl.NumberFormat('en-IN').format(n)
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
