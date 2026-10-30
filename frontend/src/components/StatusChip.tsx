import { useHealth } from '../lib/health'

/** System status comes only from GET /api/health (rule R3). Nothing here is hardcoded. */
export function StatusChip() {
  const { health, reachable } = useHealth()

  let label = 'Status not available'
  let color = 'var(--muted)'
  if (!reachable) {
    label = 'Server not reachable'
    color = 'var(--bad)'
  } else if (health) {
    if (health.status === 'degraded') {
      label = 'Degraded'
      color = 'var(--warn)'
    } else if (health.offline_mode) {
      label = 'Offline mode'
      color = 'var(--ok)'
    } else {
      label = 'Online'
      color = 'var(--ok)'
    }
  }

  const caps = health
    ? [health.gemini ? 'AI parsing' : null, health.ocr ? 'OCR' : null, health.stt ? 'Speech' : null].filter((c): c is string => c !== null)
    : []

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" title="Reported by the server">
      <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color }}>
        <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      {caps.length > 0 && <span style={{ color: 'var(--muted)' }}>{caps.join(' · ')}</span>}
    </div>
  )
}
