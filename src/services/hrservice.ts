import api from "./api";

export const hrService = {
  getStats: async () => {
    const { data } = await api.get("/hr/stats");
    return data;
  },

  // Returns employees of the HR department only
  getEmployeesOnly: async () => {
    const { data } = await api.get("/hr/employees");
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  // allDepartments=true → /hr/all-employees (all roles across all depts)
  getAllEmployees: async (allDepartments = false) => {
    const endpoint = allDepartments ? "/hr/all-employees" : "/hr/employees";
    const { data } = await api.get(endpoint);
    return Array.isArray(data) ? data : (data?.data ?? data);
  },

  createEmployee: async (employeeData: {
    name: string;
    position: string;
    phone: string;
    salary: number;
    joinedDate: string;
    department: string;
    [key: string]: any;
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
    department: string;
    status: string;
    [key: string]: any;
  }>) => {
    const { data } = await api.put(`/hr/employees/${id}`, employeeData);
    return data;
  },

  deleteEmployee: async (id: string) => {
    const { data } = await api.delete(`/hr/employees/${id}`);
    return data;
  },

  updateStatus: async (id: string, status: "Active" | "On Leave" | "Inactive") => {
    const { data } = await api.patch(`/hr/employees/${id}/status`, { status });
    return data;
  },

  approveAccount: async (id: string) => {
    const { data } = await api.post(`/hr/employees/${id}/approve`);
    return (data as any)?.data ?? data;
  },
};