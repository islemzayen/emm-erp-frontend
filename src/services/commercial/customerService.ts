import api from "../api";

export interface Customer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  continent?: string;
  country?: string;
  state?: string;
  mf?: string;
  notes?: string;
  totalOrderAmount?: number;
  active: boolean;
  createdAt: string;
}

const PREFIX = "/commercial/customers";

export const customerService = {
  getAll: async (): Promise<Customer[]> => {
    const { data } = await api.get(PREFIX);
    return data;
  },
  getActive: async (): Promise<Customer[]> => {
    const { data } = await api.get(`${PREFIX}/active`);
    return data;
  },
  getById: async (id: string): Promise<Customer> => {
    const { data } = await api.get(`${PREFIX}/${id}`);
    return data;
  },
  create: async (payload: Partial<Customer>): Promise<Customer> => {
    const { data } = await api.post(PREFIX, payload);
    return data;
  },
  update: async (id: string, payload: Partial<Customer>): Promise<Customer> => {
    const { data } = await api.put(`${PREFIX}/${id}`, payload);
    return data;
  },
  toggleActive: async (id: string): Promise<Customer> => {
    const { data } = await api.post(`${PREFIX}/${id}/toggle`);
    return data;
  },
};
