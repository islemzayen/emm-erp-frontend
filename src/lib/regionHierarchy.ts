import type { Customer } from "@/services/commercial/customerService";

export const TUNISIA_STATES = [
  "Ariana",
  "Beja",
  "Ben Arous",
  "Bizerte",
  "Gabes",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kebili",
  "Le Kef",
  "Mahdia",
  "La Manouba",
  "Medenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
] as const;

export const CONTINENTS = [
  "Africa",
  "Europe",
  "Asia",
  "North America",
  "South America",
  "Oceania",
] as const;

export const COUNTRIES_BY_CONTINENT: Record<string, string[]> = {
  Africa: ["Tunisia", "Algeria", "Morocco", "Libya", "Egypt"],
  Europe: ["France", "Italy", "Germany", "Spain"],
  Asia: ["Turkey", "United Arab Emirates", "Saudi Arabia", "China"],
  "North America": ["Canada", "United States", "Mexico"],
  "South America": ["Brazil", "Argentina"],
  Oceania: ["Australia"],
};

export const STATES_BY_COUNTRY: Record<string, string[]> = {
  Tunisia: [...TUNISIA_STATES],
  Algeria: ["Algiers", "Oran", "Constantine", "Setif"],
  Morocco: ["Casablanca-Settat", "Rabat-Sale-Kenitra", "Marrakesh-Safi", "Tangier-Tetouan-Al Hoceima"],
  Libya: ["Tripoli", "Benghazi", "Misrata", "Sabha"],
  Egypt: ["Cairo", "Alexandria", "Giza", "Dakahlia"],
  France: ["Ile-de-France", "Provence-Alpes-Cote d'Azur", "Auvergne-Rhone-Alpes", "Occitanie"],
  Italy: ["Lazio", "Lombardy", "Sicily", "Campania"],
  Germany: ["Bavaria", "Berlin", "North Rhine-Westphalia", "Hesse"],
  Spain: ["Madrid", "Catalonia", "Andalusia", "Valencia"],
  Turkey: ["Istanbul", "Ankara", "Izmir", "Bursa"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"],
  "Saudi Arabia": ["Riyadh", "Makkah", "Eastern Province", "Madinah"],
  China: ["Beijing", "Shanghai", "Guangdong", "Zhejiang"],
  Canada: ["Ontario", "Quebec", "British Columbia", "Alberta"],
  "United States": ["California", "Texas", "Florida", "New York"],
  Mexico: ["Mexico City", "Jalisco", "Nuevo Leon", "Puebla"],
  Brazil: ["Sao Paulo", "Rio de Janeiro", "Minas Gerais", "Bahia"],
  Argentina: ["Buenos Aires", "Cordoba", "Santa Fe", "Mendoza"],
  Australia: ["New South Wales", "Victoria", "Queensland", "Western Australia"],
};

function clean(value?: string) {
  return String(value || "").trim();
}

export function normalizeRegionValue(value?: string) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getCustomerHierarchy(customer: Partial<Customer>) {
  const country = clean(customer.country);
  const continent = clean(customer.continent);
  const state = clean(customer.state);

  return {
    continent,
    country,
    state,
  };
}

export function getCustomerRegionLabel(customer: Partial<Customer>) {
  const { continent, country, state } = getCustomerHierarchy(customer);
  return [continent, country, state].filter(Boolean).join(" / ");
}

export function getCustomerRegionKey(customer: Partial<Customer>) {
  return normalizeRegionValue(getCustomerRegionLabel(customer));
}

export function getAllDiscoverableZones() {
  return Object.entries(COUNTRIES_BY_CONTINENT).flatMap(([continent, countries]) =>
    countries.flatMap((country) =>
      (STATES_BY_COUNTRY[country] || []).map((state) => `${continent} / ${country} / ${state}`)
    )
  );
}
