import { NavLink, Outlet } from 'react-router-dom'
import { OfflineBanner } from './components/OfflineBanner'
import { StatusChip } from './components/StatusChip'
import { useAutoReplay, useOnline, useQueueLength } from './lib/health'

// Five places a coordinator actually works. Activity log lives on the home page; status lives in the header.
const NAV = [
  { to: '/', label: 'Needs', end: true },
  { to: '/intake', label: 'Intake' },
  { to: '/review', label: 'Review Queue' },
  { to: '/matching', label: 'Matching' },
  { to: '/stock', label: 'Stock & Depots' },
]

export default function App() {
  const online = useOnline()
  const queueLength = useQueueLength()
  useAutoReplay(online)

  return (
    <div className="flex min-h-full flex-col">
      <OfflineBanner online={online} queueLength={queueLength} />
      <header className="flex flex-wrap items-center gap-4 border-b px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <span className="font-heading text-xl" style={{ color: 'var(--accent)' }}>ReliefOS</span>
        <nav className="flex flex-wrap gap-1" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `rounded-md px-3 py-2 text-sm ${isActive ? 'font-semibold' : ''}`}
              style={({ isActive }) => (isActive ? { background: 'var(--accent)', color: 'var(--accent-fg)' } : undefined)}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto">
          <StatusChip />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
