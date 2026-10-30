import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

type ToastKind = 'ok' | 'error'
type ToastItem = { id: number; kind: ToastKind; text: string }
type Ctx = { toast: (kind: ToastKind, text: string) => void }

const ToastContext = createContext<Ctx>({ toast: () => undefined })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random()
    setItems((p) => [...p, { id, kind, text }])
    window.setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="card flex items-start gap-2 p-3 shadow-md"
            style={{ borderColor: t.kind === 'error' ? 'var(--bad)' : 'var(--ok)' }}
          >
            {t.kind === 'error' ? (
              <AlertTriangle size={18} style={{ color: 'var(--bad)' }} aria-hidden />
            ) : (
              <CheckCircle2 size={18} style={{ color: 'var(--ok)' }} aria-hidden />
            )}
            <span className="flex-1 text-sm">{t.text}</span>
            <button
              type="button"
              aria-label="Dismiss"
              className="opacity-60 hover:opacity-100"
              onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
