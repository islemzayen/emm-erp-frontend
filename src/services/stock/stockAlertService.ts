import api from "../api";

export const stockAlertService = {
  getAll: async () => (await api.get("/stock/alerts")).data,
  getOpen: async () => (await api.get("/stock/alerts/open")).data,
  getByProductId: async (productId: string) =>
    (await api.get(`/stock/alerts/product/${productId}`)).data,
  updateStatus: async (id: string, status: "OPEN" | "ACKNOWLEDGED" | "CLOSED") =>
    (await api.patch(`/stock/alerts/${id}/status`, { status })).data,
};