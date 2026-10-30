export type DemandUrgency = 'low' | 'medium' | 'high' | 'critical';
export type DemandProvider = 'gemini' | 'rules' | 'unknown';
export type DemandSource = 'coordinator' | 'public';
export type DemandKind = 'demand' | 'supply';
export type DemandLanguage = 'en' | 'hi' | 'hinglish';

export type Demand = {
  id: string;
  item: string | null;
  qty: number | null;
  unit: string | null;
  location_text: string | null;
  camp_id: string | null;
  beneficiaries: number | null;
  urgency: DemandUrgency;
  confidence: number; // 0..1; below 0.8 goes to Review Queue
  provider: DemandProvider;
  needs_review: boolean;
  raw_text: string;
  source: DemandSource;
  verified: boolean; // false for public submissions
  kind: DemandKind;
  language: DemandLanguage;
  duplicate_of: string | null;
  report_count: number; // 30 reports from one area = 1 need with report_count 30
};

export type SupplyLot = {
  id: string;
  item: string;
  qty: number;
  unit: string;
  depot_id: string;
  lat: number;
  lng: number;
  updated_at: string; // ISO timestamp, used for the stale badge
};

export type MoveState = 'pending' | 'approved' | 'edited' | 'rejected';

export type Move = {
  id: string;
  demand_id: string;
  stock_id: string;
  vehicle_id: string;
  qty: number;
  km: number;
  eta_h: number;
  score: number;
  item_id: string;
  distance_source: string;
  trips: number;
  reason: Record<string, unknown>;
  explain: string; // human-readable sentence
  state: MoveState;
};

export type Shortage = {
  item: string;
  requested: number;
  available: number;
  shortage: number;
  camp_id?: string;
  camp?: string;
};

export type Surplus = {
  item: string;
  qty: number;
  depot_id?: string;
  depot?: string;
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
  distance_sources: Record<string, unknown> | string[];
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

export type PublicReportPayload = {
  text: string;
  location_text?: string;
  lat?: number;
  lng?: number;
  phone?: string;
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
