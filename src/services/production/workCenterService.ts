import api from "../api";

export interface WorkCenter {
  _id: string;
  name: string;
  code: string;
  type: "MACHINE" | "ASSEMBLY" | "QUALITY_CHECK" | "PACKAGING";
  capacityPerDay: number;
  active: boolean;
  notes?: string;
  createdAt: string;
}

const PREFIX = "/production/work-centers";

export const workCenterService = {
  getAll: async (): Promise<WorkCenter[]> => {
    const { data } = await api.get(PREFIX);
    return data;
  },
  getActive: async (): Promise<WorkCenter[]> => {
    const { data } = await api.get(`${PREFIX}/active`);
    return data;
  },
  getById: async (id: string): Promise<WorkCenter> => {
    const { data } = await api.get(`${PREFIX}/${id}`);
    return data;
  },
  create: async (payload: Partial<WorkCenter>): Promise<WorkCenter> => {
    const { data } = await api.post(PREFIX, payload);
    return data;
  },
  update: async (id: string, payload: Partial<WorkCenter>): Promise<WorkCenter> => {
    const { data } = await api.put(`${PREFIX}/${id}`, payload);
    return data;
  },
  toggleActive: async (id: string): Promise<WorkCenter> => {
    const { data } = await api.post(`${PREFIX}/${id}/toggle`);
    return data;
  },
  getSchedule: async (id: string, from: string, to: string) => {
    const { data } = await api.get(`${PREFIX}/${id}/schedule`, { params: { from, to } });
    return data;
  },
};
