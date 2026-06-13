import api from "../api";
import type { WorkCenter } from "./workCenterService";

export interface ProductionOrder {
  _id: string;
  orderNo: string;
  salesOrderId?: { _id: string; orderNo: string } | null;
  backorderId?: { _id: string; orderNo: string; status: string } | null;
  productId: { _id: string; name: string; sku: string; unit: string };
  quantity: number;
  completedQty: number;
  status: "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  workCenterId?: WorkCenter | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  estimatedHours: number;
  notes?: string;
  createdBy?: { _id: string; name: string } | null;
  createdAt: string;
}

const PREFIX = "/production/orders";

export const productionOrderService = {
  getAll: async (): Promise<ProductionOrder[]> => {
    const { data } = await api.get(PREFIX);
    return data;
  },
  getTimeline: async (from: string, to: string): Promise<ProductionOrder[]> => {
    const { data } = await api.get(`${PREFIX}/timeline`, { params: { from, to } });
    return data;
  },
  getById: async (id: string): Promise<ProductionOrder> => {
    const { data } = await api.get(`${PREFIX}/${id}`);
    return data;
  },
  create: async (payload: {
    productId: string;
    quantity: number;
    priority?: string;
    estimatedHours?: number;
    salesOrderId?: string;
    backorderId?: string;
    notes?: string;
  }): Promise<ProductionOrder> => {
    const { data } = await api.post(PREFIX, payload);
    return data;
  },
  schedule: async (
    id: string,
    payload: { workCenterId: string; scheduledStart: string; scheduledEnd: string }
  ): Promise<ProductionOrder> => {
    const { data } = await api.post(`${PREFIX}/${id}/schedule`, payload);
    return data;
  },
  start: async (id: string): Promise<ProductionOrder> => {
    const { data } = await api.post(`${PREFIX}/${id}/start`);
    return data;
  },
  complete: async (id: string, completedQty?: number): Promise<ProductionOrder> => {
    const { data } = await api.post(`${PREFIX}/${id}/complete`, { completedQty });
    return data;
  },
  cancel: async (id: string): Promise<ProductionOrder> => {
    const { data } = await api.post(`${PREFIX}/${id}/cancel`);
    return data;
  },

  createFromBackorder: async (
    backorderId: string
  ): Promise<{ orders: ProductionOrder[]; backorderId: string; orderNo: string; totalQty: number }> => {
    const { data } = await api.post(`${PREFIX}/from-backorder/${backorderId}`);
    return data;
  },
};
