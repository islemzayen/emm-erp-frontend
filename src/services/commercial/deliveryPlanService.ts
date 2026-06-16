import api from "../api";
import { SalesOrder } from "./salesOrderService";
import { Carrier } from "./carrierService";
import { Vehicle } from "./vehicleService";

export type DeliveryPlanStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "RETURNED" | "CANCELLED";
export type DeliveryPlanType = "SHIPMENT" | "DISCOVER";

export interface DeliveryPlan {
  _id: string;
  planNo: string;
  blNo?: string;
  planDate: string;
  vehicleId?: Vehicle | null;
  carrierId?: Carrier | null;
  zone?: string;
  startDate?: string | null;
  
  fuelAddedLiters?: number;
  distanceKm?: number | null;
  orderIds: SalesOrder[];
  status: DeliveryPlanStatus;
  planType: DeliveryPlanType;
  livreurName?: string;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
  returnedAt?: string;
  cancelledAt?: string;
  createdAt?: string;
  returnedOrderIds?: Array<string | { _id: string; orderNo?: string }>;
  rmaIds?: Array<{ _id: string; rmaNo: string; status: string; orderNo: string; createdAt?: string }>;
}

export interface CreateDeliveryPlanPayload {
  planNo?: string;
  planDate: string;
  vehicleId?: string;
  carrierId?: string;
  zone?: string;
  startDate?: string;
  fuelAddedLiters?: number;
  orderIds?: string[];
  livreurName?: string;
  notes?: string;
  planType?: DeliveryPlanType;
}

export const deliveryPlanService = {
  getAll: async (): Promise<DeliveryPlan[]> =>
    (await api.get("/commercial/delivery-plans")).data,

  getById: async (id: string): Promise<DeliveryPlan> =>
    (await api.get(`/commercial/delivery-plans/${id}`)).data,

  getUnassigned: async (): Promise<SalesOrder[]> =>
    (await api.get("/commercial/delivery-plans/unassigned")).data,

  getDiscoveredZones: async (): Promise<string[]> =>
    (await api.get("/commercial/delivery-plans/discovered-zones")).data,

  create: async (payload: CreateDeliveryPlanPayload): Promise<DeliveryPlan> =>
    (await api.post("/commercial/delivery-plans", payload)).data,

  start: async (id: string): Promise<DeliveryPlan> =>
    (await api.post(`/commercial/delivery-plans/${id}/start`)).data,

  complete: async (id: string, distanceKm: number): Promise<DeliveryPlan> =>
    (await api.post(`/commercial/delivery-plans/${id}/complete`, { distanceKm })).data,

  returnPlan: async (id: string, reason: string, orderId?: string): Promise<DeliveryPlan> =>
    (await api.post(`/commercial/delivery-plans/${id}/return`, { reason, orderId })).data,

  cancel: async (id: string): Promise<DeliveryPlan> =>
    (await api.post(`/commercial/delivery-plans/${id}/cancel`)).data,
};
