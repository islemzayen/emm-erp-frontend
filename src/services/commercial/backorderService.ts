import api from "../api";

export interface BackOrderLine {
  productId: { _id: string; name: string; sku: string } | null;
  quantityOrdered: number;
  quantityReserved: number;
  quantityBackordered: number;
}

export interface BackOrder {
  _id: string;
  salesOrderId: { _id: string; orderNo: string; status: string } | null;
  orderNo: string;
  customerName: string;
  lines: BackOrderLine[];
  status: "PENDING" | "FULFILLED" | "CANCELLED";
  productionRequestStatus?: "NONE" | "PENDING" | "DONE";
  productionRequestedAt?: string;
  productionCompletedAt?: string;
  fulfilledAt?: string;
  cancelledAt?: string;
  notes?: string;
  createdAt?: string;
}

export const backorderService = {
  getAll: async (): Promise<BackOrder[]> => (await api.get("/commercial/backorders")).data,

  getById: async (id: string): Promise<BackOrder> =>
    (await api.get(`/commercial/backorders/${id}`)).data,

  fulfill: async (id: string): Promise<BackOrder> =>
    (await api.post(`/commercial/backorders/${id}/fulfill`)).data,

  cancel: async (id: string): Promise<BackOrder> =>
    (await api.post(`/commercial/backorders/${id}/cancel`)).data,

  requestProduction: async (id: string): Promise<BackOrder> =>
    (await api.post(`/commercial/backorders/${id}/request-production`)).data,

  markProductionDone: async (id: string): Promise<BackOrder> =>
    (await api.post(`/commercial/backorders/${id}/mark-production-done`)).data,
};
