import api from "../api";

export type SupplementaryRequestStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type SupplementaryRequestPriority = "LOW" | "NORMAL" | "URGENT";

export interface SupplementaryRequest {
  _id: string;
  requestNo: string;
  title: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  department: string;
  reason: string;
  priority: SupplementaryRequestPriority;
  status: SupplementaryRequestStatus;
  notes: string;
  createdBy: { _id: string; name: string; email: string; role: string } | null;
  handledBy: { _id: string; name: string; email: string; role: string } | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const supplementaryRequestService = {
  getAll: async (): Promise<SupplementaryRequest[]> =>
    (await api.get("/purchase/supplementary")).data,

  getById: async (id: string): Promise<SupplementaryRequest> =>
    (await api.get(`/purchase/supplementary/${id}`)).data,

  create: async (payload: {
    title: string;
    category?: string;
    quantity: number;
    unit?: string;
    estimatedCost?: number;
    department: string;
    reason: string;
    priority?: SupplementaryRequestPriority;
    notes?: string;
  }): Promise<SupplementaryRequest> =>
    (await api.post("/purchase/supplementary", payload)).data,

  submit: async (id: string): Promise<SupplementaryRequest> =>
    (await api.post(`/purchase/supplementary/${id}/submit`, {})).data,

  updateStatus: async (
    id: string,
    status: "APPROVED" | "REJECTED",
    notes?: string
  ): Promise<SupplementaryRequest> =>
    (await api.patch(`/purchase/supplementary/${id}/status`, { status, notes })).data,

  delete: async (id: string): Promise<void> => {
    await api.delete(`/purchase/supplementary/${id}`);
  },
};
