import api from "./api";

export const marketingDocumentService = {

  upload: async (payload: {
    type: string;
    note?: string;
    file: File;
  }) => {
    const form = new FormData();
    form.append("type", payload.type);
    form.append("note", payload.note || "");
    form.append("file", payload.file, payload.file.name);

    const { data } = await api.post("/marketing/documents", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  list: async (filters?: { type?: string }) => {
    const params = filters ? new URLSearchParams(filters as any).toString() : "";
    const { data } = await api.get(`/marketing/documents${params ? `?${params}` : ""}`);
    return data;
  },

  download: async (id: string) => {
    return api.get(`/marketing/documents/${id}/download`, { responseType: "blob" });
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/marketing/documents/${id}`);
    return data;
  },
};