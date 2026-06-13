import api from "../api";

export type TenderStatus = "DRAFT" | "SENT" | "COMPARING" | "AWARDED" | "CANCELLED";

export interface TenderOffer {
  _id: string;
  supplierId: {
    _id: string;
    supplierNo: string;
    name: string;
  };
  amountHt: number;
  leadTimeDays: number;
  notes?: string;
  status: "PENDING" | "SELECTED" | "REJECTED";
  submittedAt: string;
}

export interface Tender {
  _id: string;
  tenderNo: string;
  purchaseRequestId?: {
    _id: string;
    requestNo: string;
    requestedQuantity: number;
    reason: string;
    department: string;
    productId?: { _id: string; name: string; sku: string; category: string };
  } | null;
  supplementaryRequestId?: {
    _id: string;
    requestNo: string;
    title: string;
    category: string;
    quantity: number;
    unit: string;
    department: string;
  } | null;
  supplierIds: Array<{
    _id: string;
    supplierNo: string;
    name: string;
    category: string;
    isBlocked: boolean;
  }>;
  offers: TenderOffer[];
  status: TenderStatus;
  selectedSupplierId?: {
    _id: string;
    supplierNo: string;
    name: string;
  } | null;
  notes?: string;
  sentAt?: string | null;
  awardedAt?: string | null;
  purchaseOrderId?: { _id: string; orderNo: string; status: string } | null;
  createdAt: string;
}

export const tenderService = {
  getAll: async (): Promise<Tender[]> => (await api.get("/purchase/tenders")).data,

  create: async (payload: {
    purchaseRequestId?: string;
    supplementaryRequestId?: string;
    supplierIds?: string[];
    notes?: string;
  }): Promise<Tender> => (await api.post("/purchase/tenders", payload)).data,

  send: async (id: string): Promise<Tender> =>
    (await api.post(`/purchase/tenders/${id}/send`)).data,

  addOffer: async (
    id: string,
    payload: { supplierId: string; amountHt: number; leadTimeDays: number; notes?: string }
  ): Promise<Tender> => (await api.post(`/purchase/tenders/${id}/offers`, payload)).data,

  selectOffer: async (id: string, offerId: string): Promise<Tender> =>
    (await api.post(`/purchase/tenders/${id}/select-offer`, { offerId })).data,

  updateSuppliers: async (id: string, supplierIds: string[]): Promise<Tender> =>
    (await api.patch(`/purchase/tenders/${id}/suppliers`, { supplierIds })).data,

  createMissingOrder: async (id: string): Promise<Tender> =>
    (await api.post(`/purchase/tenders/${id}/create-order`)).data,
};
