import api from "../api";

export interface FuelTypeConfig {
  _id?: string;
  name: string;
  pricePerLiter: number;
  consumptionPer100Km: number;
}

export interface CommercialSetting {
  _id: string;
  fuelPricePerLiter: number;
  fuelPer10Km: number;
  orderPrefix: string;
  orderPadding: number;
  planPrefix: string;
  planPadding: number;
  blPrefix: string;
  blPadding: number;
  fuelTypes: FuelTypeConfig[];
  updatedAt?: string;
}

export const commercialSettingService = {
  get: async (): Promise<CommercialSetting> =>
    (await api.get("/commercial/settings")).data,

  update: async (data: Partial<CommercialSetting>): Promise<CommercialSetting> =>
    (await api.put("/commercial/settings", data)).data,
};
