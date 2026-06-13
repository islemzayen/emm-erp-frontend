import api from "@/services/api";

export interface CustomerInvoicePayment {
  _id: string;
  method: "ESPECE" | "CHEQUE" | "VIREMENT" | "KUMBIL";
  amount: number;
  paidAt?: string;
  status: "PENDING" | "CLEARED" | "REJECTED";
  reference?: string;
  dueDate?: string | null;
  installmentIndex?: number | null;
  settlementSplitIndex?: number | null;
  notes?: string;
}

export interface CustomerInvoiceReminder {
  _id: string;
  sentAt: string;
  channel: "EMAIL" | "PHONE" | "MANUAL";
  note?: string;
}

export interface CustomerInvoiceInstallment {
  _id: string;
  dueDate: string;
  plannedAmount: number;
  paidAmount: number;
  paidAt?: string | null;
  status: "PENDING" | "PARTIAL" | "PAID";
}

export interface CustomerInvoiceSettlementSplit {
  _id: string;
  method: "ESPECE" | "CHEQUE" | "VIREMENT" | "KUMBIL";
  plannedAmount: number;
  paidAmount: number;
  dueDate?: string | null;
  status: "PENDING" | "PARTIAL" | "PAID";
  notes?: string;
}

export interface CustomerInvoice {
  _id: string;
  invoiceNo: string;
  salesOrderId?: { _id: string; orderNo: string; status: string } | null;
  customerId?: { _id: string; name: string; email?: string } | null;
  customerName: string;
  pricingMode: "HT_BASED" | "TTC_BASED";
  applyTva: boolean;
  applyFodec: boolean;
  tvaRate: number;
  fodecRate: number;
  timbreFiscal: number;
  paymentMethod: "UNSET" | "ESPECE" | "CHEQUE" | "VIREMENT" | "KUMBIL" | "MIXED";
  legalizationStatus: "NON_LEGALISEE" | "LEGALISEE";
  paymentStatus: "NON_PAYEE" | "PARTIELLEMENT_PAYEE" | "PENDING_CHEQUE" | "PAYEE";
  issueDate?: string;
  dueDate?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  finalizedAt?: string | null;
  legalizedAt?: string | null;
  paidAt?: string | null;
  reminderCount?: number;
  lastReminderAt?: string | null;
  amountPaid: number;
  subtotalHt: number;
  totalVat: number;
  totalFodec: number;
  totalBeforeStamp: number;
  totalTtc: number;
  lines: Array<{
    _id: string;
    quantity: number;
    inputUnitPrice: number;
    baseUnitHt: number;
    discount?: number;
    discountAmount?: number;
    subtotalHt: number;
    totalVat: number;
    totalFodec: number;
    totalBeforeStamp: number;
    productId?: { _id: string; name: string; sku?: string } | null;
  }>;
  settlementSplits: CustomerInvoiceSettlementSplit[];
  installments: CustomerInvoiceInstallment[];
  payments: CustomerInvoicePayment[];
  reminders: CustomerInvoiceReminder[];
  invoiceType?: "CLIENT" | "SUPPLIER";
  tejReference?: string;
  tejStatus?: "NOT_SUBMITTED" | "PENDING" | "VALIDATED" | "REJECTED";
  tejQrData?: string;
  customerMf?: string;
  customerAddress?: string;
}

export const customerInvoiceService = {
  getAll: async (): Promise<CustomerInvoice[]> => (await api.get("/commercial/invoices")).data,
  getById: async (id: string): Promise<CustomerInvoice> =>
    (await api.get(`/commercial/invoices/${id}`)).data,
  getByOrderId: async (orderId: string): Promise<CustomerInvoice> =>
    (await api.get(`/commercial/invoices/by-order/${orderId}`)).data,
  configure: async (
    id: string,
    payload: Record<string, unknown>
  ): Promise<CustomerInvoice> => (await api.patch(`/commercial/invoices/${id}/configure`, payload)).data,
  finalize: async (id: string, payload: Record<string, unknown> = {}): Promise<CustomerInvoice> =>
    (await api.post(`/commercial/invoices/${id}/finalize`, payload)).data,
  registerPayment: async (
    id: string,
    payload: Record<string, unknown>
  ): Promise<CustomerInvoice> => (await api.post(`/commercial/invoices/${id}/payments`, payload)).data,
  sendInvoice: async (id: string, payload: Record<string, unknown> = {}): Promise<CustomerInvoice> =>
    (await api.post(`/commercial/invoices/${id}/send`, payload)).data,
  sendReminder: async (id: string, payload: Record<string, unknown> = {}): Promise<CustomerInvoice> =>
    (await api.post(`/commercial/invoices/${id}/remind`, payload)).data,
  clearCheque: async (id: string, paymentId: string): Promise<CustomerInvoice> =>
    (await api.post(`/commercial/invoices/${id}/clear-cheque`, { paymentId })).data,
  getAllKumbil: async (): Promise<CustomerInvoice[]> =>
    (await api.get("/commercial/invoices/kumbil")).data,
  cancelInstallment: async (id: string, index: number): Promise<CustomerInvoice> =>
    (await api.delete(`/commercial/invoices/${id}/installments/${index}`)).data,
};
