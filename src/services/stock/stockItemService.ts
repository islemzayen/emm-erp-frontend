import api from "../api";

export const stockItemService = {
  getAll: async () => (await api.get("/stock/items")).data,
  getByProductId: async (productId: string) =>
    (await api.get(`/stock/items/${productId}`)).data,
  getAvailabilityByDepot: async (productIds: string[] = []) =>
    (
      await api.get("/stock/availability-by-depot", {
        params: productIds.length ? { productIds: productIds.join(",") } : {},
      })
    ).data as {
      depots: {
        _id: string;
        name: string;
        productTypeScope: "MP" | "PF" | "MP_PF";
        status: "ACTIVE" | "INACTIVE";
      }[];
      rows: {
        productId: string;
        depotId: string | null;
        quantityOnHand: number;
        quantityReserved: number;
        quantityAvailable: number;
      }[];
    },
};
