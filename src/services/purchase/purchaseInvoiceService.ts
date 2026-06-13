import api from "../api";

export type PurchaseInvoiceStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PARTIALLY_PAID"
  | "PAID";

export interface PurchaseInvoice {
  _id: string;
  invoiceNo: string;
  supplierInvoiceRef: string;
  supplierId: {
    _id: string;
    supplierNo: string;
    name: string;
    paymentTerms?: string;
  };
  purchaseOrderId: {
    _id: string;
    orderNo: string;
    status: string;
    totalTtc: number;
  };
  receiptIds: Array<{
    _id: string;
    receiptNo: string;
    receiptStatus: string;
    createdAt: string;
  }>;
  invoiceDate: string;
  dueDate: string;
  subtotalHt: number;
  applyTva: boolean;
  applyFodec: boolean;
  tvaRate: number;
  fodecRate: number;
  timbreFiscal: number;
  totalVat: number;
  totalFodec: number;
  totalBeforeStamp: number;
  totalTtc: number;
  expectedSubtotalHt: number;
  expectedTotalVat: number;
  expectedTotalFodec: number;
  expectedTotalBeforeStamp: number;
  expectedTotalTtc: number;
  amountPaid: number;
  creditNoteAmount: number;
  matchingStatus: "MATCHED" | "MISMATCH";
  status: PurchaseInvoiceStatus;
  notes?: string;
  rejectionReason?: string;
  createdAt: string;
}

export const purchaseInvoiceService = {
  getAll: async (): Promise<PurchaseInvoice[]> => (await api.get("/purchase/invoices")).data,

  create: async (payload: {
    supplierInvoiceRef: string;
    supplierId: string;
    purchaseOrderId: string;
    receiptIds?: string[];
    invoiceDate: string;
    dueDate: string;
    applyTva?: boolean;
    applyFodec?: boolean;
    subtotalHt?: number;
    attachmentUrl?: string;
    notes?: string;
  }): Promise<PurchaseInvoice> => (await api.post("/purchase/invoices", payload)).data,

  scan: async (file: File): Promise<{ fileUrl: string; extracted: { supplierInvoiceRef?: string; invoiceDate?: string; totalTtc?: number; subtotalHt?: number; supplierMf?: string } }> => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post("/purchase/scan", form, { headers: { "Content-Type": "multipart/form-data" } });
    return data;
  },

  updateStatus: async (
    id: string,
    payload: {
      status: "APPROVED" | "REJECTED" | "PARTIALLY_PAID" | "PAID";
      amountPaid?: number;
      rejectionReason?: string;
    }
  ): Promise<PurchaseInvoice> => (await api.patch(`/purchase/invoices/${id}/status`, payload)).data,
};
