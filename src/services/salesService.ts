import api from "./api";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface OnlineOrder {
  _id: string;
  orderNo: string;
  customer: { name: string; email: string; phone: string; address: string };
  lines: { productId: string; productName: string; sku: string; quantity: number; unitPrice: number; discountedPrice?: number }[];
  subtotal?: number;
  totalAmount: number;
  status: "pending" | "processing" | "completed" | "cancelled";
  // Marketing integration fields
  promotionId?: string | null;
  promotionCode?: string;
  promotionDiscount?: number;
  campaignId?: string | null;
  // Commercial integration fields
  commercialSalesOrderId?: string | null;
  commercialSalesOrderNo?: string;
  // Stock integration
  stockReserved?: boolean;
  // Tracking (synced from Commercial SalesOrder)
  trackingNumber?: string;
  carrierName?:    string;
  shippedAt?:      string | null;
  deliveredAt?:    string | null;
  // Reseller integration
  resellerId?:      string | null;
  isResellerOrder?: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnlineProduct {
  _id: string;
  stockProductId: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  onlinePrice: number;
  minStockThreshold: number;
  isVisible: boolean;
  tags: string[];
  // enriched at runtime
  stock: number | null;
  stockStatus: "in-stock" | "low-stock" | "out-of-stock" | "pending";
  createdAt: string;
}

export interface OnlineShipment {
  _id: string;
  shipmentNo: string;
  orderId: string;
  orderNo: string;
  customer: { name: string; email: string; phone: string };
  productSummary: string;
  carrier: "DHL" | "Aramex" | "TNT" | "Other";
  trackingNumber: string;
  status: "pending" | "in-transit" | "delivered" | "failed";
  shippedAt: string | null;
  deliveredAt: string | null;
  estimatedAt: string | null;
  notes: string;
  createdAt: string;
}

export interface OnlineReturn {
  _id: string;
  returnNo: string;
  orderId: string;
  orderNo: string;
  customer: { name: string; email: string };
  productSummary: string;
  amount: number;
  reason: "Defective" | "Wrong item" | "Not as described" | "Changed mind" | "Other";
  status: "pending" | "approved" | "rejected" | "refunded";
  adminNotes: string;
  resolvedAt: string | null;
  // Commercial integration
  commercialRmaId?: string | null;
  commercialRmaNo?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  pendingShipments: number;
  totalReturns: number;
  avgOrderValue: number;
  newCustomers: number;
  ordersByStatus: Record<string, number>;
  shipmentsByStatus: Record<string, number>;
  returnsByStatus: Record<string, number>;
  activePromotions?: any[];
  activeCampaigns?: any[];
  topPromoCodes?: any[];
  chartData: { label: string; revenue: number; orders: number }[];
  catalogStats: {
    total: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    totalValue: number;
    avgPrice: number;
  };
}

// ─── Service ───────────────────────────────────────────────────────────────────

export const salesService = {
  // ── Dashboard ───────────────────────────────────────────────────────────────
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await api.get("/online-sales/stats");
    return data;
  },

  // ── Orders ──────────────────────────────────────────────────────────────────
  getOrders: async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const { data } = await api.get("/online-sales/orders", { params });
    return data as { orders: OnlineOrder[]; total: number; page: number; pages: number };
  },

  getOrderById: async (id: string): Promise<OnlineOrder> => {
    const { data } = await api.get(`/online-sales/orders/${id}`);
    return data;
  },

  createOrder: async (payload: Partial<OnlineOrder>): Promise<OnlineOrder> => {
    const { data } = await api.post("/online-sales/orders", payload);
    return data;
  },

  updateOrder: async (id: string, payload: Partial<OnlineOrder>): Promise<OnlineOrder> => {
    const { data } = await api.put(`/online-sales/orders/${id}`, payload);
    return data;
  },

  updateOrderStatus: async (id: string, status: OnlineOrder["status"]): Promise<OnlineOrder> => {
    const { data } = await api.patch(`/online-sales/orders/${id}/status`, { status });
    return data;
  },

  syncTracking: async (id: string): Promise<OnlineOrder> => {
    const { data } = await api.post(`/online-sales/orders/${id}/sync-tracking`);
    return data;
  },

  deleteOrder: async (id: string) => {
    const { data } = await api.delete(`/online-sales/orders/${id}`);
    return data;
  },

  validatePromoCode: async (code: string): Promise<{ name: string; code: string; discount: number; type: string; description: string }> => {
    const { data } = await api.get(`/online-sales/orders/promo/${encodeURIComponent(code)}`);
    return data;
  },

  // Active campaigns for order attribution (reuses the dashboard /stats payload,
  // so no extra route or Marketing-role permission is required).
  getActiveCampaigns: async (): Promise<ActiveCampaign[]> => {
    const { data } = await api.get("/online-sales/stats");
    return (data.activeCampaigns ?? []) as ActiveCampaign[];
  },

  // ── Products / Catalog ──────────────────────────────────────────────────────
  getProducts: async (params?: { search?: string; status?: string }) => {
    const { data } = await api.get("/online-sales/products", { params });
    return data as OnlineProduct[];
  },

  getProductById: async (id: string): Promise<OnlineProduct> => {
    const { data } = await api.get(`/online-sales/products/${id}`);
    return data;
  },

  createProduct: async (payload: Partial<OnlineProduct>): Promise<OnlineProduct> => {
    const { data } = await api.post("/online-sales/products", payload);
    return data;
  },

  updateProduct: async (id: string, payload: Partial<OnlineProduct>): Promise<OnlineProduct> => {
    const { data } = await api.put(`/online-sales/products/${id}`, payload);
    return data;
  },

  toggleProductVisibility: async (id: string): Promise<OnlineProduct> => {
    const { data } = await api.patch(`/online-sales/products/${id}/visibility`);
    return data;
  },

  deleteProduct: async (id: string) => {
    const { data } = await api.delete(`/online-sales/products/${id}`);
    return data;
  },

  // ── Shipments / Tracking ────────────────────────────────────────────────────
  getShipments: async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const { data } = await api.get("/online-sales/shipments", { params });
    return data as { shipments: OnlineShipment[]; total: number; page: number; pages: number };
  },

  getShipmentById: async (id: string): Promise<OnlineShipment> => {
    const { data } = await api.get(`/online-sales/shipments/${id}`);
    return data;
  },

  createShipment: async (payload: Partial<OnlineShipment>): Promise<OnlineShipment> => {
    const { data } = await api.post("/online-sales/shipments", payload);
    return data;
  },

  updateShipment: async (id: string, payload: Partial<OnlineShipment>): Promise<OnlineShipment> => {
    const { data } = await api.put(`/online-sales/shipments/${id}`, payload);
    return data;
  },

  updateShipmentStatus: async (id: string, status: OnlineShipment["status"]): Promise<OnlineShipment> => {
    const { data } = await api.patch(`/online-sales/shipments/${id}/status`, { status });
    return data;
  },

  deleteShipment: async (id: string) => {
    const { data } = await api.delete(`/online-sales/shipments/${id}`);
    return data;
  },

  // ── Returns ─────────────────────────────────────────────────────────────────
  getReturns: async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const { data } = await api.get("/online-sales/returns", { params });
    return data as { returns: OnlineReturn[]; total: number; page: number; pages: number };
  },

  getReturnById: async (id: string): Promise<OnlineReturn> => {
    const { data } = await api.get(`/online-sales/returns/${id}`);
    return data;
  },

  createReturn: async (payload: Partial<OnlineReturn>): Promise<OnlineReturn> => {
    const { data } = await api.post("/online-sales/returns", payload);
    return data;
  },

  updateReturn: async (id: string, payload: Partial<OnlineReturn>): Promise<OnlineReturn> => {
    const { data } = await api.put(`/online-sales/returns/${id}`, payload);
    return data;
  },

  updateReturnStatus: async (
    id: string,
    status: OnlineReturn["status"],
    adminNotes?: string
  ): Promise<OnlineReturn> => {
    const { data } = await api.patch(`/online-sales/returns/${id}/status`, { status, adminNotes });
    return data;
  },

  deleteReturn: async (id: string) => {
    const { data } = await api.delete(`/online-sales/returns/${id}`);
    return data;
  },

  // ── Employees ───────────────────────────────────────────────────────────────
  getAllEmployees: async () => {
    const { data } = await api.get("/sales/employees");
    return data?.data ?? data ?? [];
  },

  getEmployeeStats: async () => {
    const { data } = await api.get("/sales/stats");
    return data?.data ?? data ?? { total: 0, onLeave: 0, avgTenure: 0 };
  },

  createEmployee: async (payload: any) => {
    const { data } = await api.post("/sales/employees", payload);
    return data?.data ?? data;
  },

  updateEmployee: async (id: string, payload: any) => {
    const { data } = await api.put(`/sales/employees/${id}`, payload);
    return data?.data ?? data;
  },

  deleteEmployee: async (id: string) => {
    const { data } = await api.delete(`/sales/employees/${id}`);
    return data;
  },
};

// ─── Marketing integration types ───────────────────────────────────────────────

export interface ActivePromotion {
  _id: string;
  name: string;
  code: string;
  discount: number;
  type: string;
  description: string;
  endDate: string;
}

export interface ActiveCampaign {
  _id: string;
  name: string;
  channel: string;
  leads: number;
  conversionRate: number;
  budget: number;
  spend: number;
}

// Extend DashboardStats (re-export with added fields handled by backend)
// activePromotions and activeCampaigns are included in /stats response