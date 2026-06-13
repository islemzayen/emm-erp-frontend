import api from "../api";

export interface RmaLine {
  productId: { _id: string; name: string; sku: string } | null;
  quantity: number;
  reason?: string;
}

export interface Rma {
  _id: string;
  rmaNo: string;
  salesOrderId: { _id: string; orderNo: string; status: string } | null;
  orderNo: string;
  customerName: string;
  lines: RmaLine[];
  status: "OPEN" | "RECEIVED" | "RESTOCKED" | "DISPOSED" | "CLOSED" | "CANCELLED";
  resolution: "PENDING" | "RESTOCK" | "DESTROY";
  notes?: string;
  receivedAt?: string;
  processedAt?: string;
  closedAt?: string;
  cancelledAt?: string;
  createdAt?: string;
  createdBy?: { _id: string; name: string; email: string; role: string } | null;
  handledBy?: { _id: string; name: string; email: string; role: string } | null;
}

export interface CreateRmaPayload {
  salesOrderId: string;
  notes?: string;
  lines: Array<{
    productId: string;
    quantity: number;
    reason?: string;
  }>;
}

export const rmaService = {
  getAll: async (): Promise<Rma[]> => (await api.get("/commercial/rmas")).data,

  getById: async (id: string): Promise<Rma> =>
    (await api.get(`/commercial/rmas/${id}`)).data,

  create: async (payload: CreateRmaPayload): Promise<Rma> =>
    (await api.post("/commercial/rmas", payload)).data,

  receive: async (id: string): Promise<Rma> =>
    (await api.post(`/commercial/rmas/${id}/receive`)).data,

  process: async (
    id: string,
    payload: { resolution: "RESTOCK" | "DESTROY"; notes?: string }
  ): Promise<Rma> => (await api.post(`/commercial/rmas/${id}/process`, payload)).data,

  close: async (id: string): Promise<Rma> =>
    (await api.post(`/commercial/rmas/${id}/close`)).data,

  cancel: async (id: string): Promise<Rma> =>
    (await api.post(`/commercial/rmas/${id}/cancel`)).data,
};
