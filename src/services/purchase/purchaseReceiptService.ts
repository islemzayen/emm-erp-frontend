import api from "../api";

export type PurchaseReceiptStatus = "PARTIAL" | "FULL" | "LITIGATION";

export interface PurchaseReceiptLine {
  _id: string;
  purchaseOrderLineId: string;
  productId: {
    _id: string;
    name: string;
    sku: string;
  };
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  qualityStatus: "ACCEPTED" | "WITH_RESERVATION" | "REJECTED";
  discrepancyNotes?: string;
  lotRef?: string;
}

export interface PurchaseReceipt {
  _id: string;
  receiptNo: string;
  supplierRating?: number | null;
  purchaseOrderId: {
    _id: string;
    orderNo: string;
    status: string;
    supplierId?: {
      _id: string;
      supplierNo: string;
      name: string;
    };
  };
  supplierId: {
    _id: string;
    supplierNo: string;
    name: string;
  };
  depotId?: {
    _id: string;
    name: string;
    productTypeScope?: "MP" | "PF" | "MP_PF";
  } | null;
  lines: PurchaseReceiptLine[];
  receiptStatus: PurchaseReceiptStatus;
  notes?: string;
  createdAt: string;
}

export const purchaseReceiptService = {
  getAll: async (): Promise<PurchaseReceipt[]> => (await api.get("/purchase/receipts")).data,

  getMine: async (): Promise<PurchaseReceipt[]> => (await api.get("/purchase/receipts/mine")).data,

  create: async (
    payload: {
      purchaseOrderId: string;
      depotId?: string;
      lines: Array<{
        purchaseOrderLineId: string;
        receivedQuantity: number;
        acceptedQuantity: number;
      }>;
      supplierRating?: number;
      notes?: string;
    },
    factureFile?: File | null
  ): Promise<PurchaseReceipt> => {
    if (factureFile) {
      const form = new FormData();
      form.append("data", JSON.stringify(payload));
      form.append("facture", factureFile);
      return (await api.post("/purchase/receipts", form)).data;
    }
    return (await api.post("/purchase/receipts", payload)).data;
  },
};
