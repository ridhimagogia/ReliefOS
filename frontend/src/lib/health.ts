import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { listQueue, onQueueChange, replayQueue } from './queue'
import type { AppConfig, Health } from '../types'

/** Runs `fn` now and every `ms` while the tab is visible and the browser is online. */
export function usePoll<T>(fn: () => Promise<T>, ms = 8000) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const refresh = useCallback(async () => {
    try {
      setData(await fnRef.current())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void refresh()
    }, ms)
    return () => window.clearInterval(id)
  }, [refresh, ms])

  return { data, loading, refresh }
}

export function useHealth() {
  const [health, setHealth] = useState<Health | null>(null)
  const [reachable, setReachable] = useState(true)

  useEffect(() => {
    let alive = true
    const ping = async () => {
      const r = await api.get<Health>('/api/health')
      if (!alive) return
      if (r.ok) {
        setHealth(r.data)
        setReachable(true)
      } else {
        setReachable(r.status !== 0)
      }
    }
    void ping()
    const id = window.setInterval(() => void ping(), 10000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  return { health, reachable }
}

export function useConfig(): AppConfig | null {
  const [cfg, setCfg] = useState<AppConfig | null>(null)
  useEffect(() => {
    void api.get<AppConfig>('/api/config').then((r) => {
      if (r.ok) setCfg(r.data)
    })
  }, [])
  return cfg
}

/** Online means: browser says online AND the backend answered the last health ping. */
export function useOnline(): boolean {
  const { reachable } = useHealth()
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setBrowserOnline(true)
    const off = () => setBrowserOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return browserOnline && reachable
}

export function useQueueLength(): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    const read = () => void listQueue().then((q) => setN(q.length))
    read()
    return onQueueChange(read)
  }, [])
  return n
}

/** Replays the queue whenever we come back online. */
export function useAutoReplay(online: boolean) {
  useEffect(() => {
    if (online) void replayQueue()
  }, [online])
}
