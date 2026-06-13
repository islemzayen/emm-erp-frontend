import api from "../api";

export interface PurchaseSettings {
  _id: string;
  purchaseOrderPrefix: string;
  purchaseRequestPrefix: string;
  receiptPrefix: string;
  invoicePrefix: string;
  tenderPrefix: string;
  returnPrefix: string;
  defaultVatRate: number;
  defaultFodecRate: number;
  defaultTimbreFiscal: number;
  defaultCurrency: string;
  exchangeRateToTnd: number;
  approvalMode: "SINGLE_LEVEL" | "MULTI_LEVEL";
  lowPriorityNeedsApproval: boolean;
  urgentAutoEscalation: boolean;
  purchasedProductCategories: string[];
  unitsOfMeasure: string[];
}

export const purchaseSettingService = {
  get: async (): Promise<PurchaseSettings> => (await api.get("/purchase/settings")).data,

  update: async (payload: Partial<PurchaseSettings>): Promise<PurchaseSettings> =>
    (await api.put("/purchase/settings", payload)).data,
};
