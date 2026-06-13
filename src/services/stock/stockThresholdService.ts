import api from "../api";

export const stockThresholdService = {
  getAll: async () => (await api.get("/stock/threshold-rules")).data,
  getById: async (id: string) =>
    (await api.get(`/stock/threshold-rules/${id}`)).data,
  getByProductId: async (productId: string) =>
    (await api.get(`/stock/threshold-rules/product/${productId}`)).data,
  create: async (payload: any) =>
    (await api.post("/stock/threshold-rules", payload)).data,
  update: async (id: string, payload: any) =>
    (await api.put(`/stock/threshold-rules/${id}`, payload)).data,
  delete: async (id: string) =>
    (await api.delete(`/stock/threshold-rules/${id}`)).data,
};