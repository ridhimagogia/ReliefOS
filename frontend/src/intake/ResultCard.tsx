import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Image as ImageIcon, Mic, Phone } from 'lucide-react'
import type { Channel, Demand } from '../types'
import { Chip, ConfidenceBar, SmallBadge, UrgencyBadge } from '../components/Badges'
import { fmtNumber } from '../lib/format'

const CHANNEL_ICON: Record<Channel, typeof FileText> = { text: FileText, image: ImageIcon, voice: Mic, call: Phone }
const LANG: Record<Demand['language'], string> = { en: 'English', hi: 'Hindi', hinglish: 'Hinglish' }

/** Read-only. Structure is OUTPUT, never input (rule R2). */
export function ResultCard({ demand, heardLabel }: { demand: Demand; heardLabel?: string }) {
  const [open, setOpen] = useState(false)
  const Icon = CHANNEL_ICON[demand.channel] ?? FileText
  const qty = demand.qty !== null ? `${fmtNumber(demand.qty)}${demand.unit ? ` ${demand.unit}` : ''}` : null

  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon size={16} aria-hidden style={{ color: 'var(--muted)' }} />
        <SmallBadge>{demand.provider === 'gemini' ? 'AI' : demand.provider === 'rules' ? 'Rules' : 'Unknown parser'}</SmallBadge>
        <SmallBadge>{LANG[demand.language]}</SmallBadge>
        <span className="ml-auto text-sm" style={{ color: demand.needs_review ? 'var(--warn)' : 'var(--ok)' }}>
          {demand.needs_review ? 'Sent to Review Queue' : 'Added to needs'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip label="Item" value={demand.item ?? 'Not recognised'} />
        <Chip label="Qty" value={qty ?? 'Not stated'} />
        <UrgencyBadge urgency={demand.urgency} />
        <Chip label="Location" value={demand.location_text ?? demand.camp_id ?? 'Not stated'} />
      </div>

      <ConfidenceBar value={demand.confidence} />

      <button type="button" className="flex items-center gap-1 self-start text-sm" style={{ color: 'var(--muted)' }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        {heardLabel ?? 'Original message'}
      </button>
      {open && <p className="whitespace-pre-wrap rounded-md p-3 text-sm" style={{ background: 'var(--bg)' }}>{demand.raw_text}</p>}
    </article>
  )
}
