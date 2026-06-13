import api from "../api";

export interface FinanceDocument {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  description?: string;
  uploadedBy?: { _id: string; name: string; email: string } | null;
  createdAt: string;
}

export interface DocumentStats {
  total: number;
  monthCount: number;
  totalSize: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve((reader.result as string).split(",")[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const financeDocumentService = {
  getAll: async (): Promise<FinanceDocument[]> =>
    (await api.get("/finance/documents")).data,

  getStats: async (): Promise<DocumentStats> =>
    (await api.get("/finance/documents/stats")).data,

  upload: async (file: File, description?: string): Promise<FinanceDocument> => {
    const data = await fileToBase64(file);
    return (await api.post("/finance/documents", {
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      data,
      description: description ?? "",
    })).data;
  },

  download: (id: string, filename: string) => {
    api.get(`/finance/documents/${id}/download`, { responseType: "blob" }).then((res) => {
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  },

  generateOtp: async (): Promise<{ code: string; expiresAt: string }> =>
    (await api.post("/finance/documents/otp/generate")).data,

  delete: async (id: string, otp: string): Promise<void> => {
    await api.delete(`/finance/documents/${id}`, { data: { otp } });
  },
};
