import api from "../api";

export type PurchaseOrderStatus = "DRAFT" | "VALIDATED" | "SENT" | "RECEIVED" | "CLOSED" | "CANCELLED";

export interface PurchaseOrderLine {
  _id: string;
  productId: {
    _id: string;
    name: string;
    sku: string;
  } | null;
  description?: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  discountRate: number;
  vatRate: number;
}

export interface PurchaseOrder {
  _id: string;
  orderNo: string;
  purchaseRequestId?: {
    _id: string;
    requestNo: string;
    requestedQuantity: number;
    department?: string;
    productId?: { _id: string; name: string; sku: string };
  } | null;
  tenderId?: {
    _id: string;
    tenderNo: string;
    selectedSupplierId?: { _id: string; supplierNo: string; name: string } | null;
  } | null;
  supplierId: {
    _id: string;
    supplierNo: string;
    name: string;
    paymentTerms?: string;
    category?: string;
  };
  lines: PurchaseOrderLine[];
  subtotalHt: number;
  vatRate: number;
  totalVat: number;
  fodecRate: number;
  totalFodec: number;
  timbreFiscal: number;
  totalTtc: number;
  deliveryTerms?: string;
  paymentTerms?: string;
  notes?: string;
  status: PurchaseOrderStatus;
  validationLevel: number;
  createdBy?: { _id: string; name: string; email: string; role: string } | null;
  validatedAt?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
}

export const purchaseOrderService = {
  getAll: async (): Promise<PurchaseOrder[]> => (await api.get("/purchase/orders")).data,

  getById: async (id: string): Promise<PurchaseOrder> =>
    (await api.get(`/purchase/orders/${id}`)).data,

  create: async (payload: {
    purchaseRequestId?: string;
    tenderId?: string;
    supplierId: string;
    lines?: Array<{
      productId: string;
      description?: string;
      quantity: number;
      unitPrice: number;
      discountRate?: number;
      vatRate?: number;
    }>;
    deliveryTerms?: string;
    paymentTerms?: string;
  }): Promise<PurchaseOrder> => (await api.post("/purchase/orders", payload)).data,

  updateStatus: async (
    id: string,
    status: "VALIDATED" | "SENT" | "CLOSED"
  ): Promise<PurchaseOrder> => (await api.patch(`/purchase/orders/${id}/status`, { status })).data,

  cancel: async (id: string): Promise<PurchaseOrder> =>
    (await api.post(`/purchase/orders/${id}/cancel`)).data,

  getPendingDeliveries: async (): Promise<PurchaseOrder[]> =>
    (await api.get("/purchase/orders/pending-delivery")).data,
};
