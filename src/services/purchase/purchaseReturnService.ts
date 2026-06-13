import api from "../api";

export type PurchaseReturnStatus = "DRAFT" | "VALIDATED" | "SENT" | "CLOSED";

export interface PurchaseReturnLine {
  _id: string;
  productId?: { _id: string; name: string; sku: string } | null;
  description?: string;
  purchaseReceiptLineId: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  vatRate: number;
}

export interface PurchaseReturn {
  _id: string;
  returnNo: string;
  purchaseReceiptId: { _id: string; receiptNo: string; receiptStatus: string };
  purchaseOrderId?: { _id: string; orderNo: string } | null;
  supplierId: { _id: string; supplierNo: string; name: string };
  purchaseInvoiceId?: { _id: string; invoiceNo: string; totalTtc: number; creditNoteAmount: number } | null;
  reason: string;
  lines: PurchaseReturnLine[];
  totalHt: number;
  totalTtc: number;
  status: PurchaseReturnStatus;
  notes?: string;
  validatedAt?: string | null;
  sentAt?: string | null;
  closedAt?: string | null;
  createdBy?: { _id: string; name: string; email: string } | null;
  createdAt: string;
}

export const purchaseReturnService = {
  getMine: async (): Promise<PurchaseReturn[]> =>
    (await api.get("/purchase/returns/mine")).data,

  getAll: async (): Promise<PurchaseReturn[]> =>
    (await api.get("/purchase/returns")).data,

  create: async (payload: { receiptId: string; reason: string; notes?: string }): Promise<PurchaseReturn> =>
    (await api.post("/purchase/returns", payload)).data,

  updateStatus: async (id: string, status: PurchaseReturnStatus): Promise<PurchaseReturn> =>
    (await api.patch(`/purchase/returns/${id}/status`, { status })).data,
};
