import api from "./api";

export const documentService = {

  // Upload using FormData (multipart) — sends actual file, not base64
  upload: async (payload: {
    employeeId: string;
    employeeName: string;
    department: string;
    type: string;
    note?: string;
    file: File;                // actual File object
  }) => {
    const form = new FormData();
    form.append("employeeId",   payload.employeeId);
    form.append("employeeName", payload.employeeName);
    form.append("department",   payload.department);
    form.append("type",         payload.type);
    form.append("note",         payload.note || "");
    form.append("file",         payload.file, payload.file.name);

    const { data } = await api.post("/documents", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  list: async (filters?: { employeeId?: string; type?: string; department?: string }) => {
    const params = filters ? new URLSearchParams(filters as any).toString() : "";
    const { data } = await api.get(`/documents${params ? `?${params}` : ""}`);
    return data;
  },

  // Download returns a blob URL for preview/download
  download: async (id: string): Promise<{ blobUrl: string; fileName: string; mimeType: string }> => {
    const { data: meta } = await api.get(`/documents/${id}/download`, {
      responseType: "blob",
    });
    const blobUrl = URL.createObjectURL(meta);
    // Get filename from response headers if available
    return { blobUrl, fileName: "", mimeType: "application/pdf" };
  },

  // Stream URL — use directly in <iframe> or <a> for download
  // The token is sent via Authorization header through axios interceptor
  getStreamUrl: (id: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    return `${base}/documents/${id}/download`;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/documents/${id}`);
    return data;
  },
};