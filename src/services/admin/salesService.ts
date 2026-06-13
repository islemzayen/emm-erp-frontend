import api from "../api";

export const salesService = {
  getStats: async () => {
    const { data } = await api.get("/sales/stats");
    return data;
  },

  getAllEmployees: async () => {
    const { data } = await api.get("/sales/employees");
    return data;
  },

  createEmployee: async (employeeData: {
    name: string;
    position: string;
    phone: string;
    
    salary: number;
    joinedDate: string;
  }) => {
    const { data } = await api.post("/sales/employees", employeeData);
    return data;
  },

  updateEmployee: async (id: string, employeeData: Partial<{
    name: string;
    position: string;
    phone: string;
   
    salary: number;
    joinedDate: string;
  }>) => {
    const { data } = await api.put(`/sales/employees/${id}`, employeeData);
    return data;
  },

  deleteEmployee: async (id: string) => {
    const { data } = await api.delete(`/sales/employees/${id}`);
    return data;
  },
};