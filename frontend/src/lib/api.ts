import type { ApiResult } from '../types'
import { mockRequest } from '../mock'

const BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
export const MOCK_MODE: boolean = import.meta.env.VITE_MOCK_MODE === '1'

async function request<T>(method: string, path: string, body?: unknown, form?: FormData): Promise<ApiResult<T>> {
  if (MOCK_MODE) return mockRequest<T>(method, path, body)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: form || body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
    if (res.status === 429) {
      return { ok: false, status: 429, error: 'Too many reports. Please wait a minute and try again.' }
    }
    if (res.status === 404 || res.status === 501) {
      return { ok: false, status: res.status, error: 'Not available yet' }
    }
    const text = await res.text()
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = null
      }
    }
    if (!res.ok) {
      const msg =
        data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `Request failed (${res.status})`
      return { ok: false, status: res.status, error: msg }
    }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, status: 0, error: 'Cannot reach the ReliefOS server. Check the network and try again.' }
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  postForm: <T>(path: string, form: FormData) => request<T>('POST', path, undefined, form),
}

/** True when the failure means "server not reachable" (so the caller may queue). */
export function isNetworkFailure<T>(r: ApiResult<T>): boolean {
  return !r.ok && r.status === 0
}
