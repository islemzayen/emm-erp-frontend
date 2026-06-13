import api from "../api";

/** Stock department employees & stats are under /api/stock-admin (same as other departments). */
const STOCK_ADMIN_PREFIX = "/stock-admin";

export const stockService = {
  getStats: async () => {
    const { data } = await api.get(`${STOCK_ADMIN_PREFIX}/stats`);
    return data;
  },

  getAllEmployees: async () => {
    const { data } = await api.get(`${STOCK_ADMIN_PREFIX}/employees`);
    return data;
  },

  createEmployee: async (employeeData: {
    name: string;
    position: string;
    phone: string;
    salary: number;
    joinedDate: string;
  }) => {
    const { data } = await api.post(`${STOCK_ADMIN_PREFIX}/employees`, employeeData);
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
    const { data } = await api.put(`${STOCK_ADMIN_PREFIX}/employees/${id}`, employeeData);
    return data;
  },

  deleteEmployee: async (id: string) => {
    const { data } = await api.delete(`${STOCK_ADMIN_PREFIX}/employees/${id}`);
    return data;
  },
};