import api from "../api";

export interface PurchaseProductCategoryEntry {
  _id: string;
  productId: { _id: string; name: string; sku: string; type?: string; unit?: string } | null;
  categoryId: { _id: string; name: string; label: string; color?: string } | null;
  createdBy?: { _id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const purchaseProductCategoryService = {
  getAll: async (): Promise<PurchaseProductCategoryEntry[]> =>
    (await api.get("/purchase/product-categories")).data,

  create: async (payload: { productId: string; categoryId: string }): Promise<PurchaseProductCategoryEntry> =>
    (await api.post("/purchase/product-categories", payload)).data,

  update: async (id: string, payload: { categoryId?: string }): Promise<PurchaseProductCategoryEntry> =>
    (await api.patch(`/purchase/product-categories/${id}`, payload)).data,

  delete: async (id: string): Promise<void> => {
    await api.delete(`/purchase/product-categories/${id}`);
  },
};
