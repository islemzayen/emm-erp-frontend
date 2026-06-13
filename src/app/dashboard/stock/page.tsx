"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes,
  Package, TrendingUp, TrendingDown, RefreshCw, ShieldAlert,
  Activity, BarChart3, Layers, CheckCircle2, Clock,
} from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid,
  Tooltip, XAxis, YAxis, Legend, PieChart, Pie, Cell,
} from "recharts";
import { stockProductService } from "@/services/stock/stockProductService";
import { stockItemService } from "@/services/stock/stockItemService";
import { stockMovementService } from "@/services/stock/stockMovementService";
import { stockAlertService } from "@/services/stock/stockAlertService";

interface Product {
  _id: string; sku: string; name: string; category?: string;
  type: "PRODUIT_FINI" | "SOUS_ENSEMBLE" | "COMPOSANT" | "MATIERE_PREMIERE";
  unit: string; status: "ACTIVE" | "INACTIVE"; purchasePrice?: number;
}
interface StockItem {
  _id: string; productId: Product;
  quantityOnHand: number; quantityReserved: number; quantityAvailable: number;
  status: "ACTIVE" | "INACTIVE"; lastMovementAt?: string | null;
}
interface Movement {
  _id: string; productId?: Product; type: string; quantity: number; createdAt: string;
}
interface StockAlertItem {
  _id: string; productId?: Product;
  type: "LOW_STOCK" | "OUT_OF_STOCK" | "NEGATIVE_RISK" | "SYSTEM";
  currentQuantity: number; thresholdQuantity?: number | null;
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED";
  createdAt: string; title: string; message: string;
}

function monthLabel(date: Date) {
  return date.toLocaleString("fr-FR", { month: "short" });
}

const CHART_COLORS = { entry: "#0d9488", exit: "#f43f5e" };
const PIE_COLORS = ["#0ea5e9", "#22c55e", "#a855f7", "#f97316"];
const TYPE_LABELS: Record<string, string> = {
  PRODUIT_FINI: "Produit fini", SOUS_ENSEMBLE: "Sous-ensemble",
  COMPOSANT: "Composant", MATIERE_PREMIERE: "Mat. première",
};

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function KpiCard({ icon, iconBg, label, value, sub, trend, delay = 0 }: {
  icon: React.ReactNode; iconBg: string; label: string; value: string;
  sub: string; trend?: "up" | "down" | "neutral"; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className={`${card} p-5`}>
      <div className="flex items-start justify-between">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
        {trend === "up"   && <TrendingUp  size={14} className="text-emerald-500" />}
        {trend === "down" && <TrendingDown size={14} className="text-rose-500" />}
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</p>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name === "entry" ? "Entrées" : "Sorties"}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function StockDashboardPage() {
  const { t } = useLanguage();

  const [products,  setProducts]  = useState<Product[]>([]);
  const [items,     setItems]     = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [alerts,    setAlerts]    = useState<StockAlertItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState("");
  const [lastSync,  setLastSync]  = useState<Date | null>(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError("");
      const [productData, itemData, movementData, alertData] = await Promise.all([
        stockProductService.getAll(),
        stockItemService.getAll(),
        stockMovementService.getAll(),
        stockAlertService.getAll(),
      ]);
      setProducts(productData); setItems(itemData);
      setMovements(movementData); setAlerts(alertData);
      setLastSync(new Date());
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load stock dashboard");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchDashboard(); }, [fetchDashboard]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeProducts    = useMemo(() => products.filter((p) => p.status === "ACTIVE"), [products]);
  const totalProducts     = activeProducts.length;
  const mpCount           = useMemo(() => activeProducts.filter((p) => p.type === "MATIERE_PREMIERE").length, [activeProducts]);
  const pfCount           = useMemo(() => activeProducts.filter((p) => p.type === "PRODUIT_FINI").length, [activeProducts]);
  const openAlerts        = useMemo(() => alerts.filter((a) => a.status === "OPEN"), [alerts]);
  const criticalAlerts    = useMemo(() => openAlerts.filter((a) => a.type === "OUT_OF_STOCK"), [openAlerts]);
  const totalOnHand       = useMemo(() => items.reduce((s, i) => s + (i.quantityOnHand || 0), 0), [items]);
  const totalReserved     = useMemo(() => items.reduce((s, i) => s + (i.quantityReserved || 0), 0), [items]);
  const totalAvailable    = useMemo(() => items.reduce((s, i) => s + (i.quantityAvailable || 0), 0), [items]);

  const movementsThisMonth = useMemo(() => {
    const now = new Date();
    return movements.filter((m) => {
      const d = new Date(m.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [movements]);

  const movementChartData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { name: monthLabel(d), entry: 0, exit: 0 };
    });
    movements.forEach((m) => {
      const d = new Date(m.createdAt);
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (diff >= 0 && diff <= 5) {
        const idx = 5 - diff;
        if (m.type === "ENTRY") months[idx].entry += m.quantity;
        if (m.type === "EXIT" || m.type === "DEDUCTION") months[idx].exit += m.quantity;
      }
    });
    return months;
  }, [movements]);

  const pieData = useMemo(() => [
    { key: "PRODUIT_FINI",     label: TYPE_LABELS.PRODUIT_FINI,     value: 0, color: PIE_COLORS[0] },
    { key: "SOUS_ENSEMBLE",    label: TYPE_LABELS.SOUS_ENSEMBLE,    value: 0, color: PIE_COLORS[1] },
    { key: "COMPOSANT",        label: TYPE_LABELS.COMPOSANT,        value: 0, color: PIE_COLORS[2] },
    { key: "MATIERE_PREMIERE", label: TYPE_LABELS.MATIERE_PREMIERE, value: 0, color: PIE_COLORS[3] },
  ].map((item) => ({
    ...item,
    value: activeProducts.filter((p) => p.type === item.key).length,
  })), [activeProducts]);

  const topItems = useMemo(() =>
    [...items]
      .sort((a, b) => b.quantityOnHand - a.quantityOnHand)
      .slice(0, 6),
    [items]);

  const recentMovements = useMemo(() =>
    [...movements]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 6),
    [movements]);

  const alertBadge = (type: StockAlertItem["type"]) => ({
    OUT_OF_STOCK:  "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/40",
    LOW_STOCK:     "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40",
    NEGATIVE_RISK: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/40",
    SYSTEM:        "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  }[type] ?? "bg-slate-100 text-slate-600 border-slate-200");

  const fmtTime = (v?: string | null) =>
    v ? new Date(v).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  // ── Availability ratio for progress bar ───────────────────────────────────
  const availRatio = totalOnHand > 0 ? Math.round((totalAvailable / totalOnHand) * 100) : 0;
  const reserveRatio = totalOnHand > 0 ? Math.round((totalReserved / totalOnHand) * 100) : 0;

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER"]}>
      <div className="space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              EMM ERP · MODULE STOCK
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Tableau de bord <span className="text-teal-500">Stock</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {lastSync && (
              <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <Clock size={11} />
                Sync {lastSync.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            <button
              onClick={() => void fetchDashboard(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Actualiser
            </button>
          </div>
        </div>

        {/* ── Critical alert banner ──────────────────────────────────────── */}
        {!loading && criticalAlerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
            <ShieldAlert size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
              {criticalAlerts.length} produit{criticalAlerts.length > 1 ? "s" : ""} en rupture de stock — action requise
            </p>
          </motion.div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className={`${card} flex items-center justify-center gap-3 py-20 text-sm text-slate-400`}>
            <RefreshCw size={15} className="animate-spin text-teal-500" />
            Chargement du tableau de bord…
          </div>
        ) : (
          <>
            {/* ── KPI Row ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <KpiCard delay={0}    icon={<Boxes size={17} />}          iconBg="bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400"    label="Produits actifs"   value={String(totalProducts)}      sub={`${mpCount} MP · ${pfCount} PF`} trend="neutral" />
              <KpiCard delay={0.05} icon={<Package size={17} />}        iconBg="bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400"         label="En stock"          value={String(totalOnHand)}        sub="Unités on hand"    trend="neutral" />
              <KpiCard delay={0.1}  icon={<ArrowUpFromLine size={17} />} iconBg="bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400" label="Réservées"    value={String(totalReserved)}      sub="Commandes clients" trend="neutral" />
              <KpiCard delay={0.15} icon={<ArrowDownToLine size={17} />} iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" label="Disponibles" value={String(totalAvailable)}   sub="Prêt à expédier"   trend={totalAvailable > totalReserved ? "up" : "down"} />
              <KpiCard delay={0.2}  icon={<AlertTriangle size={17} />}  iconBg={openAlerts.length > 0 ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"} label="Alertes ouvertes" value={String(openAlerts.length)} sub={`${criticalAlerts.length} critique${criticalAlerts.length !== 1 ? "s" : ""}`} trend={openAlerts.length > 0 ? "down" : "up"} />
            </div>

            {/* ── Stock availability bar ───────────────────────────────── */}
            <div className={`${card} px-6 py-4`}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Répartition du stock</p>
                <p className="text-xs text-slate-400">{totalOnHand} unités au total</p>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${availRatio}%` }} title={`Disponible ${availRatio}%`} />
                <div className="h-full bg-violet-400 transition-all" style={{ width: `${reserveRatio}%` }} title={`Réservé ${reserveRatio}%`} />
              </div>
              <div className="mt-2 flex gap-4">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />Disponible {availRatio}%</span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2 w-2 rounded-full bg-violet-400" />Réservé {reserveRatio}%</span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />Autre {Math.max(0, 100 - availRatio - reserveRatio)}%</span>
              </div>
            </div>

            {/* ── Charts row ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

              {/* Movement chart */}
              <div className={`${card} p-6 xl:col-span-2`}>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                      <BarChart3 size={15} className="text-teal-500" /> Flux de stock — 6 mois
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">Entrées et sorties par mois</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500" />Entrées</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />Sorties</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={movementChartData} barGap={4} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                    <Bar dataKey="entry" fill={CHART_COLORS.entry} radius={[5, 5, 0, 0]} />
                    <Bar dataKey="exit"  fill={CHART_COLORS.exit}  radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Alerts panel */}
              <div className={`${card} flex flex-col p-5`}>
                <div className="mb-4 flex items-center justify-between">
                  <p className="flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                    <ShieldAlert size={14} className="text-rose-500" /> Alertes actives
                  </p>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${openAlerts.length > 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                    {openAlerts.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {openAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <CheckCircle2 size={28} className="text-emerald-400" />
                      <p className="mt-2 text-sm font-medium text-slate-400">Aucune alerte</p>
                    </div>
                  ) : openAlerts.slice(0, 6).map((a) => (
                    <div key={a._id} className={`rounded-xl border p-3 ${alertBadge(a.type)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold leading-snug">{a.productId?.name ?? "Produit"}</p>
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-current/20">
                          {a.type === "OUT_OF_STOCK" ? "RUPTURE" : a.type === "LOW_STOCK" ? "BAS" : "RISQUE"}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-2 text-[11px] opacity-75">
                        <span>Qté: {a.currentQuantity}</span>
                        {a.thresholdQuantity != null && <span>Min: {a.thresholdQuantity}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Bottom row ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

              {/* Donut + legend */}
              <div className={`${card} p-5`}>
                <p className="mb-1 flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                  <Layers size={14} className="text-teal-500" /> Types de produits
                </p>
                <p className="mb-4 text-xs text-slate-400">{totalProducts} produits actifs</p>
                {pieData.every((d) => d.value === 0) ? (
                  <div className="flex items-center justify-center py-12 text-sm text-slate-400">Aucun produit</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} />
                        <Pie data={pieData} dataKey="value" nameKey="label"
                          innerRadius={46} outerRadius={70} paddingAngle={3} stroke="none">
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                      {pieData.map((d) => (
                        <div key={d.key} className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                          <span className="truncate text-[11px] text-slate-600 dark:text-slate-400">{d.label}</span>
                          <span className="ml-auto text-[11px] font-bold text-slate-800 dark:text-slate-200">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Top stock items */}
              <div className={`${card} p-5`}>
                <p className="mb-1 flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                  <Package size={14} className="text-sky-500" /> Top stock
                </p>
                <p className="mb-4 text-xs text-slate-400">Articles avec le plus de stock</p>
                <div className="space-y-2">
                  {topItems.length === 0
                    ? <p className="py-6 text-center text-xs text-slate-400">Aucun article</p>
                    : topItems.map((item) => {
                        const max = topItems[0]?.quantityOnHand || 1;
                        const pct = Math.round((item.quantityOnHand / max) * 100);
                        return (
                          <div key={item._id}>
                            <div className="flex items-center justify-between">
                              <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300" style={{ maxWidth: "65%" }}>
                                {item.productId?.name ?? "—"}
                              </p>
                              <span className="text-xs font-bold tabular-nums text-slate-800 dark:text-slate-200">{item.quantityOnHand}</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                </div>
              </div>

              {/* Recent movements */}
              <div className={`${card} p-5`}>
                <p className="mb-1 flex items-center gap-2 font-semibold text-slate-950 dark:text-white">
                  <Activity size={14} className="text-violet-500" /> Derniers mouvements
                </p>
                <p className="mb-4 text-xs text-slate-400">{movementsThisMonth} ce mois</p>
                <div className="space-y-2.5">
                  {recentMovements.length === 0
                    ? <p className="py-6 text-center text-xs text-slate-400">Aucun mouvement</p>
                    : recentMovements.map((m) => (
                        <div key={m._id} className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${m.type === "ENTRY" ? "bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400" : "bg-rose-50 text-rose-500 dark:bg-rose-950/30 dark:text-rose-400"}`}>
                            {m.type === "ENTRY" ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">{m.productId?.name ?? "—"}</p>
                            <p className="text-[10px] text-slate-400">{fmtTime(m.createdAt)}</p>
                          </div>
                          <span className={`text-xs font-bold tabular-nums ${m.type === "ENTRY" ? "text-teal-600 dark:text-teal-400" : "text-rose-500 dark:text-rose-400"}`}>
                            {m.type === "ENTRY" ? "+" : "-"}{m.quantity}
                          </span>
                        </div>
                      ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
