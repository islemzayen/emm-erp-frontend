import api from "@/services/api";

export type EmpruntPaymentMethod = "ESPECE" | "CHEQUE" | "VIREMENT" | "AUTRE";

export interface EmpruntPayment {
  _id: string;
  amount: number;
  method: EmpruntPaymentMethod;
  paidAt: string;
  notes?: string;
  createdAt?: string;
}

export interface Emprunt {
  _id: string;
  empruntNo: string;
  lenderName: string;
  label?: string;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  status: "OPEN" | "SETTLED";
  startDate: string;
  payments: EmpruntPayment[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmpruntPayload {
  lenderName: string;
  label?: string;
  totalAmount: number;
  startDate?: string;
  notes?: string;
}

export interface AddEmpruntPaymentPayload {
  amount: number;
  method?: EmpruntPaymentMethod;
  paidAt?: string;
  notes?: string;
}

const BASE = "/finance/emprunts";

export const empruntService = {
  getAll: async (): Promise<Emprunt[]> => (await api.get(BASE)).data,
  getById: async (id: string): Promise<Emprunt> => (await api.get(`${BASE}/${id}`)).data,
  create: async (payload: CreateEmpruntPayload): Promise<Emprunt> =>
    (await api.post(BASE, payload)).data,
  remove: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/${id}`);
  },
  addPayment: async (id: string, payload: AddEmpruntPaymentPayload): Promise<Emprunt> =>
    (await api.post(`${BASE}/${id}/payments`, payload)).data,
  deletePayment: async (id: string, paymentId: string): Promise<Emprunt> =>
    (await api.delete(`${BASE}/${id}/payments/${paymentId}`)).data,
};