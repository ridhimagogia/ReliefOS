export type Urgency = "Critical" | "High" | "Medium" | "Low";

export type Location = {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
  type: "depot" | "camp";
  urgency?: Urgency;
  population?: number;
  coverage?: number;
};

export const locations: Location[] = [
  { id: "d1", name: "Ludhiana Depot", district: "Ludhiana", lat: 30.901, lng: 75.857, x: 65, y: 58, type: "depot" },
  { id: "d2", name: "Amritsar Depot", district: "Amritsar", lat: 31.634, lng: 74.872, x: 34, y: 27, type: "depot" },
  { id: "d3", name: "Patiala Depot", district: "Patiala", lat: 30.339, lng: 76.386, x: 75, y: 75, type: "depot" },
  { id: "d4", name: "Jalandhar Depot", district: "Jalandhar", lat: 31.326, lng: 75.576, x: 48, y: 43, type: "depot" },
  { id: "d5", name: "Bathinda Depot", district: "Bathinda", lat: 30.211, lng: 74.945, x: 37, y: 80, type: "depot" },
  { id: "c17", name: "Camp 17", district: "Gurdaspur", lat: 31.933, lng: 75.923, x: 67, y: 25, type: "camp", urgency: "Critical", population: 600, coverage: 40 },
  { id: "c4", name: "Camp 4", district: "Firozpur", lat: 30.933, lng: 74.622, x: 23, y: 58, type: "camp", urgency: "High", population: 200, coverage: 70 },
  { id: "c8", name: "Camp 8", district: "Hoshiarpur", lat: 31.514, lng: 75.911, x: 75, y: 34, type: "camp", urgency: "Medium", population: 350, coverage: 90 },
  { id: "c12", name: "Camp 12", district: "Ludhiana", lat: 30.9, lng: 75.85, x: 62, y: 57, type: "camp", urgency: "Medium", population: 400, coverage: 60 },
  { id: "c21", name: "Camp 21", district: "Patiala", lat: 30.34, lng: 76.38, x: 82, y: 72, type: "camp", urgency: "Critical", population: 300, coverage: 30 },
  { id: "c3", name: "Camp 3", district: "Amritsar", lat: 31.63, lng: 74.87, x: 29, y: 37, type: "camp", urgency: "Low", population: 500, coverage: 100 },
  { id: "c9", name: "Camp 9", district: "Sangrur", lat: 30.25, lng: 75.84, x: 58, y: 72, type: "camp", urgency: "Medium", population: 250, coverage: 75 },
  { id: "c6", name: "Camp 6", district: "Jalandhar", lat: 31.32, lng: 75.57, x: 49, y: 39, type: "camp", urgency: "High", population: 450, coverage: 50 },
];

export const reviewReports = [
  { id: 1, title: "Camp 17 needs drinking water...", camp: "Camp 17", district: "Gurdaspur", source: "Pasted WhatsApp", time: "10:32", urgency: "Critical" as Urgency },
  { id: 2, title: "Medical supplies required for...", camp: "Camp 4", district: "Amritsar", source: "SMS", time: "09:15", urgency: "High" as Urgency },
  { id: 3, title: "Tents needed for 120 families", camp: "Camp 9", district: "Pathankot", source: "Field Form", time: "08:40", urgency: "Medium" as Urgency },
  { id: 4, title: "Food packets for affected people", camp: "Camp 21", district: "Ludhiana", source: "WhatsApp", time: "08:12", urgency: "Medium" as Urgency },
  { id: 5, title: "Sanitation kits request", camp: "Camp 3", district: "Ferozepur", source: "Field Form", time: "07:50", urgency: "Low" as Urgency },
  { id: 6, title: "Blankets for elderly people", camp: "Camp 12", district: "Hoshiarpur", source: "Pasted WhatsApp", time: "06:28", urgency: "Medium" as Urgency },
  { id: 7, title: "Baby food and diapers needed", camp: "Camp 6", district: "Patiala", source: "SMS", time: "05:41", urgency: "Critical" as Urgency },
];

export const moves = [
  { id: 1, item: "5,000 water units", from: "Ludhiana Depot", to: "Camp 17", district: "Gurdaspur", urgency: "High" as Urgency, distance: 12, time: 4, vehicle: "Truck (5,000 units)", coverage: 100, source: "Haversine estimate", fromId: "d1", toId: "c17" },
  { id: 2, item: "200 tents", from: "Amritsar Depot", to: "Camp 4", district: "Firozpur", urgency: "High" as Urgency, distance: 48, time: 6, vehicle: "Truck (2,000 units)", coverage: 100, source: "Haversine estimate", fromId: "d2", toId: "c4" },
  { id: 3, item: "150 medical kits", from: "Patiala Depot", to: "Camp 8", district: "Hoshiarpur", urgency: "Medium" as Urgency, distance: 72, time: 8, vehicle: "Truck (500 units)", coverage: 80, source: "Haversine estimate", fromId: "d3", toId: "c8" },
  { id: 4, item: "1,200 food packets", from: "Jalandhar Depot", to: "Camp 12", district: "Ludhiana", urgency: "Medium" as Urgency, distance: 36, time: 5, vehicle: "Truck (1,500 units)", coverage: 90, source: "Haversine estimate", fromId: "d4", toId: "c12" },
  { id: 5, item: "800 blankets", from: "Bathinda Depot", to: "Camp 21", district: "Patiala", urgency: "Low" as Urgency, distance: 90, time: 9, vehicle: "Truck (1,000 units)", coverage: 75, source: "Haversine estimate", fromId: "d5", toId: "c21" },
];

export const depots = [
  { id: "d1", name: "Ludhiana Depot", district: "Ludhiana", items: 12, units: 5400 },
  { id: "d2", name: "Amritsar Depot", district: "Amritsar", items: 8, units: 3200 },
  { id: "d3", name: "Patiala Depot", district: "Patiala", items: 10, units: 2800 },
  { id: "d4", name: "Jalandhar Depot", district: "Jalandhar", items: 8, units: 2100 },
  { id: "d5", name: "Bathinda Depot", district: "Bathinda", items: 7, units: 1600 },
];

export const inventory = [
  { item: "Drinking water", available: 4000, reserved: 1000, total: 5000, unit: "units", updated: "18 Oct, 10:20" },
  { item: "Tents", available: 800, reserved: 200, total: 1000, unit: "units", updated: "18 Oct, 09:15" },
  { item: "Medical kits", available: 300, reserved: 150, total: 450, unit: "kits", updated: "18 Oct, 10:05" },
  { item: "Food packets", available: 1800, reserved: 400, total: 2200, unit: "packets", updated: "18 Oct, 09:50" },
  { item: "Blankets", available: 600, reserved: 200, total: 800, unit: "units", updated: "18 Oct, 09:30" },
  { item: "Hygiene kits", available: 700, reserved: 100, total: 800, unit: "kits", updated: "18 Oct, 09:10" },
];

export const demands = locations.filter((location) => location.type === "camp").map((camp, index) => ({
  ...camp,
  needs: [["Water", "Tents"], ["Tents", "Food"], ["Medical", "Food"], ["Food", "Blankets"], ["Medical", "Water"], ["Water", "Hygiene"], ["Tents", "Food"], ["Blankets", "Hygiene"]][index],
}));
