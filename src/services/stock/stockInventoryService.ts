import api from "../api";

export const stockInventoryService = {
  getAll: async () => (await api.get("/stock/inventories")).data,
  getById: async (id: string) => (await api.get(`/stock/inventories/${id}`)).data,

  create: async (payload: {
    type: "PERIODIC" | "PERMANENT";
    notes?: string;
    depotId?: string;
    dateDebut?: string;
    dateFin?: string;
    year?: number;
  }) => (await api.post("/stock/inventories", payload)).data,

  getLines: async (id: string) =>
    (await api.get(`/stock/inventories/${id}/lines`)).data,

  // Stock manager adds a line — product only, system qty is auto-loaded
  addLine: async (id: string, payload: { productId: string; notes?: string }) =>
    (await api.post(`/stock/inventories/${id}/lines`, payload)).data,

  removeLine: async (id: string, lineId: string) =>
    (await api.delete(`/stock/inventories/${id}/lines/${lineId}`)).data,

  // Stock Manager workflow
  sendToDepot: async (id: string) =>
    (await api.post(`/stock/inventories/${id}/send-to-depot`)).data,

  approveInventory: async (id: string) =>
    (await api.post(`/stock/inventories/${id}/approve`)).data,

  // Stock Manager rejects silently — no reason needed
  rejectInventory: async (id: string) =>
    (await api.post(`/stock/inventories/${id}/reject`)).data,

  // Depot Manager: submit all physical count quantities (first-time counting)
  submitDepotCount: async (id: string, lines: { lineId: string; countedQuantity: number }[]) =>
    (await api.post(`/stock/inventories/${id}/submit-count`, { lines })).data,

  // Depot Manager: write a text response after stock manager rejection (no re-count)
  submitDepotResponse: async (id: string, response: string) =>
    (await api.post(`/stock/inventories/${id}/depot-response`, { response })).data,
};
