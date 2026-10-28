import { demands, depots, inventory, locations, moves, reviewReports } from "../data/mockData";

export const MOCK_MODE = true;
const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  async dashboard() {
    await wait(120);
    return { demands, depots, inventory, locations, moves, reviewReports };
  },
  async submitReport<T>(report: T): Promise<T> {
    await wait();
    if (!navigator.onLine) throw new Error("No network connection");
    return report;
  },
  async approveReport(id: number) {
    await wait();
    return { id, status: "Approved" };
  },
  async rejectReport(id: number, reason: string) {
    await wait();
    if (!reason.trim()) throw new Error("A rejection reason is required");
    return { id, status: "Rejected" };
  },
  async approveMove(id: number) {
    await wait(600);
    return { id, status: "Approved" };
  },
  async runMatching() {
    await wait(650);
    return moves;
  },
};
