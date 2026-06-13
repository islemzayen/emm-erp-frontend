import api from "../api";

/** Purchase department is under /api/purchase-admin */
const PREFIX = "/purchase-admin";

export const purchaseService = {
  getStats: async () => {
    const { data } = await api.get(`${PREFIX}/stats`);
    return data;
  },

  getAllEmployees: async () => {
    const { data } = await api.get(`${PREFIX}/employees`);
    return data;
  },

  createEmployee: async (employeeData: {
    name: string;
    position: string;
    phone: string;
    salary: number;
    joinedDate: string;
  }) => {
    const { data } = await api.post(`${PREFIX}/employees`, employeeData);
    return data;
  },

  updateEmployee: async (
    id: string,
    employeeData: Partial<{
      name: string;
      position: string;
      phone: string;
      salary: number;
      joinedDate: string;
    }>
  ) => {
    const { data } = await api.put(`${PREFIX}/employees/${id}`, employeeData);
    return data;
  },

  deleteEmployee: async (id: string) => {
    const { data } = await api.delete(`${PREFIX}/employees/${id}`);
    return data;
  },
};