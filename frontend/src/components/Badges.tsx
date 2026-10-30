import type { ReactNode } from 'react'
import { AlertOctagon, AlertTriangle, ArrowDown, CheckCircle2, Clock, Minus, ShieldQuestion } from 'lucide-react'
import type { Urgency } from '../types'

export function Chip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-md border px-2 py-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  )
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="flex items-center gap-2" title={`Parse confidence ${pct}%`}>
      <div className="h-2 w-28 overflow-hidden rounded-full" style={{ background: 'var(--border)' }} role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Parse confidence">
        <div className="h-full" style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)' }} />
      </div>
      <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{pct}%</span>
    </div>
  )
}

const URGENCY: Record<Urgency, { label: string; color: string; Icon: typeof Clock }> = {
  critical: { label: 'Critical', color: 'var(--bad)', Icon: AlertOctagon },
  high: { label: 'High', color: 'var(--warn)', Icon: AlertTriangle },
  medium: { label: 'Medium', color: 'var(--muted)', Icon: Minus },
  low: { label: 'Low', color: 'var(--muted)', Icon: ArrowDown },
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const { label, color, Icon } = URGENCY[urgency]
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm font-medium" style={{ color, borderColor: color }}>
      <Icon size={14} aria-hidden />
      {label}
    </span>
  )
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--ok)' }}>
      <CheckCircle2 size={14} aria-hidden /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--warn)' }}>
      <ShieldQuestion size={14} aria-hidden /> Unverified
    </span>
  )
}

export function SmallBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border px-1.5 py-0.5 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>{children}</span>
  )
}

export function ReportCountBadge({ count }: { count: number }) {
  if (count <= 1) return null
  return <SmallBadge>{count} reports</SmallBadge>
}

export function StaleBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs" style={{ color: 'var(--warn)', borderColor: 'var(--warn)' }}>
      <Clock size={12} aria-hidden /> Stale
    </span>
  )
}

export function TrustBadge({ trust, reasons }: { trust: number; reasons: string[] }) {
  const level = trust >= 0.7 ? 'high' : trust >= 0.4 ? 'medium' : 'low'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SmallBadge>Trust: {level}</SmallBadge>
      {reasons.map((r) => (
        <SmallBadge key={r}>{r}</SmallBadge>
      ))}
    </div>
  )
}
