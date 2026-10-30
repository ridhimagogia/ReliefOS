import { WifiOff } from 'lucide-react'
import { MOCK_MODE } from '../lib/api'

export const OFFLINE_TEXT = 'Works with zero internet on a local network. Internet adds AI parsing and chat-app intake.'

export function OfflineBanner({ online, queueLength }: { online: boolean; queueLength: number }) {
  if (MOCK_MODE) {
    return (
      <div className="px-4 py-2 text-sm" style={{ background: 'var(--warn)', color: '#fff' }} role="status">
        Demo mode: showing sample data, not the live server.
      </div>
    )
  }
  if (online && queueLength === 0) return null
  return (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"
      style={{ background: online ? 'var(--card)' : 'var(--warn)', color: online ? 'var(--fg)' : '#fff', borderBottom: '1px solid var(--border)' }}
      role="status"
    >
      <WifiOff size={16} aria-hidden />
      {!online && <strong>Server not reachable.</strong>}
      {!online && <span>{OFFLINE_TEXT}</span>}
      {queueLength > 0 && <span>{queueLength} item{queueLength === 1 ? '' : 's'} saved, will send when connected.</span>}
    </div>
  )
}
