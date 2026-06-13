import api from "../api";

export interface Carrier {
  _id: string;
  name: string;
  code: string;
  contactEmail?: string;
  contactPhone?: string;
  baseRateFlat: number;
  transitDays?: number;
  active: boolean;
  notes?: string;
  createdAt?: string;
}

export interface CreateCarrierPayload {
  name: string;
  code: string;
  contactEmail?: string;
  contactPhone?: string;
  baseRateFlat?: number;
  transitDays?: number;
  notes?: string;
}

export const carrierService = {
  getAll: async (): Promise<Carrier[]> =>
    (await api.get("/commercial/carriers")).data,

  getActive: async (): Promise<Carrier[]> =>
    (await api.get("/commercial/carriers/active")).data,

  getById: async (id: string): Promise<Carrier> =>
    (await api.get(`/commercial/carriers/${id}`)).data,

  create: async (payload: CreateCarrierPayload): Promise<Carrier> =>
    (await api.post("/commercial/carriers", payload)).data,

  update: async (id: string, payload: Partial<CreateCarrierPayload>): Promise<Carrier> =>
    (await api.put(`/commercial/carriers/${id}`, payload)).data,

  toggleActive: async (id: string): Promise<Carrier> =>
    (await api.post(`/commercial/carriers/${id}/toggle`)).data,
};
