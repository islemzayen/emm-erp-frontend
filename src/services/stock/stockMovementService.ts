import api from "../api";

export const stockMovementService = {
  getAll: async () => (await api.get("/stock/movements")).data,
  getByProductId: async (productId: string) =>
    (await api.get(`/stock/movements/${productId}`)).data,

  createEntry: async (payload: any) =>
    (await api.post("/stock/movements/entry", payload)).data,

  createExit: async (payload: any) =>
    (await api.post("/stock/movements/exit", payload)).data,

  reserve: async (payload: any) =>
    (await api.post("/stock/reservations", payload)).data,

  release: async (payload: any) =>
    (await api.post("/stock/reservations/release", payload)).data,

  deduct: async (payload: any) =>
    (await api.post("/stock/reservations/deduct", payload)).data,
};