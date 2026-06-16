import api from "../api";

export interface Vehicle {
  _id: string;
  matricule: string;
  capacityKg: number;
  capacityPackets: number;
  purchaseDate: string;
  fuelType?: string;
  fuelCapacityLiters?: number;
  durabilityPercent: number;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleDelivery {
  _id: string;
  planNo: string;
  planDate: string;
  status: string;
    livreurName?: string; 

  zone: string;
  fuelAddedLiters?: number;
  distanceKm?: number | null;
  orderIds: {
    _id: string;
    orderNo: string;
    customerName: string;
    status: string;
    shippingCost?: number;
    lines: {
      quantity: number;
      unitPrice: number;
      discount?: number;
      productId?: { _id: string; name: string; sku: string } | null;
    }[];
  }[];
  carrierId?: { _id: string; name: string };
  completedAt?: string;
}

export const vehicleService = {
  getAll: async (): Promise<Vehicle[]> => (await api.get("/commercial/vehicles")).data,
  getActive: async (): Promise<Vehicle[]> => (await api.get("/commercial/vehicles/active")).data,
  getById: async (id: string): Promise<Vehicle> => (await api.get(`/commercial/vehicles/${id}`)).data,
  getDeliveries: async (id: string): Promise<VehicleDelivery[]> =>
    (await api.get(`/commercial/vehicles/${id}/deliveries`)).data,
  create: async (payload: Partial<Vehicle>) => (await api.post("/commercial/vehicles", payload)).data,
  update: async (id: string, payload: Partial<Vehicle>) =>
    (await api.put(`/commercial/vehicles/${id}`, payload)).data,
  toggleActive: async (id: string) => (await api.post(`/commercial/vehicles/${id}/toggle`)).data,
};
