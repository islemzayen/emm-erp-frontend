"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { vehicleService, type Vehicle, type VehicleDelivery } from "@/services/commercial/vehicleService";
import { commercialSettingService } from "@/services/commercial/commercialSettingService";
import {
  ArrowLeft, CalendarDays, Clock, Fuel, Loader2,
  Package, Weight,
} from "lucide-react";

// ─── Durability helpers (same formula as list page) ──────────────────────────
function calcDurabilityFromAgeDays(ageDays: number): number {
  if (ageDays < 365) return 50;
  if (ageDays <= 4 * 365) return 100;
  return Math.max(0, 100 - 0.07 * (ageDays - 4 * 365));
}
function calcDurability(purchaseDate: string): number {
  const ageDays = (Date.now() - new Date(purchaseDate).getTime()) / 86_400_000;
  return calcDurabilityFromAgeDays(Math.max(0, ageDays));
}
function durColor(pct: number) {
  if (pct >= 80) return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (pct >= 50) return { bar: "bg-amber-400",   text: "text-amber-600 dark:text-amber-400" };
  return             { bar: "bg-red-500",         text: "text-red-600 dark:text-red-400" };
}
function ageStr(purchaseDate: string) {
  const ms = Date.now() - new Date(purchaseDate).getTime();
  const years = ms / (1000 * 60 * 60 * 24 * 365);
  if (years < 1) return `${Math.round(years * 12)} mois`;
  return `${years.toFixed(1)} ans`;
}
function salesLineAmount(line: { quantity: number; unitPrice: number; discount?: number }) {
  return line.quantity * line.unitPrice * (1 - Math.min(100, Math.max(0, line.discount || 0)) / 100);
}

// ─── Durability curve SVG ─────────────────────────────────────────────────────
function DurabilityCurve({ purchaseDate }: { purchaseDate: string }) {
  const W = 480, H = 160, PX = 40, PY = 16;
  const plotW = W - PX - 12, plotH = H - PY - 24;
  const maxDays = 10 * 365;

  const points: { x: number; y: number }[] = [];
  for (let d = 0; d <= maxDays; d += Math.max(1, Math.floor(maxDays / 300))) {
    const pct = calcDurabilityFromAgeDays(d);
    points.push({ x: PX + (d / maxDays) * plotW, y: PY + plotH - (pct / 100) * plotH });
  }
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const ageDays = Math.min((Date.now() - new Date(purchaseDate).getTime()) / 86_400_000, maxDays);
  const curPct = calcDurabilityFromAgeDays(Math.max(0, ageDays));
  const curX = PX + (ageDays / maxDays) * plotW;
  const curY = PY + plotH - (curPct / 100) * plotH;
  const c = durColor(curPct);
  const strokeColor = c.bar === "bg-emerald-500" ? "#22c55e" : c.bar === "bg-amber-400" ? "#f59e0b" : "#ef4444";
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <svg width={W} height={H} className="w-full">
      {yTicks.map((pct) => {
        const y = PY + plotH - (pct / 100) * plotH;
        return (
          <g key={pct}>
            <line x1={PX} y1={y} x2={PX + plotW} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
            <text x={PX - 4} y={y + 3.5} fontSize={9} fill="currentColor" fillOpacity={0.4} textAnchor="end">{pct}</text>
          </g>
        );
      })}
      {[0, 2, 4, 6, 8, 10].map((yr) => {
        const d = yr * 365;
        const x = PX + (d / maxDays) * plotW;
        return <text key={yr} x={x} y={H - 4} fontSize={9} fill="currentColor" fillOpacity={0.35} textAnchor="middle">{yr}a</text>;
      })}
      <line x1={PX} y1={PY} x2={PX} y2={PY + plotH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
      <line x1={PX} y1={PY + plotH} x2={PX + plotW} y2={PY + plotH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
      <defs>
        <linearGradient id="durGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.18} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`${PX},${PY + plotH} ${polyline} ${PX + plotW},${PY + plotH}`}
        fill="url(#durGrad)"
      />
      <polyline points={polyline} fill="none" stroke={strokeColor} strokeWidth={2} strokeLinejoin="round" />
      <line x1={curX} y1={PY} x2={curX} y2={PY + plotH} stroke={strokeColor} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={curX} cy={curY} r={5} fill={strokeColor} />
      <text x={curX + 8} y={curY - 6} fontSize={10} fill={strokeColor} fontWeight="bold">{curPct.toFixed(0)}%</text>
    </svg>
  );
}

const surface = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [vehicle, setVehicle]     = useState<Vehicle | null>(null);
  const [deliveries, setDeliveries] = useState<VehicleDelivery[]>([]);
  const [fuelPrice, setFuelPrice]       = useState(0);
  const [fuelPer100Km, setFuelPer100Km] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      vehicleService.getById(id),
      vehicleService.getDeliveries(id),
      commercialSettingService.get(),
    ])
      .then(([v, d, s]) => {
        setVehicle(v);
        setDeliveries(d);
        const match = (s.fuelTypes ?? []).find((ft: any) => ft.name === v.fuelType);
        setFuelPrice(match?.pricePerLiter ?? 0);
        setFuelPer100Km(match?.consumptionPer100Km ?? 0);
      })
      .catch(() => setError("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [id]);

  const stats = useMemo(() => {
    if (!deliveries.length) return { orderCount: 0, income: 0, totalFuelAdded: 0, totalKm: 0, totalConsumed: 0, totalCost: 0, resteCarburant: vehicle?.fuelCapacityLiters ?? 0 };
    const completed  = deliveries.filter((d) => d.status === "COMPLETED");
    const active     = deliveries.filter((d) => d.status !== "CANCELLED");
    const orders     = completed.flatMap((d) => d.orderIds || []);
    const revenue    = orders.filter((o) => !["RETURNED","CANCELLED"].includes(String(o.status||"").toUpperCase()));
    const income     = revenue.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + salesLineAmount(l), 0), 0);
    const totalFuelAdded = active.reduce((s, d) => s + Number(d.fuelAddedLiters || 0), 0);
    const totalKm    = completed.reduce((s, d) => s + Number(d.distanceKm || 0), 0);
    const totalConsumed = fuelPer100Km > 0 ? (totalKm / 100) * fuelPer100Km : 0;
    const totalCost  = totalConsumed * fuelPrice;
    const capacity   = vehicle?.fuelCapacityLiters ?? 0;
    const resteCarburant = capacity > 0
      ? Math.max(0, Math.min(capacity, capacity + totalFuelAdded - totalConsumed))
      : 0;
    return { orderCount: orders.length, income, totalFuelAdded, totalKm, totalConsumed, totalCost, resteCarburant, capacity };
  }, [deliveries, fuelPrice, fuelPer100Km, vehicle]);

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
        <div className="flex items-center justify-center gap-2 py-32 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Chargement...
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !vehicle) {
    return (
      <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
        <div className="py-20 text-center text-sm text-rose-500">{error || "Véhicule introuvable"}</div>
      </ProtectedRoute>
    );
  }

  const durPct = calcDurability(vehicle.purchaseDate);
  const c = durColor(durPct);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">

        {/* Back + header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {vehicle.matricule}
            </h1>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              EMM ERP · Commercial · Véhicule
            </p>
          </div>
          <span className={`ml-2 rounded-full px-3 py-1 text-xs font-semibold ${
            vehicle.active
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}>
            {vehicle.active ? "Actif" : "Inactif"}
          </span>
        </div>

        {/* Info + durability */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`${surface} p-5`}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Informations</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Weight size={14} className="shrink-0 text-slate-400" />
                <span>Capacité : <strong>{vehicle.capacityKg} kg</strong> · <strong>{vehicle.capacityPackets} colis</strong></span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <CalendarDays size={14} className="shrink-0 text-slate-400" />
                <span>Achat : <strong>{new Date(vehicle.purchaseDate).toLocaleDateString("fr-FR")}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Clock size={14} className="shrink-0 text-slate-400" />
                <span>Âge : <strong>{ageStr(vehicle.purchaseDate)}</strong></span>
              </div>
              {vehicle.fuelType && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Fuel size={14} className="shrink-0 text-slate-400" />
                  <span>Carburant : <strong>{vehicle.fuelType}</strong>{vehicle.fuelCapacityLiters ? <> · <strong>{vehicle.fuelCapacityLiters} L</strong></> : null}</span>
                </div>
              )}
              {vehicle.notes && (
                <p className="mt-2 text-xs italic text-slate-400">{vehicle.notes}</p>
              )}
            </div>
          </div>

          <div className={`${surface} p-5`}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Durabilité</p>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1 h-3 rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={`h-3 rounded-full transition-all ${c.bar}`} style={{ width: `${durPct}%` }} />
              </div>
              <span className={`text-xl font-bold ${c.text}`}>{durPct.toFixed(0)}%</span>
            </div>
            <DurabilityCurve purchaseDate={vehicle.purchaseDate} />
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Commandes", value: String(stats.orderCount), color: "text-slate-900 dark:text-white" },
            { label: "Revenus", value: `${stats.income.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND`, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "KM parcourus", value: `${stats.totalKm.toLocaleString("fr-TN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`, color: "text-indigo-600 dark:text-indigo-400" },
            { label: "Carburant ajouté", value: `${stats.totalFuelAdded.toLocaleString("fr-TN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`, color: "text-sky-600 dark:text-sky-400" },
            { label: "Dépense carburant", value: `${stats.totalCost.toLocaleString("fr-TN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND`, color: "text-rose-600 dark:text-rose-400", sub: `${stats.totalConsumed.toLocaleString("fr-TN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L consommés` },
            { label: "Reste carburant", value: `${stats.resteCarburant.toLocaleString("fr-TN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`, color: "text-amber-600 dark:text-amber-400", sub: (stats as any).capacity > 0 ? `/ ${(stats as any).capacity} L` : "" },
          ].map((s) => (
            <div key={s.label} className={`${surface} px-4 py-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{s.label}</p>
              <p className={`mt-2 text-lg font-bold ${s.color}`}>{s.value}</p>
              {s.sub && <p className="text-[11px] text-slate-400">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Reste carburant gauge */}
        {(stats as any).capacity > 0 && (
          <div className={`${surface} px-5 py-4`}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Niveau carburant estimé</p>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {stats.resteCarburant.toFixed(1)} L / {(stats as any).capacity} L
              </span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-4 rounded-full bg-amber-400 transition-all"
                style={{ width: `${Math.min(100, ((stats as any).capacity > 0 ? stats.resteCarburant / (stats as any).capacity : 0) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Calculé : capacité ({(stats as any).capacity} L) + ajouté ({stats.totalFuelAdded.toFixed(1)} L) − consommé ({stats.totalConsumed.toFixed(1)} L)
            </p>
          </div>
        )}

        {/* Delivery history */}
        <div className={`${surface} overflow-hidden`}>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <p className="font-semibold text-slate-950 dark:text-white">Historique des livraisons</p>
            <p className="mt-0.5 text-xs text-slate-400">{deliveries.length} plan{deliveries.length !== 1 ? "s" : ""}</p>
          </div>
          {deliveries.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-400">
              <Package size={20} className="mr-2 opacity-40" /> Aucune livraison enregistrée
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Livreur</th>
                    <th className="px-5 py-3">Zone</th>
                    <th className="px-5 py-3 text-center">Cmd</th>
                    <th className="px-5 py-3 text-right">KM</th>
                    <th className="px-5 py-3 text-right">Ajouté (L)</th>
                    <th className="px-5 py-3 text-right">Consommé (L)</th>
                    <th className="px-5 py-3 text-right">Dépense (TND)</th>
                    <th className="px-5 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deliveries.map((d) => {
                    const km       = Number(d.distanceKm || 0);
                    const consumed = fuelPer100Km > 0 ? (km / 100) * fuelPer100Km : 0;
                    const cost     = consumed * fuelPrice;
                    return (
                    <tr key={d._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(d.planDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">{d.planNo}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{d.livreurName || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{d.zone || "—"}</td>
                      <td className="px-5 py-3 text-center text-slate-500 dark:text-slate-400">{d.orderIds.length}</td>
                      <td className="px-5 py-3 text-right font-medium text-indigo-600 dark:text-indigo-400">
                        {km > 0 ? `${km.toLocaleString("fr-TN", { maximumFractionDigits: 1 })}` : "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-sky-600 dark:text-sky-400">
                        {(d.fuelAddedLiters ?? 0) > 0 ? `${Number(d.fuelAddedLiters).toFixed(1)}` : "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-amber-600 dark:text-amber-400">
                        {consumed > 0 ? consumed.toFixed(1) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-rose-600 dark:text-rose-400">
                        {cost > 0 ? cost.toLocaleString("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          d.status === "COMPLETED"   ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" :
                          d.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" :
                          d.status === "CANCELLED"   ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400" :
                          "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                        }`}>{d.status}</span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </ProtectedRoute>
  );
}
