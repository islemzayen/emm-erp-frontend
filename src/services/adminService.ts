import api from "./api";

export const adminService = {
  getStats: async () => {
    const { data } = await api.get("/admin/stats");
    return data;
  },

  getAllUsers: async () => {
    const { data } = await api.get("/admin/users");
    return data;
  },

  getUserById: async (id: string) => {
    const { data } = await api.get(`/admin/users/${id}`);
    return data;
  },

  createUser: async (userData: {
    name: string; email: string; password: string; role: string;
    department?: string; position?: string;
  }) => {
    const { data } = await api.post("/admin/users", userData);
    return data;
  },

  updateUser: async (id: string, userData: {
    name?: string; email?: string; role?: string; department?: string;
  }) => {
    const { data } = await api.put(`/admin/users/${id}`, userData);
    return data;
  },

  deleteUser: async (id: string) => {
    const { data } = await api.delete(`/admin/users/${id}`);
    return data;
  },

  resetPassword: async (id: string, newPassword: string) => {
    const { data } = await api.patch(`/admin/users/${id}/reset-password`, { newPassword });
    return data;
  },

  // ── Activity log ───────────────────────────────────────────────────────────
  getActivityLogs: async (params?: { limit?: number; department?: string; userId?: string }) => {
    const { data } = await api.get("/admin/activity", { params });
    return data;
  },

  getActivityStats: async () => {
    const { data } = await api.get("/admin/activity/stats");
    return data;
  },
};