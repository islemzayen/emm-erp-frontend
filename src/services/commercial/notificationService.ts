import api from "../api";

export interface CommercialNotification {
  _id: string;
  scope: "COMMERCIAL";
  audience: "INTERNAL" | "CUSTOMER";
  eventType: "ORDER_SHIPPED" | "ORDER_DELIVERED";
  title: string;
  message: string;
  customerName?: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt?: string;
  relatedOrderId?: {
    _id: string;
    orderNo: string;
    status: string;
    shippedAt?: string;
    deliveredAt?: string;
  } | null;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export const notificationService = {
  getAll: async (): Promise<CommercialNotification[]> =>
    (await api.get("/commercial/notifications")).data,

  markRead: async (id: string): Promise<CommercialNotification> =>
    (await api.post(`/commercial/notifications/${id}/read`)).data,
};
