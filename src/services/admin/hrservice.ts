import api from "../api";

export const hrService = {
  getStats: async () => {
    const { data } = await api.get("/hr/stats");
    return data;
  },

  getAllEmployees: async () => {
    const { data } = await api.get("/hr/employees");
    return data;
  },

  createEmployee: async (employeeData: {
    name: string;
    position: string;
    phone: string;
    
    salary: number;
    joinedDate: string;
  }) => {
    const { data } = await api.post("/hr/employees", employeeData);
    return data; // { _id, name, email, plainPassword, ... }
  },

  updateEmployee: async (id: string, employeeData: Partial<{
    name: string;
    position: string;
    phone: string;
    
    salary: number;
    joinedDate: string;
  }>) => {
    const { data } = await api.put(`/hr/employees/${id}`, employeeData);
    return data;
  },

  deleteEmployee: async (id: string) => {
    const { data } = await api.delete(`/hr/employees/${id}`);
    return data;
  },
};