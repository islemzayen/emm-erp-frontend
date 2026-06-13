import api from "./api";

export interface DeleteRequest {
  _id: string;
  documentId: string;
  documentName: string;
  employeeName: string;
  department: string;
  requestedBy: string;
  status: "Pending" | "Approved" | "Rejected" | "Used";
  code?: string;
  codeExpiresAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

const deleteRequestService = {
  // HR: get own approved (unseen) requests — for notification polling
  getMyApproved: () =>
    api.get<DeleteRequest[]>("/delete-requests/my-approved").then(r => Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? []),

  // HR: mark notification as seen
  markSeen: (id: string) =>
    api.patch(`/delete-requests/${id}/seen`).then(r => r.data),

  // HR: request deletion
  request: (documentId: string) =>
    api.post("/delete-requests", { documentId }).then(r => r.data),

  // HR: check status for a specific document
  getForDocument: (documentId: string) =>
    api.get<DeleteRequest | null>(`/delete-requests/document/${documentId}`).then(r => r.data),

  // HR: submit code to verify and delete
  verify: (documentId: string, code: string) =>
    api.post("/delete-requests/verify", { documentId, code }).then(r => r.data),

  // Admin: get all pending
  getPending: () =>
    api.get<DeleteRequest[]>("/delete-requests/pending").then(r => Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? []),

  // Admin: get pending count for badge
  getPendingCount: () =>
    api.get<{ count: number }>("/delete-requests/pending/count").then(r => (r.data as any)?.data?.count ?? (r.data as any)?.count ?? 0),

  // Admin: get all requests
  getAll: () =>
    api.get<DeleteRequest[]>("/delete-requests").then(r => Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? []),

  // Admin: approve → returns { code, expiresAt }
  approve: (id: string) =>
    api.patch(`/delete-requests/${id}/approve`).then(r => (r.data as any)?.data ?? r.data),

  // Admin: reject
  reject: (id: string) =>
    api.patch(`/delete-requests/${id}/reject`).then(r => r.data),
};

export default deleteRequestService;