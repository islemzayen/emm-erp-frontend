import api from "@/services/api";

const unwrap = (r: any) => r.data?.data ?? r.data;

export interface MonthAllocation {
  month: string; allocated: number; spent: number; remaining: number;
}
export interface MarketingBudget {
  _id: string; year: number; annualBudget: number;
  totalAllocated: number; totalSpent: number;
  monthlyAllocations: MonthAllocation[];
}
export interface MarketingEvent {
  _id: string; title: string; type: string; description: string;
  date: string; monthKey: string; budget: number;
  status: "Planned" | "Done" | "Cancelled";
  budgetRequestStatus: "none" | "requested";
  budgetRequestNote: string;
}

export const EVENT_TYPES = [
  "Campaign Launch","Trade Fair","Press Conference","Product Launch",
  "Promotion","Social Media","Workshop","Networking","Sponsorship","Other",
];

export const budgetService = {
  get:      (year: number) => api.get(`/marketing/budget/${year}`).then(unwrap) as Promise<MarketingBudget>,
  setAnnual:(year: number, annualBudget: number) => api.post(`/marketing/budget/${year}`, { annualBudget }).then(unwrap) as Promise<MarketingBudget>,
  allocate: (year: number, allocations: { month: string; allocated: number }[]) =>
    api.patch(`/marketing/budget/${year}/allocate`, { allocations }).then(unwrap) as Promise<MarketingBudget>,
  transfer: (year: number, fromMonth: string, toMonth: string, amount: number) =>
    api.patch(`/marketing/budget/${year}/transfer`, { fromMonth, toMonth, amount }).then(unwrap) as Promise<MarketingBudget>,
};

export const eventService = {
  list:   (monthKey?: string) => api.get("/marketing/events", { params: monthKey ? { monthKey } : {} }).then(unwrap) as Promise<MarketingEvent[]>,
  create: (data: Partial<MarketingEvent>) => api.post("/marketing/events", data).then(unwrap) as Promise<MarketingEvent>,
  update: (id: string, data: Partial<MarketingEvent>) => api.patch(`/marketing/events/${id}`, data).then(unwrap) as Promise<MarketingEvent>,
  remove: (id: string) => api.delete(`/marketing/events/${id}`).then(unwrap),
  requestBudget: (id: string, note: string) => api.patch(`/marketing/events/${id}/request-budget`, { note }).then(unwrap),
};