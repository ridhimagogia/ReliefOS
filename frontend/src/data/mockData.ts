import type {
  AuditEntry,
  Demand,
  Move,
  PlanOutput,
  Shortage,
  SupplyLot,
  Surplus,
} from '../types';

export type Urgency = 'Critical' | 'High' | 'Medium' | 'Low';

export type Location = {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
  type: 'depot' | 'camp';
  urgency?: Urgency;
  population?: number;
  coverage?: number;
};

// Depots and camps in Punjab for offline vector map and coordinate lookup
export const locations: Location[] = [
  { id: 'd1', name: 'Ludhiana Depot', district: 'Ludhiana', lat: 30.901, lng: 75.857, x: 65, y: 58, type: 'depot' },
  { id: 'd2', name: 'Amritsar Depot', district: 'Amritsar', lat: 31.634, lng: 74.872, x: 34, y: 27, type: 'depot' },
  { id: 'd3', name: 'Patiala Depot', district: 'Patiala', lat: 30.339, lng: 76.386, x: 75, y: 75, type: 'depot' },
  { id: 'd4', name: 'Jalandhar Depot', district: 'Jalandhar', lat: 31.326, lng: 75.576, x: 48, y: 43, type: 'depot' },
  { id: 'd5', name: 'Bathinda Depot', district: 'Bathinda', lat: 30.211, lng: 74.945, x: 37, y: 80, type: 'depot' },
  { id: 'c17', name: 'Camp 17', district: 'Gurdaspur', lat: 31.933, lng: 75.923, x: 67, y: 25, type: 'camp', urgency: 'Critical', population: 600, coverage: 40 },
  { id: 'c4', name: 'Camp 4', district: 'Firozpur', lat: 30.933, lng: 74.622, x: 23, y: 58, type: 'camp', urgency: 'High', population: 200, coverage: 70 },
  { id: 'c8', name: 'Camp 8', district: 'Hoshiarpur', lat: 31.514, lng: 75.911, x: 75, y: 34, type: 'camp', urgency: 'Medium', population: 350, coverage: 90 },
  { id: 'c12', name: 'Camp 12', district: 'Ludhiana', lat: 30.9, lng: 75.85, x: 62, y: 57, type: 'camp', urgency: 'Medium', population: 400, coverage: 60 },
  { id: 'c21', name: 'Camp 21', district: 'Patiala', lat: 30.34, lng: 76.38, x: 82, y: 72, type: 'camp', urgency: 'Critical', population: 300, coverage: 30 },
  { id: 'c3', name: 'Camp 3', district: 'Amritsar', lat: 31.63, lng: 74.87, x: 29, y: 37, type: 'camp', urgency: 'Low', population: 500, coverage: 100 },
  { id: 'c9', name: 'Camp 9', district: 'Sangrur', lat: 30.25, lng: 75.84, x: 58, y: 72, type: 'camp', urgency: 'Medium', population: 250, coverage: 75 },
  { id: 'c6', name: 'Camp 6', district: 'Jalandhar', lat: 31.32, lng: 75.57, x: 49, y: 39, type: 'camp', urgency: 'High', population: 450, coverage: 50 },
];

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
const minutesAgo = (m: number) => new Date(now - m * 60 * 1000).toISOString();

// Section 4 Demand Schema
export const mockDemands: Demand[] = [
  {
    id: 'dem-c17-1',
    item: 'Drinking water',
    qty: 600,
    unit: 'litres',
    location_text: 'Camp 17, Gurdaspur',
    camp_id: 'c17',
    beneficiaries: 600,
    urgency: 'critical',
    confidence: 0.94,
    provider: 'gemini',
    needs_review: false,
    raw_text: 'Camp 17 needs drinking water for approx 600 people, urgent. Borewell contaminated since morning.',
    source: 'coordinator',
    verified: true,
    kind: 'demand',
    language: 'en',
    duplicate_of: null,
    report_count: 1,
  },
  {
    id: 'dem-c4-1',
    item: 'Tents',
    qty: 200,
    unit: 'units',
    location_text: 'Camp 4, Firozpur',
    camp_id: 'c4',
    beneficiaries: 200,
    urgency: 'high',
    confidence: 0.91,
    provider: 'rules',
    needs_review: false,
    raw_text: 'Camp 4 needs 200 waterproof tents immediately for newly displaced families.',
    source: 'coordinator',
    verified: true,
    kind: 'demand',
    language: 'en',
    duplicate_of: null,
    report_count: 1,
  },
  {
    id: 'dem-pub-c21',
    item: 'Drinking water',
    qty: 400,
    unit: 'litres',
    location_text: 'Sector 4, near Camp 21, Patiala',
    camp_id: 'c21',
    beneficiaries: 300,
    urgency: 'critical',
    confidence: 0.72,
    provider: 'gemini',
    needs_review: true,
    raw_text: 'Camp 21 paani bilkul khatam ho chuka hai 300 log hain urgent madad chahiye',
    source: 'public',
    verified: false,
    kind: 'demand',
    language: 'hinglish',
    duplicate_of: null,
    report_count: 30, // Example of USP: 30 reports from one area = 1 need with report_count 30
  },
  {
    id: 'dem-pub-c21-dup1',
    item: 'Drinking water',
    qty: 400,
    unit: 'litres',
    location_text: 'Camp 21 Patiala gate 2',
    camp_id: 'c21',
    beneficiaries: 250,
    urgency: 'critical',
    confidence: 0.68,
    provider: 'rules',
    needs_review: true,
    raw_text: 'paani bhejo camp 21 patiala',
    source: 'public',
    verified: false,
    kind: 'demand',
    language: 'hinglish',
    duplicate_of: 'dem-pub-c21',
    report_count: 1,
  },
  {
    id: 'dem-pub-c8',
    item: 'Medical supplies',
    qty: 150,
    unit: 'kits',
    location_text: 'Village road near Camp 8, Hoshiarpur',
    camp_id: 'c8',
    beneficiaries: 150,
    urgency: 'high',
    confidence: 0.65,
    provider: 'rules',
    needs_review: true,
    raw_text: 'Camp 8 me bukhar aur infection fail raha hai, medical kits required as soon as possible',
    source: 'public',
    verified: false,
    kind: 'demand',
    language: 'hinglish',
    duplicate_of: null,
    report_count: 4,
  },
  {
    id: 'dem-c12-1',
    item: 'Food packets',
    qty: 1200,
    unit: 'packets',
    location_text: 'Camp 12, Ludhiana',
    camp_id: 'c12',
    beneficiaries: 400,
    urgency: 'medium',
    confidence: 0.88,
    provider: 'gemini',
    needs_review: false,
    raw_text: 'Camp 12 requests 1200 food packets for midday distribution.',
    source: 'coordinator',
    verified: true,
    kind: 'demand',
    language: 'en',
    duplicate_of: null,
    report_count: 1,
  },
  {
    id: 'dem-c9-1',
    item: 'Food packets',
    qty: 800,
    unit: 'packets',
    location_text: 'Camp 9, Sangrur',
    camp_id: 'c9',
    beneficiaries: 250,
    urgency: 'medium',
    confidence: 0.85,
    provider: 'gemini',
    needs_review: false,
    raw_text: 'Camp 9 requires 800 dry ration food packets for 250 people.',
    source: 'coordinator',
    verified: true,
    kind: 'demand',
    language: 'en',
    duplicate_of: null,
    report_count: 1,
  },
  {
    id: 'dem-pub-c6',
    item: 'Baby food and diapers',
    qty: 80,
    unit: 'kits',
    location_text: 'Shelter at Camp 6, Jalandhar',
    camp_id: 'c6',
    beneficiaries: 80,
    urgency: 'critical',
    confidence: 0.55,
    provider: 'rules',
    needs_review: true,
    raw_text: 'Camp 6 mein chhote bachon ke liye doodh aur baby food bilkul nahi hai urgent help',
    source: 'public',
    verified: false,
    kind: 'demand',
    language: 'hinglish',
    duplicate_of: null,
    report_count: 5,
  },
  {
    id: 'dem-c3-1',
    item: 'Sanitation kits',
    qty: 300,
    unit: 'kits',
    location_text: 'Camp 3, Amritsar',
    camp_id: 'c3',
    beneficiaries: 500,
    urgency: 'low',
    confidence: 0.82,
    provider: 'rules',
    needs_review: false,
    raw_text: 'Camp 3 standard sanitation replenishment 300 kits.',
    source: 'coordinator',
    verified: true,
    kind: 'demand',
    language: 'en',
    duplicate_of: null,
    report_count: 1,
  },
];

// Section 4 SupplyLot Schema with updated_at (recent and >6h stale)
export const mockSupplyLots: SupplyLot[] = [
  {
    id: 'stk-d1-1',
    item: 'Drinking water',
    qty: 5000,
    unit: 'litres',
    depot_id: 'd1',
    lat: 30.901,
    lng: 75.857,
    updated_at: hoursAgo(2), // 2 hours ago (Fresh)
  },
  {
    id: 'stk-d2-1',
    item: 'Tents',
    qty: 800,
    unit: 'units',
    depot_id: 'd2',
    lat: 31.634,
    lng: 74.872,
    updated_at: hoursAgo(1.5), // 1.5 hours ago (Fresh)
  },
  {
    id: 'stk-d3-1',
    item: 'Medical kits',
    qty: 300,
    unit: 'kits',
    depot_id: 'd3',
    lat: 30.339,
    lng: 76.386,
    updated_at: hoursAgo(8.5), // 8.5 hours ago (>6h STALE)
  },
  {
    id: 'stk-d4-1',
    item: 'Food packets',
    qty: 1800,
    unit: 'packets',
    depot_id: 'd4',
    lat: 31.326,
    lng: 75.576,
    updated_at: hoursAgo(3), // 3 hours ago (Fresh)
  },
  {
    id: 'stk-d5-1',
    item: 'Blankets',
    qty: 600,
    unit: 'units',
    depot_id: 'd5',
    lat: 30.211,
    lng: 74.945,
    updated_at: hoursAgo(10), // 10 hours ago (>6h STALE)
  },
  {
    id: 'stk-d1-2',
    item: 'Hygiene kits',
    qty: 700,
    unit: 'kits',
    depot_id: 'd1',
    lat: 30.901,
    lng: 75.857,
    updated_at: hoursAgo(4), // 4 hours ago (Fresh)
  },
];

// Section 4 Move Proposals
export const mockMoves: Move[] = [
  {
    id: 'mov-1',
    demand_id: 'dem-c17-1',
    stock_id: 'stk-d1-1',
    vehicle_id: 'trk-101',
    qty: 600,
    km: 114.2,
    eta_h: 2.5,
    score: 0.94,
    item_id: 'Drinking water',
    distance_source: 'OSRM / Haversine fallback',
    trips: 1,
    reason: { proximity_km: 114.2, stock_avail: 5000, urgency: 'critical', priority_rank: 1 },
    explain: 'Truck 101 → Camp 17: closest depot (Ludhiana, 114 km), Critical camp with 600 people, zero clean water on site',
    state: 'pending',
  },
  {
    id: 'mov-2',
    demand_id: 'dem-c4-1',
    stock_id: 'stk-d2-1',
    vehicle_id: 'trk-102',
    qty: 200,
    km: 84.5,
    eta_h: 1.8,
    score: 0.88,
    item_id: 'Tents',
    distance_source: 'OSRM / Haversine fallback',
    trips: 1,
    reason: { proximity_km: 84.5, stock_avail: 800, urgency: 'high', priority_rank: 2 },
    explain: 'Truck 102 → Camp 4: nearest depot with 200 waterproof shelters, high-urgency displacement zone',
    state: 'pending',
  },
  {
    id: 'mov-3',
    demand_id: 'dem-c12-1',
    stock_id: 'stk-d4-1',
    vehicle_id: 'trk-103',
    qty: 1200,
    km: 36.1,
    eta_h: 0.9,
    score: 0.82,
    item_id: 'Food packets',
    distance_source: 'OSRM / Haversine fallback',
    trips: 1,
    reason: { proximity_km: 36.1, stock_avail: 1800, urgency: 'medium', priority_rank: 3 },
    explain: 'Truck 103 → Camp 12: rapid direct route (36 km, 0.9h) meeting 100% of camp nutritional demand',
    state: 'approved',
  },
  {
    id: 'mov-4',
    demand_id: 'dem-c8-1',
    stock_id: 'stk-d3-1',
    vehicle_id: 'trk-104',
    qty: 150,
    km: 72.0,
    eta_h: 1.6,
    score: 0.79,
    item_id: 'Medical kits',
    distance_source: 'Haversine estimate',
    trips: 1,
    reason: { proximity_km: 72.0, stock_avail: 300, urgency: 'high', warning: 'stale_stock' },
    explain: 'Truck 104 → Camp 8: allocated 150 medical kits from Patiala Depot (note: stock updated 8.5h ago)',
    state: 'pending',
  },
  {
    id: 'mov-5',
    demand_id: 'dem-c21-1',
    stock_id: 'stk-d5-1',
    vehicle_id: 'trk-105',
    qty: 300,
    km: 90.4,
    eta_h: 2.1,
    score: 0.75,
    item_id: 'Blankets',
    distance_source: 'Haversine estimate',
    trips: 1,
    reason: { proximity_km: 90.4, stock_avail: 600, urgency: 'low' },
    explain: 'Truck 105 → Camp 21: secondary run for 300 winter blankets from Bathinda Depot',
    state: 'pending',
  },
];

export const mockShortages: Shortage[] = [
  { item: 'Drinking water', requested: 5000, available: 1000, shortage: 4000, camp: 'Camp 17', camp_id: 'c17' },
  { item: 'Medical kits', requested: 500, available: 100, shortage: 400, camp: 'Camp 21', camp_id: 'c21' },
  { item: 'Tents', requested: 300, available: 50, shortage: 250, camp: 'Camp 4', camp_id: 'c4' },
  { item: 'Food packets', requested: 800, available: 200, shortage: 600, camp: 'Camp 9', camp_id: 'c9' },
];

export const mockSurplus: Surplus[] = [
  { item: 'Blankets', qty: 250, depot: 'Bathinda Depot', depot_id: 'd5' },
  { item: 'Hygiene kits', qty: 400, depot: 'Ludhiana Depot', depot_id: 'd1' },
];

export const mockPlanOutput: PlanOutput = {
  recommendations: mockMoves,
  shortages: mockShortages,
  surplus: mockSurplus,
  algorithm: 'Greedy Cost-Matrix with Haversine Road Factor 1.35',
  distance_sources: ['OSRM Local Server', 'Haversine fallback'],
  conflicts: [
    {
      item: 'Drinking water (5,000 L lot)',
      camps_competing: ['Camp 17 (Critical, 600 people)', 'Camp 21 (Critical, 300 people)', 'Camp 6 (High, 450 people)'],
      winner: 'Camp 17',
      reason: 'Three camps competed for one truckload. Won by Camp 17: higher population, 0h clean water reserve, verified hospital isolation wing.',
    },
    {
      item: 'Medical kits (150 kits)',
      camps_competing: ['Camp 8 (High)', 'Camp 4 (High)'],
      winner: 'Camp 8',
      reason: 'Won by Camp 8 due to reported acute outbreak clusters and closer depot distance (72 km vs 118 km).',
    },
  ],
  warnings: [
    {
      stock_id: 'stk-d3-1',
      item: 'Medical kits',
      age_hours: 8.5,
      message: 'Stock at Patiala Depot was updated 8.5 hours ago (>6h threshold). Radio confirmation advised before dispatch.',
    },
    {
      stock_id: 'stk-d5-1',
      item: 'Blankets',
      age_hours: 10.0,
      message: 'Stock at Bathinda Depot was updated 10 hours ago (>6h threshold). Physical count recommended.',
    },
  ],
};

export const mockAudit: AuditEntry[] = [
  {
    id: 'aud-4',
    user: 'Aastha Jha (Coordinator)',
    action: 'approved',
    target_id: 'mov-3',
    timestamp: minutesAgo(12),
    notes: 'Approved standard food packet dispatch to Camp 12',
  },
  {
    id: 'aud-3',
    user: 'Aastha Jha (Coordinator)',
    action: 'verified',
    target_id: 'dem-pub-c21',
    timestamp: minutesAgo(28),
    notes: 'Verified WhatsApp cluster report (30 reports) after field radio check',
  },
  {
    id: 'aud-2',
    user: 'Aastha Jha (Coordinator)',
    action: 'edited',
    target_id: 'mov-2',
    timestamp: minutesAgo(45),
    notes: 'Adjusted tent quantity to 200 units to match vehicle weight limit',
  },
  {
    id: 'aud-1',
    user: 'Rules Engine',
    action: 'rejected-public',
    target_id: 'rep-spam-09',
    timestamp: hoursAgo(2),
    notes: 'Auto-filtered non-disaster inquiry spam',
  },
];

// Backward-compatibility exports for untouched components in App.tsx
export const reviewReports = mockDemands
  .filter((d) => d.needs_review)
  .map((d, index) => ({
    id: index + 1,
    demandId: d.id,
    title: d.raw_text,
    camp: d.location_text || 'Unknown Camp',
    district: d.location_text?.split(',')[1]?.trim() || 'Punjab',
    source: d.source === 'coordinator' ? 'Pasted WhatsApp' : 'Public Report',
    time: '10:32',
    urgency: (d.urgency.charAt(0).toUpperCase() + d.urgency.slice(1)) as Urgency,
    confidence: d.confidence,
    raw_text: d.raw_text,
    verified: d.verified,
    report_count: d.report_count,
  }));

export const moves = mockMoves.map((m, index) => ({
  id: index + 1,
  moveId: m.id,
  item: `${m.qty.toLocaleString()} ${m.item_id}`,
  from: m.stock_id === 'stk-d1-1' ? 'Ludhiana Depot' : m.stock_id === 'stk-d2-1' ? 'Amritsar Depot' : 'Patiala Depot',
  to: m.demand_id === 'dem-c17-1' ? 'Camp 17' : m.demand_id === 'dem-c4-1' ? 'Camp 4' : 'Camp 12',
  district: m.demand_id === 'dem-c17-1' ? 'Gurdaspur' : m.demand_id === 'dem-c4-1' ? 'Firozpur' : 'Ludhiana',
  urgency: 'High' as Urgency,
  distance: m.km,
  time: Math.round(m.eta_h),
  vehicle: `Truck (${m.qty} units)`,
  coverage: 100,
  source: m.distance_source,
  fromId: m.stock_id.includes('d1') ? 'd1' : m.stock_id.includes('d2') ? 'd2' : 'd3',
  toId: m.demand_id.includes('c17') ? 'c17' : m.demand_id.includes('c4') ? 'c4' : 'c12',
  explain: m.explain,
  state: m.state,
}));

export const depots = [
  { id: 'd1', name: 'Ludhiana Depot', district: 'Ludhiana', items: 12, units: 5400, lat: 30.901, lng: 75.857 },
  { id: 'd2', name: 'Amritsar Depot', district: 'Amritsar', items: 8, units: 3200, lat: 31.634, lng: 74.872 },
  { id: 'd3', name: 'Patiala Depot', district: 'Patiala', items: 10, units: 2800, lat: 30.339, lng: 76.386 },
  { id: 'd4', name: 'Jalandhar Depot', district: 'Jalandhar', items: 8, units: 2100, lat: 31.326, lng: 75.576 },
  { id: 'd5', name: 'Bathinda Depot', district: 'Bathinda', items: 7, units: 1600, lat: 30.211, lng: 74.945 },
];

export const inventory = mockSupplyLots.map((s) => ({
  id: s.id,
  item: s.item,
  available: s.qty,
  reserved: Math.round(s.qty * 0.2),
  total: Math.round(s.qty * 1.2),
  unit: s.unit,
  updated: s.updated_at,
  depot_id: s.depot_id,
}));

export const demands = locations
  .filter((loc) => loc.type === 'camp')
  .map((camp, index) => ({
    ...camp,
    needs: [
      ['Drinking water', 'Tents'],
      ['Tents', 'Food packets'],
      ['Medical kits', 'Drinking water'],
      ['Food packets', 'Blankets'],
      ['Medical kits', 'Drinking water'],
      ['Drinking water', 'Hygiene kits'],
      ['Tents', 'Food packets'],
      ['Blankets', 'Hygiene kits'],
    ][index % 8],
  }));
