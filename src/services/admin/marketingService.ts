import api from "../api";

export const marketingService = {
  getStats: async () => {
    const { data } = await api.get("/marketing/stats");
    return data;
  },

  getAllEmployees: async () => {
    const { data } = await api.get("/marketing/employees");
    return data;
  },

  createEmployee: async (employeeData: {
    name: string;
    position: string;
    phone: string;
    
    salary: number;
    joinedDate: string;
  }) => {
    const { data } = await api.post("/marketing/employees", employeeData);
    return data;
  },

  updateEmployee: async (id: string, employeeData: Partial<{
    name: string;
    position: string;
    phone: string;
    
    salary: number;
    joinedDate: string;
  }>) => {
    const { data } = await api.put(`/marketing/employees/${id}`, employeeData);
    return data;
  },

  deleteEmployee: async (id: string) => {
    const { data } = await api.delete(`/marketing/employees/${id}`);
    return data;
  },
};