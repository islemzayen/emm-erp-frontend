import api from "../api";

export interface Depot {
  _id: string;
  name: string;
  address: string;
  managerId: { _id: string; name: string; email: string; role: string } | null;
  productTypeScope: "MP" | "PF" | "MP_PF";
  capacityKg?: number | null;
  capacityPackets?: number | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export const stockDepotService = {
  getAll: async (): Promise<Depot[]> => (await api.get("/stock/depots")).data,
  getMine: async (): Promise<Depot | null> => (await api.get("/stock/depots/mine")).data,
  getById: async (id: string): Promise<Depot> => (await api.get(`/stock/depots/${id}`)).data,
  create: async (payload: {
    name: string;
    address: string;
    managerId: string;
    productTypeScope: "MP" | "PF" | "MP_PF";
    capacityKg?: number | null;
    capacityPackets?: number | null;
    status?: "ACTIVE" | "INACTIVE";
  }): Promise<Depot> => (await api.post("/stock/depots", payload)).data,
  update: async (
    id: string,
    payload: Partial<{
      name: string;
      address: string;
      managerId: string;
      productTypeScope: "MP" | "PF" | "MP_PF";
      capacityKg: number | null;
      capacityPackets: number | null;
      status: "ACTIVE" | "INACTIVE";
    }>
  ): Promise<Depot> => (await api.put(`/stock/depots/${id}`, payload)).data,
  delete: async (id: string) => (await api.delete(`/stock/depots/${id}`)).data,
  getManagers: async (): Promise<{ _id: string; name: string; email: string; role: string }[]> =>
    (await api.get("/stock/depot-managers")).data,
};
