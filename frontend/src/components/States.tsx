import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-8 text-center">
      <Inbox size={28} style={{ color: 'var(--muted)' }} aria-hidden />
      <p className="font-heading text-lg">{title}</p>
      {hint && <p className="text-sm" style={{ color: 'var(--muted)' }}>{hint}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card flex flex-col gap-2 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  )
}
