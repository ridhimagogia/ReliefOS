import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { api } from '../lib/api'
import type { Demand } from '../types'
import { UrgencyBadge } from '../components/UrgencyBadge'
import { ConfidenceBar } from '../components/ConfidenceBar'
import { EmptyState } from '../components/States'

const URGENCY_LABEL: Record<string, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
}

function TrustChips({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reasons.map((r) => (
        <span key={r} className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--warn-bg, #fef3c7)', color: 'var(--warn-text, #92400e)' }}>
          {r}
        </span>
      ))}
    </div>
  )
}

function DemandCard({ demand, onAction }: { demand: Demand; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [busy, setBusy] = useState(false)

  // correction fields
  const [editing, setEditing] = useState(false)
  const [editItem, setEditItem] = useState(demand.item ?? '')
  const [editQty, setEditQty] = useState(demand.qty?.toString() ?? '')
  const [editUrgency, setEditUrgency] = useState(demand.urgency)

  const isPublic = demand.source === 'public'
  const isUnverified = !demand.verified

  async function approve() {
    setBusy(true)
    if (editing) {
      await api.post(`/api/demands/${demand.id}/correct`, {
        item: editItem || undefined,
        qty: editQty ? Number(editQty) : undefined,
        urgency: editUrgency,
      })
    }
    await api.post(`/api/demands/${demand.id}/verify`)
    onAction()
    setBusy(false)
  }

  async function reject() {
    if (!rejectReason.trim()) return
    setBusy(true)
    await api.post(`/api/demands/${demand.id}/reject`, { reason: rejectReason })
    onAction()
    setBusy(false)
  }

  return (
    <div className="card p-4 flex flex-col gap-3"
      style={{ borderLeft: isUnverified && isPublic ? '3px solid var(--warn, #f59e0b)' : undefined }}>

      {/* header */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {isPublic && isUnverified && (
            <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'var(--warn-bg, #fef3c7)', color: 'var(--warn-text, #92400e)' }}>
              <AlertTriangle size={12} aria-hidden /> Unverified public report
            </span>
          )}
          {demand.urgency === 'critical' && isUnverified && (
            <span className="text-xs font-semibold" style={{ color: 'var(--danger, #dc2626)' }}>
              Critical — call back before dispatch
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {new Date(demand.created_at).toLocaleTimeString()}
        </span>
      </div>

      {/* chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="chip"><span className="chip-label">ITEM</span> {demand.item ?? 'Unknown'}</span>
        <span className="chip"><span className="chip-label">QTY</span> {demand.qty != null ? `${demand.qty}${demand.unit ? ' ' + demand.unit : ''}` : 'Not stated'}</span>
        <UrgencyBadge urgency={demand.urgency} />
        {demand.location_text && (
          <span className="chip"><span className="chip-label">LOCATION</span> {demand.location_text}</span>
        )}
      </div>

      <ConfidenceBar confidence={demand.confidence} />

      {/* trust */}
      {demand.trust != null && (
        <div>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            Trust: {Math.round(demand.trust * 100)}%
          </span>
          <TrustChips reasons={demand.trust_reasons ?? []} />
        </div>
      )}

      {/* raw text toggle */}
      <button type="button" className="flex items-center gap-1 text-sm"
        style={{ color: 'var(--muted)' }} onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        Original message
      </button>
      {expanded && (
        <p className="text-sm rounded p-2" style={{ background: 'var(--bg-alt, #f5f0eb)' }}>
          {demand.raw_text}
        </p>
      )}

      {/* correction form */}
      {editing && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <input value={editItem} onChange={(e) => setEditItem(e.target.value)}
            placeholder="Item" className="border rounded px-2 py-1 w-28"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
          <input value={editQty} onChange={(e) => setEditQty(e.target.value)}
            placeholder="Qty" type="number" className="border rounded px-2 py-1 w-20"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
          <select value={editUrgency} onChange={(e) => setEditUrgency(e.target.value as Demand['urgency'])}
            className="border rounded px-2 py-1"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            {['critical', 'high', 'medium', 'low'].map((u) => (
              <option key={u} value={u}>{URGENCY_LABEL[u]}</option>
            ))}
          </select>
        </div>
      )}

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy}
          className="btn text-sm"
          style={{ color: 'var(--muted)' }}
          onClick={() => setEditing((v) => !v)}>
          {editing ? 'Cancel edit' : 'Edit fields'}
        </button>

        <button type="button" disabled={busy}
          className="btn btn-primary text-sm flex items-center gap-1"
          onClick={() => void approve()}>
          <CheckCircle size={14} aria-hidden />
          {isPublic ? 'Verify' : 'Approve'}
        </button>

        {!showReject ? (
          <button type="button" disabled={busy}
            className="btn text-sm flex items-center gap-1"
            style={{ color: 'var(--danger, #dc2626)' }}
            onClick={() => setShowReject(true)}>
            <XCircle size={14} aria-hidden />
            Reject
          </button>
        ) : (
          <div className="flex gap-2 items-center flex-wrap">
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              className="border rounded px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', minWidth: 200 }} />
            <button type="button" disabled={busy || !rejectReason.trim()}
              className="btn text-sm" style={{ color: 'var(--danger, #dc2626)' }}
              onClick={() => void reject()}>
              Confirm reject
            </button>
            <button type="button" className="btn text-sm" onClick={() => setShowReject(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReviewQueue() {
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const r = await api.get<Demand[]>('/api/demands')
    if (r.ok) {
      // critical pinned first, then by created_at desc
      const queue = r.data
        .filter((d) => d.needs_review && !d.rejected)
        .sort((a, b) => {
          if (a.urgency === 'critical' && b.urgency !== 'critical') return -1
          if (b.urgency === 'critical' && a.urgency !== 'critical') return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      setDemands(queue)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  if (loading) return <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Review Queue</h1>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {demands.length} pending
        </span>
      </div>

      {demands.length === 0 ? (
        <EmptyState title="Queue is clear" hint="All reports have been reviewed." />
      ) : (
        <div className="flex flex-col gap-3">
          {demands.map((d) => (
            <DemandCard key={d.id} demand={d} onAction={() => void load()} />
          ))}
        </div>
      )}
    </div>
  )
}
