import api from "@/services/api";

export interface DevisLine {
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
}

export interface Devis {
  _id: string;
  devisNo: string;
  salesOrderId?: { _id: string; orderNo: string; status: string } | null;
  customerId?: { _id: string; name: string; email?: string; mf?: string } | null;
  customerName: string;
  customerMf?: string;
  customerAddress?: string;
  invoiceType?: "CLIENT" | "SUPPLIER";
  status: "PENDING" | "SENT" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  pricingMode: "HT_BASED" | "TTC_BASED";
  applyTva: boolean;
  applyFodec: boolean;
  tvaRate: number;
  fodecRate: number;
  timbreFiscal: number;
  issueDate?: string;
  dueDate?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  subtotalHt: number;
  totalVat: number;
  totalFodec: number;
  totalBeforeStamp: number;
  totalTtc: number;
  lines: DevisLine[];
  notes?: string;
  createdBy?: { _id: string; name: string; email?: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export const devisService = {
  getAll: async (): Promise<Devis[]> => (await api.get("/commercial/devis")).data,
  getById: async (id: string): Promise<Devis> =>
    (await api.get(`/commercial/devis/${id}`)).data,
  getByOrderId: async (orderId: string): Promise<Devis> =>
    (await api.get(`/commercial/devis/by-order/${orderId}`)).data,
  accept: async (id: string): Promise<Devis> =>
    (await api.post(`/commercial/devis/${id}/accept`, {})).data,
  deleteById: async (id: string): Promise<{ success: boolean }> =>
    (await api.delete(`/commercial/devis/${id}`)).data,
  createInvoice: async (id: string): Promise<{ _id: string; invoiceNo: string }> =>
    (await api.post(`/commercial/devis/${id}/create-invoice`, {})).data,
};
