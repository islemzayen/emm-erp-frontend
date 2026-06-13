import api from "../api";

export interface CyclicOrder {
  _id: string;
  customerId: { _id: string; name: string; email?: string } | null;
  customerName: string;
  productId: { _id: string; name: string; sku: string; unit: string };
  quantity: number;
  frequencyDays: number;
  nextDueDate: string;
  lastFiredAt?: string | null;
  active: boolean;
  notes?: string;
  createdAt: string;
}

export interface CreateCyclicOrderPayload {
  customerId: string;
  customerName: string;
  productId: string;
  quantity: number;
  frequencyDays: number;
  nextDueDate: string;
  notes?: string;
}

const PREFIX = "/production/cyclic-orders";

export const cyclicOrderService = {
  getAll: async (): Promise<CyclicOrder[]> =>
    (await api.get(PREFIX)).data,

  getDue: async (): Promise<CyclicOrder[]> =>
    (await api.get(`${PREFIX}/due`)).data,

  create: async (payload: CreateCyclicOrderPayload): Promise<CyclicOrder> =>
    (await api.post(PREFIX, payload)).data,

  update: async (
    id: string,
    payload: Partial<Pick<CreateCyclicOrderPayload, "quantity" | "frequencyDays" | "nextDueDate" | "notes">>
  ): Promise<CyclicOrder> =>
    (await api.put(`${PREFIX}/${id}`, payload)).data,

  toggleActive: async (id: string): Promise<CyclicOrder> =>
    (await api.post(`${PREFIX}/${id}/toggle`)).data,

  fire: async (id: string): Promise<{ cyclicOrder: CyclicOrder; productionOrder: unknown }> =>
    (await api.post(`${PREFIX}/${id}/fire`)).data,
};
