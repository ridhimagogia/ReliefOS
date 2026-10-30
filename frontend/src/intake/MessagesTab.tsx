import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { api, isNetworkFailure } from '../lib/api'
import { enqueue } from '../lib/queue'
import { useToast } from '../components/Toast'
import type { Demand, IntakeResult } from '../types'
import { ResultCard } from './ResultCard'
import { splitMessages } from './splitMessages'

export function MessagesTab() {
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Demand[]>([])
  const parts = useMemo(() => splitMessages(text), [text])

  async function submit() {
    if (parts.length === 0) return
    setBusy(true)
    const collected: Demand[] = []
    let queued = 0
    let failed = 0
    for (const part of parts) {
      const r = await api.post<IntakeResult>('/api/intake', { text: part })
      if (r.ok) {
        collected.push(...r.data.demands)
      } else if (isNetworkFailure(r)) {
        await enqueue({ kind: 'json', path: '/api/intake', label: part.slice(0, 40), json: { text: part } })
        queued += 1
      } else {
        failed += 1
        toast('error', r.error)
      }
    }
    setResults((prev) => [...collected, ...prev])
    if (queued) toast('ok', `Saved ${queued} message${queued === 1 ? '' : 's'}, will send when connected.`)
    if (collected.length) toast('ok', `Read ${parts.length - queued - failed} message${parts.length - queued - failed === 1 ? '' : 's'}.`)
    if (!failed) setText('')
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3 p-4">
        <label htmlFor="msg" className="font-heading text-lg">
          Paste or type the message as you received it
        </label>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          English, Hindi or Hinglish. You can paste several forwarded messages at once; they are split on blank lines. ReliefOS reads the item, quantity, urgency and place for you.
        </p>
        <textarea
          id="msg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          className="w-full rounded-md border p-3"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)', font: 'inherit' }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={busy || parts.length === 0} onClick={() => void submit()}>
            <Send size={16} aria-hidden />
            {busy ? 'Reading...' : parts.length > 1 ? `Read ${parts.length} messages` : 'Read message'}
          </button>
          {parts.length > 1 && (
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{parts.length} messages found</span>
          )}
        </div>
        {parts.length > 1 && (
          <ol className="list-decimal pl-5 text-sm" style={{ color: 'var(--muted)' }}>
            {parts.map((p, i) => (
              <li key={i} className="truncate">{p}</li>
            ))}
          </ol>
        )}
      </div>

      {results.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>No reports yet. Paste a message to begin.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((d) => (
            <ResultCard key={d.id} demand={d} />
          ))}
        </div>
      )}
    </div>
  )
}
