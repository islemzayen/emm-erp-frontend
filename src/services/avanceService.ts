import api from "./api";

export const avanceService = {
  create: async (data: { employeeId: string; employeeName: string; department: string; amount: number; reason: string }) => {
    const { data: res } = await api.post("/avances", data);
    return res;
  },
  list: async (filters?: { employeeId?: string; status?: string; department?: string }) => {
    const { data } = await api.get("/avances", { params: filters });
    return data;
  },
  approve: async (id: string) => {
    const { data } = await api.patch(`/avances/${id}/approve`);
    return data;
  },
  delete: async (id: string) => {
    const { data } = await api.delete(`/avances/${id}`);
    return data;
  },
};