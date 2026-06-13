import api from "../api";

export interface SupplementaryCategory {
  _id: string;
  name: string;
  label: string;
  description: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const supplementaryCategoryService = {
  getAll: async (): Promise<SupplementaryCategory[]> =>
    (await api.get("/purchase/supplementary/categories")).data,

  getActive: async (): Promise<SupplementaryCategory[]> =>
    (await api.get("/purchase/supplementary/categories/active")).data,

  create: async (payload: {
    name: string;
    label: string;
    description?: string;
    color?: string;
  }): Promise<SupplementaryCategory> =>
    (await api.post("/purchase/supplementary/categories", payload)).data,

  update: async (
    id: string,
    payload: { label?: string; description?: string; color?: string; isActive?: boolean }
  ): Promise<SupplementaryCategory> =>
    (await api.patch(`/purchase/supplementary/categories/${id}`, payload)).data,

  delete: async (id: string): Promise<void> => {
    await api.delete(`/purchase/supplementary/categories/${id}`);
  },
};
