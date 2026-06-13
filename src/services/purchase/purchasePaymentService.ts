import api from "../api";

export interface PurchasePayment {
  _id: string;
  paymentNo: string;
  supplierId: {
    _id: string;
    supplierNo: string;
    name: string;
  };
  purchaseInvoiceId: {
    _id: string;
    invoiceNo: string;
    totalTtc: number;
    amountPaid: number;
    dueDate: string;
    status: string;
  };
  method: "BANK_TRANSFER" | "CHECK" | "CASH";
  amount: number;
  paymentDate: string;
  notes?: string;
  createdAt: string;
}

export interface PurchasePaymentSummary {
  totalOutstanding: number;
  totalPaid: number;
  overdueCount: number;
  supplierBalances: Array<{
    supplierId: string;
    balance: number;
  }>;
}

export const purchasePaymentService = {
  getAll: async (): Promise<PurchasePayment[]> => (await api.get("/purchase/payments")).data,

  getSummary: async (): Promise<PurchasePaymentSummary> =>
    (await api.get("/purchase/payments/summary")).data,

  create: async (payload: {
    supplierId: string;
    purchaseInvoiceId: string;
    method: "BANK_TRANSFER" | "CHECK" | "CASH";
    amount: number;
    paymentDate: string;
    notes?: string;
  }): Promise<PurchasePayment> => (await api.post("/purchase/payments", payload)).data,
};
