import api from "../api";

export interface SalesOrderLine {
  productId: { _id: string; name: string; sku: string; type?: string; unit?: string } | null;
  depotId?: { _id: string; name: string; productTypeScope?: string; status?: string } | null;
  quantity: number;
  unitPrice: number;
  discount?: number;
  allocatedQuantity?: number;
  plannedProductionQuantity?: number;
  depotPreparedAt?: string | null;
  depotPreparedBy?: { _id: string; name: string; role?: string } | null;
}

export interface ShipApproval {
  status: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  requestedAt?: string;
  requestedBy?: { _id: string; name: string } | null;
  approvedAt?: string;
  approvedBy?: { _id: string; name: string } | null;
  approverNotes?: string;
  rejectedAt?: string;
  rejectedBy?: { _id: string; name: string } | null;
  rejectionReason?: string;
}

export interface SalesOrder {
  _id: string;
  orderNo: string;
  customerId?:
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
        phone?: string;
        company?: string;
        mf?: string;
        address?: string;
      }
    | null;
  customerName: string;
  splitFromOrderId?: string | { _id: string; orderNo?: string } | null;
  source?: "MANUAL" | "RECURRING";
  status: "DRAFT" | "ORDONNANCED" | "CONFIRMED" | "PREPARED" | "SHIPPED" | "DELIVERED" | "RETURNED" | "CLOSED" | "CANCELLED";
  promisedDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  ordonnancedAt?: string;
  preparedAt?: string;
  preparedBy?: { _id: string; name: string; role?: string } | null;
  pickingSlipPrintedAt?: string;
  pickingSlipPrintedBy?: { _id: string; name: string } | null;
  packingValidatedAt?: string;
  packingValidatedBy?: { _id: string; name: string } | null;
  shippedAt?: string;
  deliveredAt?: string;
  closedAt?: string;
  trackingNumber?: string;
  carrierId?: { _id: string; name: string; code: string } | null;
  vehicleId?: { _id: string; matricule: string; capacityPackets: number; capacityKg: number } | null;
  shippingCost?: number;
  shipmentAddress?: string;
  isUrgent?: boolean;
  shipApproval?: ShipApproval;
  notes?: string;
  createdAt?: string;
  lines: SalesOrderLine[];
}

export interface SalesOrderLinePayload {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
}

export interface CreateSalesOrderPayload {
  orderNo?: string;
  customerId?: string;
  customerName?: string;
  notes?: string;
  promisedDate?: string;
  pricingMode?: "HT_BASED" | "TTC_BASED";
  lines: SalesOrderLinePayload[];
}

export interface SalesOrderAllocationEntryPayload {
  depotId: string;
  allocatedQuantity: number;
}

export interface SalesOrderOrdonnanceLinePayload {
  lineIndex: number;
  productId: string;
  allocations: SalesOrderAllocationEntryPayload[];
}

export const salesOrderService = {
  getAll: async () => (await api.get("/commercial/orders")).data,

  getById: async (id: string) =>
    (await api.get(`/commercial/orders/${id}`)).data,

  create: async (payload: CreateSalesOrderPayload) =>
    (await api.post("/commercial/orders", payload)).data,

  confirm: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/confirm`)).data,

  ordonance: async (
    id: string,
    payload: {
      plannedStartDate: string;
      plannedEndDate: string;
      lines: SalesOrderOrdonnanceLinePayload[];
    }
  ) => (await api.post(`/commercial/orders/${id}/ordonance`, payload)).data,

  ordonanceBulk: async (
    payload: {
      orders: {
        orderId: string;
        plannedStartDate: string;
        plannedEndDate: string;
        lines: SalesOrderOrdonnanceLinePayload[];
      }[];
    }
  ) => (await api.post("/commercial/orders/ordonance/bulk", payload)).data,

  requestProduction: async (
    id: string,
    payload: {
      lines: SalesOrderOrdonnanceLinePayload[];
    }
  ) => (await api.post(`/commercial/orders/${id}/request-production`, payload)).data,

  prepare: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/prepare`)).data,

  markPickingSlipPrinted: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/print-picking-slip`)).data,

  validatePacking: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/validate-packing`)).data,

  cancel: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/cancel`)).data,

  ship: async (id: string, payload?: { trackingNumber?: string; carrierId?: string; vehicleId?: string; shippingCost?: number; shipmentAddress?: string }) =>
    (await api.post(`/commercial/orders/${id}/ship`, payload || {})).data,

  deliver: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/deliver`)).data,

  close: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/close`)).data,

  markReturned: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/mark-returned`)).data,

  reorder: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/reorder`)).data,

  markUrgent: async (id: string, urgent: boolean) =>
    (await api.post(`/commercial/orders/${id}/mark-urgent`, { urgent })).data,

  requestApproval: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/request-approval`)).data,

  approveShip: async (id: string) =>
    (await api.post(`/commercial/orders/${id}/approve-ship`)).data,

  rejectShip: async (id: string, reason: string) =>
    (await api.post(`/commercial/orders/${id}/reject-ship`, { reason })).data,
};
