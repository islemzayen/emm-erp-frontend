import api from "./api";

// ── Employee types ────────────────────────────────────────────────────────────

export const marketingService = {
  getStats: async () => {
    const { data } = await api.get("/marketing/stats");
    return data;
  },
  getAllEmployees: async () => {
    const { data } = await api.get("/marketing/employees");
    return data;
  },
  createEmployee: async (employeeData: {
    name: string; position: string; phone: string; salary: number; joinedDate: string;
  }) => {
    const { data } = await api.post("/marketing/employees", employeeData);
    return data;
  },
  updateEmployee: async (id: string, employeeData: Partial<{
    name: string; position: string; phone: string; salary: number; joinedDate: string;
  }>) => {
    const { data } = await api.put(`/marketing/employees/${id}`, employeeData);
    return data;
  },
  deleteEmployee: async (id: string) => {
    const { data } = await api.delete(`/marketing/employees/${id}`);
    return data;
  },
  updateStatus: async (id: string, status: "Active" | "On Leave" | "Inactive") => {
    const { data } = await api.patch(`/marketing/employees/${id}/status`, { status });
    return data;
  },
};

// ── Campaign types ────────────────────────────────────────────────────────────

export interface Campaign {
  _id: string;
  name: string;
  channel: "Email" | "PPC" | "Social" | "Display" | "Video" | "Other";
  status: "Active" | "Paused" | "Planned" | "Completed";
  leads: number;
  budget: number;
  spend: number;
  startDate: string;
  endDate: string;
  description: string;
  impressions: number;
  openRate: number;
  ctr: number;
  conversionRate: number;
  createdAt: string;
}

export interface CampaignStats {
  total: number;
  active: number;
  totalLeads: number;
  totalBudget: number;
  totalSpend: number;
  cpl: number;
  roi: number;
}

export interface CampaignAnalytics {
  kpis: { openRate: number; ctr: number; conversionRate: number; impressions: number };
  byChannel: { channel: string; open: number; ctr: number; conv: number }[];
  monthly: { month: string; leads: number; spend: number }[];
}

const unwrapArr = (r: any): any[] =>
  Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? [];

export const campaignService = {
  getAll: (filters?: { status?: string; channel?: string }) =>
    api.get<Campaign[]>("/campaigns", { params: filters }).then(unwrapArr),

  getStats: () =>
    api.get<CampaignStats>("/campaigns/stats").then(r => (r.data as any)?.data ?? r.data),

  getAnalytics: () =>
    api.get<CampaignAnalytics>("/campaigns/analytics").then(r => (r.data as any)?.data ?? r.data),

  create: (data: Partial<Campaign>) =>
    api.post<Campaign>("/campaigns", data).then(r => (r.data as any)?.data ?? r.data),

  update: (id: string, data: Partial<Campaign>) =>
    api.put<Campaign>(`/campaigns/${id}`, data).then(r => (r.data as any)?.data ?? r.data),

  remove: (id: string) =>
    api.delete(`/campaigns/${id}`).then(r => r.data),
};

// ── Promotion types ───────────────────────────────────────────────────────────

export interface Promotion {
  _id: string;
  name: string;
  discount: number;
  type: "Seasonal" | "Loyalty" | "Referral" | "VIP" | "Other";
  status: "Active" | "Scheduled" | "Paused" | "Completed";
  code: string;
  startDate: string;
  endDate: string;
  description: string;
  createdAt: string;
}

export interface PromotionStats {
  total: number;
  active: number;
  scheduled: number;
  avgDiscount: number;
}

export const promotionService = {
  getAll: (filters?: { status?: string; type?: string }) =>
    api.get<Promotion[]>("/promotions", { params: filters }).then(unwrapArr),

  getStats: () =>
    api.get<PromotionStats>("/promotions/stats").then(r => (r.data as any)?.data ?? r.data),

  create: (data: Partial<Promotion>) =>
    api.post<Promotion>("/promotions", data).then(r => (r.data as any)?.data ?? r.data),

  update: (id: string, data: Partial<Promotion>) =>
    api.put<Promotion>(`/promotions/${id}`, data).then(r => (r.data as any)?.data ?? r.data),

  remove: (id: string) =>
    api.delete(`/promotions/${id}`).then(r => r.data),
};

// ── Segment types ─────────────────────────────────────────────────────────────

export interface Segment {
  _id: string;
  name: string;
  customers: number;
  avgSpend: number;
  growthPct: number;
  regionType: "Country" | "Continent";
  region: string;
  status: "Growing" | "Stable" | "Declining" | "At Risk" | "To Discover";
  description: string;
  createdAt: string;
}

export interface SegmentStats {
  total: number;
  totalCustomers: number;
  growing: number;
  atRisk: number;
}

export const segmentService = {
  getAll: (filters?: { status?: string }) =>
    api.get<Segment[]>("/segments", { params: filters }).then(unwrapArr),

  getStats: () =>
    api.get<SegmentStats>("/segments/stats").then(r => (r.data as any)?.data ?? r.data),

  create: (data: Partial<Segment>) =>
    api.post<Segment>("/segments", data).then(r => (r.data as any)?.data ?? r.data),

  update: (id: string, data: Partial<Segment>) =>
    api.put<Segment>(`/segments/${id}`, data).then(r => (r.data as any)?.data ?? r.data),

  remove: (id: string) =>
    api.delete(`/segments/${id}`).then(r => r.data),
};