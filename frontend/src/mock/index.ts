// Used ONLY when VITE_MOCK_MODE=1 (backup demo build). Never imported on the default path.
// This is a tiny stand-in for the real backend parser. It reads the pasted text; it never returns a fixed answer.
import type { ApiResult, Demand, IntakeResult, Urgency } from '../types'

const ITEMS: { item: string; re: RegExp }[] = [
  { item: 'water', re: /\bwater\b|\bpaani\b|\bpani\b|पानी/i },
  { item: 'blanket', re: /\bblankets?\b|\bkambal\b|कंबल/i },
  { item: 'food', re: /\bfood\b|\bkhana\b|\bkhaana\b|\bration\b|\batta\b|\brice\b|खाना/i },
  { item: 'tent', re: /\btents?\b|\btirpal\b|तंबू/i },
  { item: 'medicine', re: /\bmedicines?\b|\bdawa\b|\bdawai\b|\bdavai\b|दवा/i },
]

function parse(text: string): Demand {
  const found = ITEMS.find((i) => i.re.test(text))
  const campMatch = text.match(/camp\s*(\d+)/i)
  const withoutCamp = text.replace(/camp\s*\d+/gi, ' ')
  const qtyMatch = withoutCamp.match(/(\d[\d,]*)/)
  const qty = qtyMatch ? Number(qtyMatch[1].replace(/,/g, '')) : null
  const people = /\d[\d,]*\s*(log|people|persons)/i.test(withoutCamp)

  let urgency: Urgency = 'medium'
  if (/critical|emergency|life|\bmaut\b/i.test(text)) urgency = 'critical'
  else if (/urgent|jaldi|turant|asap|जल्दी/i.test(text)) urgency = 'high'

  const hasDevanagari = /[ऀ-ॿ]/.test(text)
  const hindiRoman = /\b(mein|chahiye|chahiy|hai|log|paani|pani|kambal|jaldi|turant|khana)\b/i.test(text)
  const language: Demand['language'] = hasDevanagari ? 'hi' : hindiRoman ? 'hinglish' : 'en'

  let confidence = 0.2
  if (found) confidence += 0.15
  if (qty !== null) confidence += 0.15
  if (campMatch) confidence += 0.1
  confidence = Math.min(confidence, 0.65) // same cap as the real rules parser

  return {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    item: found ? found.item : null,
    qty,
    unit: people ? 'people' : null,
    location_text: campMatch ? `Camp ${campMatch[1]}` : null,
    camp_id: campMatch ? `camp-${campMatch[1]}` : null,
    district: null,
    lat: null,
    lng: null,
    beneficiaries: people ? qty : null,
    urgency,
    confidence,
    provider: 'rules',
    needs_review: true,
    raw_text: text,
    source: 'coordinator',
    verified: true,
    kind: 'demand',
    language,
    duplicate_of: null,
    report_count: 1,
    channel: 'text',
    attachment_url: null,
    created_at: new Date().toISOString(),
    trust: 0.5,
    trust_reasons: [],
    sender_key: null,
  }
}

export function mockRequest<T>(method: string, path: string, body?: unknown): ApiResult<T> {
  if (method === 'POST' && path === '/api/intake') {
    const text = typeof body === 'object' && body !== null && 'text' in body ? String((body as { text: unknown }).text) : ''
    const result: IntakeResult = { demands: [parse(text)] }
    return { ok: true, data: result as T }
  }
  if (method === 'GET' && path === '/api/health') {
    return { ok: true, data: { status: 'ok', offline_mode: true, gemini: false, ocr: false, stt: false, time: new Date().toISOString() } as T }
  }
  return { ok: false, error: 'Not available yet (mock mode)', status: 404 }
}