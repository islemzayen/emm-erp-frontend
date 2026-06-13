import api from "../api";

export type PurchaseRequestStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type PurchaseRequestPriority = "LOW" | "NORMAL" | "URGENT";

export const purchaseRequestService = {
  getAll: async () => (await api.get("/purchase/requests")).data,

  getById: async (id: string) => (await api.get(`/purchase/requests/${id}`)).data,

  create: async (payload: {
    requestNo: string;
    productId: string;
    requestedQuantity: number;
    department: string;
    availableBudget?: number;
    reason: string;
    priority?: PurchaseRequestPriority;
    status?: "DRAFT" | "SUBMITTED";
    notes?: string;
  }) => (await api.post("/purchase/requests", payload)).data,

  createFromAlert: async (
    alertId: string,
    payload: {
      requestNo: string;
      requestedQuantity: number;
      department?: string;
      availableBudget?: number;
      reason?: string;
      priority?: PurchaseRequestPriority;
      notes?: string;
    }
  ) => (await api.post(`/purchase/requests/from-alert/${alertId}`, payload)).data,

  updateStatus: async (
    id: string,
    status: "SUBMITTED" | "APPROVED" | "REJECTED",
    notes?: string
  ) => (await api.patch(`/purchase/requests/${id}/status`, { status, notes })).data,
};
