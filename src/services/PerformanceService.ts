import api from "./api";

export interface PerformanceRecord {
  _id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  managerId?: string;
  managerName: string;
  score: number;
  rating: "Excellent" | "Good" | "Average" | "Poor";
  cycle: string;
  reviewDate: string;
  notes: string;
  createdAt: string;
}

export interface PerformanceStats {
  avg: number;
  total: number;
  byRating: { rating: string; count: number }[];
  byCycle:  { cycle: string; count: number; avg: number }[];
}

const performanceService = {
  list: (filters?: { cycle?: string; department?: string; rating?: string; employeeId?: string }) =>
    api.get<PerformanceRecord[]>("/performance", { params: filters })
      .then(r => Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? []),

  stats: (cycle?: string) =>
    api.get<PerformanceStats>("/performance/stats", { params: cycle ? { cycle } : {} })
      .then(r => (r.data as any)?.data ?? r.data),

  upsert: (payload: {
    employeeId: string;
    cycle: string;
    score: number;
    notes?: string;
    reviewDate?: string;
    managerId?: string;
  }) =>
    api.post<PerformanceRecord>("/performance", payload)
      .then(r => (r.data as any)?.data ?? r.data),

  delete: (id: string) =>
    api.delete(`/performance/${id}`).then(r => r.data),
};

export default performanceService;