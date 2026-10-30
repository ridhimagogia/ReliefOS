export type Urgency = 'low' | 'medium' | 'high' | 'critical'
export type Channel = 'text' | 'image' | 'voice' | 'call'

export type Demand = {
  id: string
  item: string | null
  qty: number | null
  unit: string | null
  location_text: string | null
  camp_id: string | null
  district: string | null
  lat: number | null
  lng: number | null
  beneficiaries: number | null
  urgency: Urgency
  confidence: number
  provider: 'gemini' | 'rules' | 'unknown'
  needs_review: boolean
  raw_text: string
  source: 'coordinator' | 'public'
  verified: boolean
  kind: 'demand' | 'supply'
  language: 'en' | 'hi' | 'hinglish'
  duplicate_of: string | null
  report_count: number
  channel: Channel
  attachment_url: string | null
  created_at: string
  trust: number
  trust_reasons: string[]
  sender_key: string | null
}

export type SupplyLot = {
  id: string
  item: string
  qty: number
  unit: string
  depot_id: string
  lat: number
  lng: number
  updated_at: string
}

export type Move = {
  id: string
  demand_id: string
  stock_id: string
  vehicle_id: string
  qty: number
  km: number
  eta_h: number
  score: number
  item_id: string
  distance_source: string
  trips: number
  reason: Record<string, unknown>
  explain: string
  state: 'pending' | 'approved' | 'edited' | 'rejected'
}

export type Conflict = { item: string; camps_competing: string[]; winner: string; reason: string }
export type StockWarning = { stock_id: string; item: string; age_hours: number; message: string }
export type Plan = {
  recommendations: Move[]
  shortages: unknown[]
  surplus: unknown[]
  algorithm: string
  distance_sources: string[]
  conflicts: Conflict[]
  warnings: StockWarning[]
}

export type AuditEntry = {
  id: string
  user: string
  action: 'approved' | 'edited' | 'rejected' | 'verified' | 'rejected-public'
  target_id: string
  timestamp: string
  notes: string
}

export type Health = {
  status: 'ok' | 'degraded'
  offline_mode: boolean
  gemini: boolean
  ocr: boolean
  stt: boolean
  time: string
}

export type AppConfig = {
  stale_hours: number
  helpline_number: string | null
  emergency_numbers: { label: string; number: string }[]
  languages: ('en' | 'hi')[]
}

export type Place = { name: string; district: string; lat: number; lng: number }

export type IntakeResult = {
  demands: Demand[]
  transcript?: string
  ocr_text?: string
  ocr_confidence?: number
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }
