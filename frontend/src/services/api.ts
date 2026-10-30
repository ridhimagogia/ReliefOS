import type {
  AuditEntry,
  CanonicalItem,
  Demand,
  Health,
  JoinInfo,
  Location,
  Move,
  PlanOutput,
  PublicReportPayload,
  PublicReportResponse,
  Shortage,
  SupplyLot,
} from '../types';
import {
  locations as mockLocationsRaw,
  mockAudit,
  mockDemands,
  mockMoves,
  mockSupplyLots,
} from '../data/mockData';

export const MOCK_MODE =
  import.meta.env.VITE_MOCK_MODE === '1' ||
  import.meta.env.VITE_MOCK_MODE === 'true';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export type ToastMessage = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

export function showToast(tone: 'success' | 'error' | 'info', text: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ToastMessage>('reliefos-toast', {
        detail: { tone, text },
      })
    );
  }
}

export function onToast(callback: (toast: ToastMessage) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<ToastMessage>;
    if (custom.detail) callback(custom.detail);
  };
  window.addEventListener('reliefos-toast', handler);
  return () => window.removeEventListener('reliefos-toast', handler);
}

export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
};

// Generic request helper with friendly error handling
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (
      !(options.body instanceof FormData) &&
      !headers['Content-Type'] &&
      options.body
    ) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 429) {
      const rateLimitMsg = 'Too many requests. Please wait a minute before trying again.';
      showToast('error', rateLimitMsg);
      return { ok: false, error: rateLimitMsg, status: 429 };
    }

    if (!response.ok) {
      let errorMsg = `Server error (${response.status})`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch {
        // use default errorMsg
      }
      showToast('error', errorMsg);
      return { ok: false, error: errorMsg, status: response.status };
    }

    const data = (await response.json()) as T;
    return { ok: true, data, status: response.status };
  } catch (err: unknown) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const msg = isOffline
      ? 'No network connection. Operation queued or offline mode active.'
      : (err as Error).message || 'Network request failed';

    if (!isOffline) {
      showToast('error', msg);
    }
    return { ok: false, error: msg, status: 0 };
  }
}

// In-memory mock store for local development / explicit VITE_MOCK_MODE=1 fallback only
let inMemoryDemands: Demand[] = [...mockDemands];
let inMemoryStock: SupplyLot[] = [...mockSupplyLots];
let inMemoryMoves: Move[] = [...mockMoves];
let inMemoryAudit: AuditEntry[] = [...mockAudit];
let inMemoryLocations: Location[] = (mockLocationsRaw as unknown as Location[]) || [];

export const api = {
  // Health
  async getHealth(): Promise<ApiResponse<Health>> {
    if (MOCK_MODE) {
      return {
        ok: true,
        data: {
          mode: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
          providers: ['gemini', 'rules'],
          db: 'sqlite',
          scenario: 'punjab_flood_sim',
        },
      };
    }
    return request<Health>('/health');
  },

  // Locations: GET /api/locations
  async getLocations(): Promise<ApiResponse<Location[]>> {
    if (MOCK_MODE) {
      return { ok: true, data: [...inMemoryLocations] };
    }
    return request<Location[]>('/locations');
  },

  // Canonical Items: GET /api/items
  async getItems(): Promise<ApiResponse<CanonicalItem[]>> {
    if (MOCK_MODE) {
      return {
        ok: true,
        data: [
          { item_id: 'water', name: 'Drinking Water', unit: 'litres', category: 'water' },
          { item_id: 'food', name: 'Food Packet', unit: 'packets', category: 'food' },
          { item_id: 'tent', name: 'Tent', unit: 'units', category: 'shelter' },
          { item_id: 'blanket', name: 'Blanket', unit: 'units', category: 'shelter' },
          { item_id: 'medkit', name: 'Medical Kit', unit: 'kits', category: 'medical' },
        ],
      };
    }
    return request<CanonicalItem[]>('/items');
  },

  // Join Info: GET /api/join
  async getJoin(): Promise<ApiResponse<JoinInfo>> {
    if (MOCK_MODE) {
      return {
        ok: true,
        data: {
          ip: '192.168.1.100',
          port: 5000,
          url: 'http://192.168.1.100:5000',
          qr_svg: null,
        },
      };
    }
    return request<JoinInfo>('/join');
  },

  // 1. Demands: GET /api/demands
  async getDemands(): Promise<ApiResponse<Demand[]>> {
    if (MOCK_MODE) {
      return { ok: true, data: [...inMemoryDemands] };
    }
    return request<Demand[]>('/demands');
  },

  // 2. Intake: POST /api/intake
  async submitIntake(
    text: string,
    meta?: { client_uuid?: string; client_created_at?: string }
  ): Promise<ApiResponse<Demand>> {
    const client_uuid = meta?.client_uuid || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}`);
    const client_created_at = meta?.client_created_at || new Date().toISOString();

    if (MOCK_MODE) {
      const lower = text.toLowerCase();
      let item = 'General relief';
      let itemId = 'water';
      if (lower.includes('water') || lower.includes('paani') || lower.includes('pani')) {
        item = 'Drinking water';
        itemId = 'water';
      } else if (lower.includes('tent') || lower.includes('tents')) {
        item = 'Tents';
        itemId = 'tent';
      } else if (lower.includes('medical') || lower.includes('dawa') || lower.includes('kit')) {
        item = 'Medical kits';
        itemId = 'medkit';
      } else if (lower.includes('food') || lower.includes('khana')) {
        item = 'Food packets';
        itemId = 'food';
      } else if (lower.includes('blanket') || lower.includes('kambal')) {
        item = 'Blankets';
        itemId = 'blanket';
      }

      const qtyMatch = text.match(/\b\d+\b/);
      const qty = qtyMatch ? parseInt(qtyMatch[0], 10) : 500;
      const urgency = lower.includes('urgent') || lower.includes('emergency') || lower.includes('turant')
        ? 'critical'
        : lower.includes('high')
        ? 'high'
        : 'medium';

      const campMatch = text.match(/camp\s*(\d+)/i);
      const campId = campMatch ? `camp${campMatch[1]}` : 'camp17';

      const newDemand: Demand = {
        id: `dem-${Date.now()}`,
        client_uuid,
        client_created_at,
        created_at: client_created_at,
        item,
        item_id: itemId,
        qty,
        unit: itemId === 'water' ? 'litres' : itemId === 'food' ? 'packets' : 'units',
        location_text: campMatch ? `Camp ${campMatch[1]}` : 'Punjab',
        camp_id: campId,
        beneficiaries: qty,
        urgency,
        confidence: lower.includes('urgent') ? 0.92 : 0.74,
        provider: 'gemini',
        needs_review: lower.includes('urgent') ? false : true,
        raw_text: text,
        source: 'coordinator',
        verified: true,
        kind: 'demand',
        language: /[\u0900-\u097F]/.test(text) ? 'hi' : (lower.includes('paani') || lower.includes('khana') ? 'hinglish' : 'en'),
        duplicate_of: null,
        report_count: 1,
      };

      inMemoryDemands.unshift(newDemand);
      return { ok: true, data: newDemand };
    }

    return request<Demand>('/intake', {
      method: 'POST',
      body: JSON.stringify({ text, client_uuid, client_created_at }),
    });
  },

  // 3. Public report: POST /api/public/report
  async submitPublicReport(payload: PublicReportPayload): Promise<ApiResponse<PublicReportResponse>> {
    const client_uuid = payload.client_uuid || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}`);
    const client_created_at = payload.client_created_at || new Date().toISOString();
    const finalPayload = { ...payload, client_uuid, client_created_at };

    if (MOCK_MODE) {
      const newDemand: Demand = {
        id: `dem-pub-${Date.now()}`,
        client_uuid,
        client_created_at,
        created_at: client_created_at,
        item: null,
        item_id: null,
        qty: null,
        unit: null,
        location_text: payload.location_text || (payload.lat ? `${payload.lat.toFixed(4)}, ${payload.lng?.toFixed(4)}` : 'Unknown location'),
        camp_id: null,
        beneficiaries: null,
        urgency: 'high',
        confidence: 0.6,
        provider: 'rules',
        needs_review: true,
        raw_text: payload.text,
        source: 'public',
        verified: false,
        kind: 'demand',
        language: /[\u0900-\u097F]/.test(payload.text) ? 'hi' : 'en',
        duplicate_of: null,
        report_count: 1,
        phone: payload.phone,
        lat: payload.lat,
        lng: payload.lng,
      };
      inMemoryDemands.unshift(newDemand);
      return { ok: true, data: { id: newDemand.id, status: 'queued' } };
    }

    return request<PublicReportResponse>('/public/report', {
      method: 'POST',
      body: JSON.stringify(finalPayload),
    });
  },

  // 4. Verify demand: POST /api/demands/<id>/verify
  async verifyDemand(id: string): Promise<ApiResponse<{ verified: boolean }>> {
    if (MOCK_MODE) {
      const found = inMemoryDemands.find((d) => d.id === id);
      if (found) {
        found.verified = true;
        found.needs_review = false;
        inMemoryAudit.unshift({
          id: `aud-${Date.now()}`,
          user: 'Aastha Jha (Coordinator)',
          action: 'verified',
          target_id: id,
          timestamp: new Date().toISOString(),
          notes: 'Public demand verified and moved to active matching queue',
        });
      }
      return { ok: true, data: { verified: true } };
    }

    return request<{ verified: boolean }>(`/demands/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
    });
  },

  // 4b. Correct demand: POST /api/demands/<id>/correct
  async correctDemand(
    id: string,
    fields: {
      item_id?: string;
      item?: string;
      qty?: number;
      unit?: string;
      beneficiaries?: number;
      urgency?: string;
      location_text?: string;
      camp_id?: string;
      notes?: string;
    }
  ): Promise<ApiResponse<Demand>> {
    if (MOCK_MODE) {
      const found = inMemoryDemands.find((d) => d.id === id);
      if (found) {
        if (fields.item_id !== undefined) found.item_id = fields.item_id;
        if (fields.item !== undefined) found.item = fields.item;
        if (fields.qty !== undefined) found.qty = fields.qty;
        if (fields.unit !== undefined) found.unit = fields.unit;
        if (fields.beneficiaries !== undefined) found.beneficiaries = fields.beneficiaries;
        if (fields.urgency !== undefined) found.urgency = fields.urgency as any;
        if (fields.location_text !== undefined) found.location_text = fields.location_text;
        if (fields.camp_id !== undefined) found.camp_id = fields.camp_id;
        inMemoryAudit.unshift({
          id: `aud-${Date.now()}`,
          user: 'Aastha Jha (Coordinator)',
          action: 'edited',
          target_id: id,
          timestamp: new Date().toISOString(),
          notes: fields.notes || 'Corrected extracted fields via Review Queue',
        });
        return { ok: true, data: { ...found } };
      }
      return { ok: false, error: 'Demand not found', status: 404 };
    }

    return request<Demand>(`/demands/${encodeURIComponent(id)}/correct`, {
      method: 'POST',
      body: JSON.stringify(fields),
    });
  },

  // 5. Reject demand: POST /api/demands/<id>/reject
  async rejectDemand(id: string, reason: string): Promise<ApiResponse<{ verified: boolean; rejected: boolean }>> {
    if (MOCK_MODE) {
      const found = inMemoryDemands.find((d) => d.id === id);
      inMemoryDemands = inMemoryDemands.filter((d) => d.id !== id);
      inMemoryAudit.unshift({
        id: `aud-${Date.now()}`,
        user: 'Aastha Jha (Coordinator)',
        action: found?.source === 'public' ? 'rejected-public' : 'rejected',
        target_id: id,
        timestamp: new Date().toISOString(),
        notes: reason || 'Demand rejected by coordinator',
      });
      return { ok: true, data: { verified: false, rejected: true } };
    }

    return request<{ verified: boolean; rejected: boolean }>(`/demands/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // 6. Stock: GET /api/stock
  async getStock(): Promise<ApiResponse<SupplyLot[]>> {
    if (MOCK_MODE) {
      return { ok: true, data: [...inMemoryStock] };
    }
    return request<SupplyLot[]>('/stock');
  },

  // 7. Supply paste: POST /api/supply/paste
  async pasteSupply(text: string): Promise<ApiResponse<SupplyLot[]>> {
    if (MOCK_MODE) {
      const newLot: SupplyLot = {
        id: `stk-${Date.now()}`,
        item: text.toLowerCase().includes('water') ? 'Drinking water' : 'Relief kits',
        item_id: text.toLowerCase().includes('water') ? 'water' : 'food',
        qty: 1000,
        unit: 'units',
        depot_id: 'ludhiana-depot',
        depot_name: 'Ludhiana Depot',
        lat: 30.901,
        lng: 75.857,
        updated_at: new Date().toISOString(),
      };
      inMemoryStock.unshift(newLot);
      return { ok: true, data: [newLot] };
    }

    return request<SupplyLot[]>('/supply/paste', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  // 8. Supply CSV: POST /api/supply/csv
  async uploadSupplyCsv(file: File): Promise<ApiResponse<SupplyLot[]>> {
    if (MOCK_MODE) {
      const newLot: SupplyLot = {
        id: `stk-${Date.now()}`,
        item: 'CSV Import Lot',
        item_id: 'water',
        qty: 2500,
        unit: 'units',
        depot_id: 'amritsar-depot',
        depot_name: 'Amritsar Depot',
        lat: 31.634,
        lng: 74.872,
        updated_at: new Date().toISOString(),
      };
      inMemoryStock.unshift(newLot);
      return { ok: true, data: [newLot] };
    }

    const formData = new FormData();
    formData.append('file', file);
    return request<SupplyLot[]>('/supply/csv', {
      method: 'POST',
      body: formData,
    });
  },

  // 9. Match run: POST /api/match/run
  async runMatching(payload?: {
    weights?: { urgency?: number; fill?: number; proximity?: number };
    algorithm?: string;
  }): Promise<ApiResponse<PlanOutput>> {
    if (MOCK_MODE) {
      const plan: PlanOutput = {
        recommendations: inMemoryMoves,
        shortages: [
          { item: 'Drinking water', item_id: 'water', requested: 5000, available: 1000, shortage: 4000, camp: 'Camp 17', district: 'Gurdaspur', message: 'Shortage of 4,000 litres at Camp 17' },
          { item: 'Medical kits', item_id: 'medkit', requested: 500, available: 100, shortage: 400, camp: 'Camp 21', district: 'Patiala', message: 'Shortage of 400 kits at Camp 21' },
          { item: 'Tents', item_id: 'tent', requested: 300, available: 50, shortage: 250, camp: 'Camp 4', district: 'Firozpur', message: 'Shortage of 250 tents at Camp 4' },
          { item: 'Food packets', item_id: 'food', requested: 800, available: 200, shortage: 600, camp: 'Camp 9', district: 'Sangrur', message: 'Shortage of 600 packets at Camp 9' },
        ],
        surplus: [
          { item: 'Blankets', item_id: 'blanket', qty: 250, depot: 'Bathinda Depot' },
          { item: 'Food packets', item_id: 'food', qty: 400, depot: 'Ludhiana Depot' },
        ],
        algorithm: payload?.algorithm || 'Greedy Cost-Matrix with Haversine Road Factor 1.3',
        distance_sources: ['haversine'],
        conflicts: [
          {
            item: 'Drinking water',
            camps_competing: ['Camp 17 (Critical)', 'Camp 21 (Critical)', 'Camp 6 (High)'],
            winner: 'Camp 17',
            reason: 'Assigned to Camp 17 due to highest population (600) with 0h remaining safe supply.',
          },
          {
            item: 'Medical kits',
            camps_competing: ['Camp 8 (High)', 'Camp 4 (High)'],
            winner: 'Camp 8',
            reason: 'Assigned to Camp 8 due to reported acute disease cases.',
          },
        ],
        warnings: [
          {
            stock_id: 'stk-d3-1',
            item: 'Medical kits',
            age_hours: 8.5,
            message: 'Stock at Patiala Depot updated >8 hours ago. Verification recommended.',
          },
          {
            stock_id: 'stk-d5-1',
            item: 'Blankets',
            age_hours: 10.2,
            message: 'Stock at Bathinda Depot updated >10 hours ago.',
          },
        ],
      };
      return { ok: true, data: plan };
    }

    return request<PlanOutput>('/match/run', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },

  // 9b. Latest Plan: GET /api/plan/latest
  async getLatestPlan(): Promise<ApiResponse<PlanOutput>> {
    if (MOCK_MODE) {
      return this.runMatching();
    }
    return request<PlanOutput>('/plan/latest');
  },

  // 10. Approve move: POST /api/moves/<id>/approve
  async approveMove(id: string): Promise<ApiResponse<{ state: 'approved' }>> {
    if (MOCK_MODE) {
      const move = inMemoryMoves.find((m) => m.id === id);
      if (move) move.state = 'approved';
      inMemoryAudit.unshift({
        id: `aud-${Date.now()}`,
        user: 'Aastha Jha (Coordinator)',
        action: 'approved',
        target_id: id,
        timestamp: new Date().toISOString(),
        notes: `Approved move proposal ${id}`,
      });
      return { ok: true, data: { state: 'approved' } };
    }

    return request<{ state: 'approved' }>(`/moves/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    });
  },

  // 11. Edit move: POST /api/moves/<id>/edit
  async editMove(
    id: string,
    updates: { qty?: number; notes?: string }
  ): Promise<ApiResponse<{ state: 'edited' }>> {
    if (MOCK_MODE) {
      const move = inMemoryMoves.find((m) => m.id === id);
      if (move) {
        if (updates.qty !== undefined) move.qty = updates.qty;
        move.state = 'edited';
      }
      inMemoryAudit.unshift({
        id: `aud-${Date.now()}`,
        user: 'Aastha Jha (Coordinator)',
        action: 'edited',
        target_id: id,
        timestamp: new Date().toISOString(),
        notes: updates.notes || `Adjusted quantity to ${updates.qty}`,
      });
      return { ok: true, data: { state: 'edited' } };
    }

    return request<{ state: 'edited' }>(`/moves/${encodeURIComponent(id)}/edit`, {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  },

  // 12. Reject move: POST /api/moves/<id>/reject
  async rejectMove(id: string, reason: string): Promise<ApiResponse<{ state: 'rejected' }>> {
    if (MOCK_MODE) {
      const move = inMemoryMoves.find((m) => m.id === id);
      if (move) move.state = 'rejected';
      inMemoryAudit.unshift({
        id: `aud-${Date.now()}`,
        user: 'Aastha Jha (Coordinator)',
        action: 'rejected',
        target_id: id,
        timestamp: new Date().toISOString(),
        notes: reason || 'Move proposal rejected',
      });
      return { ok: true, data: { state: 'rejected' } };
    }

    return request<{ state: 'rejected' }>(`/moves/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // 13. Audit: GET /api/audit
  async getAudit(): Promise<ApiResponse<AuditEntry[]>> {
    if (MOCK_MODE) {
      return { ok: true, data: [...inMemoryAudit] };
    }
    return request<AuditEntry[]>('/audit');
  },

  // 14. Shortages: GET /api/shortages
  async getShortages(): Promise<ApiResponse<Shortage[]>> {
    if (MOCK_MODE) {
      return {
        ok: true,
        data: [
          { item: 'Drinking water', item_id: 'water', requested: 5000, available: 1000, shortage: 4000, camp: 'Camp 17', district: 'Gurdaspur', message: 'Shortage of 4,000 litres at Camp 17' },
          { item: 'Medical kits', item_id: 'medkit', requested: 500, available: 100, shortage: 400, camp: 'Camp 21', district: 'Patiala', message: 'Shortage of 400 kits at Camp 21' },
          { item: 'Tents', item_id: 'tent', requested: 300, available: 50, shortage: 250, camp: 'Camp 4', district: 'Firozpur', message: 'Shortage of 250 tents at Camp 4' },
          { item: 'Food packets', item_id: 'food', requested: 800, available: 200, shortage: 600, camp: 'Camp 9', district: 'Sangrur', message: 'Shortage of 600 packets at Camp 9' },
        ],
      };
    }
    return request<Shortage[]>('/shortages');
  },
};
