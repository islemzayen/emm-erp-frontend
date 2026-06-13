"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, MapPin, Sparkles, Users } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { customerService, type Customer } from "@/services/commercial/customerService";
import { deliveryPlanService } from "@/services/commercial/deliveryPlanService";
import {
  getAllDiscoverableZones,
  getCustomerHierarchy,
  getCustomerRegionKey,
  getCustomerRegionLabel,
  normalizeRegionValue,
} from "@/lib/regionHierarchy";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function tone(count: number, discovered: boolean) {
  if (count === 0 && discovered) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  }
  if (count === 0) {
    return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  }
  if (count <= 10) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
  }
  return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
}

type RegionNode = {
  key: string;
  label: string;
  level: "continent" | "country" | "state";
  count: number;
  children?: RegionNode[];
};

export default function RegionsPage() {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [discoveredZones, setDiscoveredZones] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    Promise.all([customerService.getAll(), deliveryPlanService.getDiscoveredZones()]).then(
      ([customerData, discoveredData]) => {
        setCustomers(customerData);
        setDiscoveredZones(discoveredData);
      }
    );
  }, []);

  const coveredRegionKeys = useMemo(
    () => new Set(customers.map((customer) => getCustomerRegionKey(customer)).filter(Boolean)),
    [customers]
  );

  const discoveredSet = useMemo(() => {
    const set = new Set(discoveredZones.map((zone) => normalizeRegionValue(zone)));
    coveredRegionKeys.forEach((key) => set.add(key));
    return set;
  }, [coveredRegionKeys, discoveredZones]);

  const discoverableZones = useMemo(() => getAllDiscoverableZones(), []);
  const discoveredOnlyZones = useMemo(
    () =>
      discoverableZones.filter((zone) => {
        const key = normalizeRegionValue(zone);
        return discoveredSet.has(key) && !coveredRegionKeys.has(key);
      }),
    [discoverableZones, discoveredSet, coveredRegionKeys]
  );

  const tree = useMemo<RegionNode[]>(() => {
    const continentMap = new Map<string, Map<string, Map<string, Customer[]>>>();

    customers.forEach((customer) => {
      const { continent, country, state } = getCustomerHierarchy(customer);
      if (!continent || !country) return;

      if (!continentMap.has(continent)) continentMap.set(continent, new Map());
      const countryMap = continentMap.get(continent)!;
      if (!countryMap.has(country)) countryMap.set(country, new Map());
      const stateMap = countryMap.get(country)!;
      const stateKey = state || "Unassigned";
      if (!stateMap.has(stateKey)) stateMap.set(stateKey, []);
      stateMap.get(stateKey)!.push(customer);
    });

    return [...continentMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([continent, countryMap]) => {
        const countries = [...countryMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([country, stateMap]) => {
            const states = [...stateMap.entries()].map(([state, stateCustomers]) => ({
                key: normalizeRegionValue(`${continent} / ${country} / ${state}`),
                label: state || country,
                level: "state" as const,
                count: stateCustomers.length,
              }));

            const countryCount = [...stateMap.values()].reduce((sum, items) => sum + items.length, 0);

            return {
              key: normalizeRegionValue(`${continent} / ${country}`),
              label: country,
              level: "country" as const,
              count: countryCount,
              children: states,
            };
          });

        const continentCount = countries.reduce((sum, country) => sum + country.count, 0);

        return {
          key: normalizeRegionValue(continent),
          label: continent,
          level: "continent" as const,
          count: continentCount,
          children: countries,
        };
      });
  }, [customers]);

  const selectedCustomers = useMemo(() => {
    if (!selectedKey) return [];
    return customers.filter((customer) => {
      const { continent, country, state } = getCustomerHierarchy(customer);
      const continentKey = normalizeRegionValue(continent);
      const countryKey = normalizeRegionValue(`${continent} / ${country}`);
      const stateKey = normalizeRegionValue(`${continent} / ${country} / ${state}`);
      return [continentKey, countryKey, stateKey].includes(selectedKey);
    });
  }, [customers, selectedKey]);

  const stats = useMemo(() => {
    const busy = customers.filter((customer) => customers.filter((c) => getCustomerRegionKey(c) === getCustomerRegionKey(customer)).length > 10).length;
    return {
      totalCustomers: customers.length,
      coveredZones: coveredRegionKeys.size,
      discoveredOnly: discoverableZones.filter((zone) => discoveredSet.has(normalizeRegionValue(zone)) && !coveredRegionKeys.has(normalizeRegionValue(zone))).length,
      busy,
    };
  }, [customers, coveredRegionKeys, discoveredSet, discoverableZones]);

  const selectedLabel =
    tree
      .flatMap((continent) => [continent, ...(continent.children || []), ...((continent.children || []).flatMap((country) => country.children || []))])
      .find((node) => node.key === selectedKey)?.label || "";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <Globe size={18} className="text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("regionsMapTitle")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Customer distribution by continent, country, and state
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t("totalCustomersLabel"), value: stats.totalCustomers, color: "text-slate-900 dark:text-white" },
          { label: "Covered zones", value: stats.coveredZones, color: "text-sky-700 dark:text-sky-400" },
          { label: "Discovered only", value: stats.discoveredOnly, color: "text-amber-700 dark:text-amber-300" },
          { label: t("busyZonesLabel"), value: stats.busy, color: "text-rose-600 dark:text-rose-400" },
        ].map((item) => (
          <div key={item.label} className={`${surface} p-5`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`mt-1 text-2xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className={`${surface} overflow-hidden`}>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Region hierarchy</h2>
          </div>
          <div className="space-y-4 p-4">
            {tree.map((continent) => (
              <div key={continent.key} className="rounded-3xl border border-slate-100 p-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedKey(continent.key)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="font-semibold text-slate-900 dark:text-white">{continent.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone(continent.count, discoveredSet.has(continent.key))}`}>
                    {continent.count}
                  </span>
                </button>

                <div className="mt-3 space-y-2">
                  {(continent.children || []).map((country) => (
                    <div key={country.key} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
                      <button
                        type="button"
                        onClick={() => setSelectedKey(country.key)}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{country.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone(country.count, discoveredSet.has(country.key))}`}>
                          {country.count}
                        </span>
                      </button>

                      {country.children && country.children.length > 0 && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {country.children.map((state) => (
                            <button
                              key={state.key}
                              type="button"
                              onClick={() => setSelectedKey(state.key)}
                              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                            >
                              <span className="truncate">{state.label}</span>
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tone(state.count, discoveredSet.has(state.key))}`}>
                                {state.count}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {discoveredOnlyZones.length > 0 && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-amber-600 dark:text-amber-300" />
                  <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Discovered only
                  </h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {discoveredOnlyZones.map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      disabled
                      className="flex cursor-not-allowed items-center justify-between rounded-2xl border border-amber-200 bg-amber-100 px-3 py-2 text-left text-xs text-amber-700 opacity-90 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      <span className="truncate">{zone}</span>
                      <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                        0
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`${surface} overflow-hidden`}>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {selectedLabel || "Region details"}
            </h2>
          </div>
          {!selectedKey ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center">
              <Sparkles size={30} className="mb-3 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Select a continent, country, or state to see customers.</p>
            </div>
          ) : selectedCustomers.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center p-6 text-center">
              <MapPin size={30} className="mb-3 text-amber-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No customers found in this region.</p>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {selectedCustomers.map((customer) => (
                <div key={customer._id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-950">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{customer.name}</p>
                    <p className="truncate text-xs text-slate-400">{getCustomerRegionLabel(customer) || customer.city || "—"}</p>
                  </div>
                  {!customer.active && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-700">
                      {t("inactiveLabel")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
