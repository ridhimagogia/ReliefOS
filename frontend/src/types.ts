export type DemandUrgency = 'low' | 'medium' | 'high' | 'critical';
export type DemandProvider = 'gemini' | 'rules' | 'unknown' | 'gemini_failed' | 'local_llm';
export type DemandSource = 'coordinator' | 'public';
export type DemandKind = 'demand' | 'supply';
export type DemandLanguage = 'en' | 'hi' | 'hinglish';

export type Demand = {
  id: string;
  item: string | null;
  item_id?: string | null;
  qty: number | null;
  unit: string | null;
  location_text: string | null;
  camp_id: string | null;
  beneficiaries: number | null;
  urgency: DemandUrgency;
  confidence: number; // 0..1; needs_review drives review queue
  provider: DemandProvider;
  needs_review: boolean;
  raw_text: string;
  source: DemandSource;
  verified: boolean; // false for public submissions
  rejected?: boolean;
  kind: DemandKind;
  language: DemandLanguage;
  duplicate_of: string | null;
  report_count: number; // 30 reports from one area = 1 need with report_count 30
  client_uuid?: string;
  client_created_at?: string;
  created_at?: string;
  status?: string;
  phone?: string;
  lat?: number;
  lng?: number;
};

export type SupplyLot = {
  id: string;
  item: string;
  item_id?: string;
  qty: number;
  unit: string;
  depot_id: string;
  depot_name?: string;
  reserved?: number;
  lat: number;
  lng: number;
  updated_at: string; // ISO timestamp, used for the stale badge
};

export type Location = {
  id: string;
  name: string;
  type: 'camp' | 'depot' | 'hospital' | 'hub';
  lat: number;
  lng: number;
  district: string;
  population?: number;
  unverified?: boolean;
};

export type CanonicalItem = {
  item_id: string;
  name: string;
  unit: string;
  category: string;
};

export type MoveState = 'pending' | 'approved' | 'edited' | 'rejected';

export type Move = {
  id: string;
  demand_id: string;
  stock_id: string;
  vehicle_id: string | null;
  origin_location_id?: string;
  dest_location_id?: string;
  qty: number;
  edited_qty?: number;
  km: number;
  eta_h: number;
  score: number;
  item_id: string;
  distance_source: string;
  trips: number;
  reason: Record<string, unknown>;
  reason_text?: string;
  explain: string; // human-readable sentence
  state: MoveState;
  notes?: string;
};

export type Shortage = {
  item: string;
  item_id?: string;
  district?: string;
  shortage: number;
  requested?: number;
  available?: number;
  camp_id?: string;
  camp?: string;
  message?: string;
  nearest_source?: {
    location_id?: string;
    name: string;
    km: number;
    distance_source: string;
    source_exhausted?: boolean;
  } | null;
};

export type Surplus = {
  item: string;
  item_id?: string;
  qty: number;
  depot_id?: string;
  depot?: string;
  stock_id?: string;
  no_demand?: boolean;
  message?: string;
};

export type MatchConflict = {
  item: string;
  camps_competing: string[];
  winner: string;
  reason: string;
};

export type StockWarning = {
  stock_id: string;
  item: string;
  age_hours: number;
  message: string;
};

export type PlanOutput = {
  recommendations: Move[];
  shortages: Shortage[];
  surplus: Surplus[];
  algorithm: string;
  distance_sources: string[];
  conflicts: MatchConflict[];
  warnings: StockWarning[];
};

export type AuditAction = 'approved' | 'edited' | 'rejected' | 'verified' | 'rejected-public';

export type AuditEntry = {
  id: string;
  user: string;
  action: AuditAction;
  target_id: string;
  timestamp: string;
  notes?: string;
};

export type Health = {
  mode: 'online' | 'offline';
  providers: string[];
  db: 'sqlite' | 'mysql';
  scenario?: string;
};

export type JoinInfo = {
  ip: string;
  port: number;
  url: string;
  qr_svg: string | null;
};

export type PublicReportPayload = {
  text: string;
  location_text?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  client_uuid?: string;
  client_created_at?: string;
};

export type PublicReportResponse = {
  id: string;
  status: 'queued' | 'received';
  message?: string;
};

export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
};
