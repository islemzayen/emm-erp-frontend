import api from "../api";

export interface StockProduct {
  _id: string;
  sku: string;
  name: string;
  type: "PRODUIT_FINI" | "SOUS_ENSEMBLE" | "COMPOSANT" | "MATIERE_PREMIERE";
  unit: "pcs" | "kg" | "l" | "m";
  isLotTracked: boolean;
  status: "ACTIVE" | "INACTIVE";
  purchasePrice: number;
  salePrice: number;
}

export const stockProductService = {
  getAll: async (): Promise<StockProduct[]> => (await api.get("/stock/products")).data,
  getById: async (id: string): Promise<StockProduct> => (await api.get(`/stock/products/${id}`)).data,
  create: async (payload: Partial<StockProduct>) => (await api.post("/stock/products", payload)).data,
  update: async (id: string, payload: Partial<StockProduct>) =>
    (await api.put(`/stock/products/${id}`, payload)).data,
  updateSalePrice: async (id: string, salePrice: number): Promise<StockProduct> =>
    (await api.patch(`/stock/products/${id}/sale-price`, { salePrice })).data,
  delete: async (id: string) => (await api.delete(`/stock/products/${id}`)).data,
};
