"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { salesOrderService, SalesOrder } from "@/services/commercial/salesOrderService";
import { customerService } from "@/services/commercial/customerService";
import type { Customer } from "@/services/commercial/customerService";
import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart, Package, Truck, FileText,
  Users, AlertTriangle, Loader2, CheckCircle2,
  TrendingUp, Clock, XCircle, Zap, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function orderValue(order: SalesOrder): number {
  return order.lines.reduce((sum, line) => {
    const disc = Math.min(100, Math.max(0, line.discount || 0));
    return sum + line.quantity * line.unitPrice * (1 - disc / 100);
  }, 0);
}

function statusColor(status: string) {
  const map: Record<string, { bar: string; badge: string; text: string }> = {
    DRAFT:        { bar: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",         text: "text-slate-600" },
    ORDONNANCED:  { bar: "bg-orange-400",  badge: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",    text: "text-orange-600" },
    CONFIRMED:    { bar: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",            text: "text-blue-600" },
    PREPARED:     { bar: "bg-violet-500",  badge: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",    text: "text-violet-600" },
    SHIPPED:      { bar: "bg-sky-500",     badge: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",                text: "text-sky-600" },
    DELIVERED:    { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",text: "text-emerald-600" },
    RETURNED:     { bar: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",        text: "text-amber-600" },
    CLOSED:       { bar: "bg-teal-500",    badge: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",            text: "text-teal-600" },
    CANCELLED:    { bar: "bg-rose-400",    badge: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",            text: "text-rose-600" },
  };
  return map[status] ?? { bar: "bg-slate-300", badge: "bg-slate-100 text-slate-500", text: "text-slate-500" };
}

const PIPELINE_STATUSES = ["DRAFT", "ORDONNANCED", "CONFIRMED", "PREPARED", "SHIPPED", "DELIVERED"];
const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function CommercialDashboardPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [ordersData, customersData] = await Promise.all([
          salesOrderService.getAll(),
          customerService.getAll().catch(() => [] as Customer[]),
        ]);
        setOrders(ordersData);
        setCustomers(customersData);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = (o: SalesOrder) => {
      const d = new Date(o.createdAt || "");
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    const active = orders.filter((o) => ["DRAFT", "ORDONNANCED", "CONFIRMED", "PREPARED", "SHIPPED"].includes(o.status));
    const late = orders.filter(
      (o) => o.promisedDate &&
        ["DRAFT", "ORDONNANCED", "CONFIRMED", "PREPARED", "SHIPPED"].includes(o.status) &&
        new Date(o.promisedDate) < now
    );
    const urgent = orders.filter((o) => o.isUrgent && !["DELIVERED", "CANCELLED", "CLOSED"].includes(o.status));
    const revenue = orders
      .filter((o) => !["CANCELLED", "RETURNED"].includes(o.status))
      .reduce((sum, o) => sum + orderValue(o), 0);
    const revenueThisMonth = orders
      .filter((o) => thisMonth(o) && !["CANCELLED", "RETURNED"].includes(o.status))
      .reduce((sum, o) => sum + orderValue(o), 0);

    const byStatus: Record<string, number> = {};
    for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

    // Monthly orders — last 6 months
    const monthlyMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyMap[key] = 0;
    }
    for (const o of orders) {
      const d = new Date(o.createdAt || "");
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in monthlyMap) monthlyMap[key]++;
    }
    const monthlyChart = Object.entries(monthlyMap).map(([key, count]) => {
      const [year, month] = key.split("-").map(Number);
      return { month: MONTHS_FR[month], count, year };
    });

    // Top customers by order count
    const custMap: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const o of orders.filter((o) => !["CANCELLED"].includes(o.status))) {
      const name = o.customerName;
      if (!custMap[name]) custMap[name] = { name, count: 0, revenue: 0 };
      custMap[name].count++;
      custMap[name].revenue += orderValue(o);
    }
    const topCustomers = Object.values(custMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    return {
      total: orders.length,
      active: active.length,
      late: late.length,
      urgent: urgent.length,
      delivered: byStatus["DELIVERED"] || 0,
      deliveredThisMonth: orders.filter((o) => o.status === "DELIVERED" && thisMonth(o)).length,
      cancelled: byStatus["CANCELLED"] || 0,
      prepared: byStatus["PREPARED"] || 0,
      shipped: byStatus["SHIPPED"] || 0,
      revenue,
      revenueThisMonth,
      byStatus,
      monthlyChart,
      topCustomers,
      lateOrders: late.slice(0, 5),
      urgentOrders: urgent.slice(0, 5),
      recentOrders: [...orders].sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime()).slice(0, 8),
    };
  }, [orders]);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Commercial · ERP
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <ShoppingCart size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                Tableau de bord commercial
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Vue d'ensemble des commandes, clients et performance commerciale
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-20 text-sm text-slate-500`}>
            <Loader2 size={16} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Total commandes", value: stats.total, icon: FileText, bg: "bg-slate-100 dark:bg-slate-800", color: "text-slate-600 dark:text-slate-300" },
                { label: "En cours", value: stats.active, icon: Zap, bg: "bg-blue-50 dark:bg-blue-950/30", color: "text-blue-600 dark:text-blue-400" },
                { label: "Préparées", value: stats.prepared, icon: Package, bg: "bg-violet-50 dark:bg-violet-950/30", color: "text-violet-600 dark:text-violet-400" },
                { label: "Expédiées", value: stats.shipped, icon: Truck, bg: "bg-sky-50 dark:bg-sky-950/30", color: "text-sky-600 dark:text-sky-400" },
                { label: "Livrées (total)", value: stats.delivered, icon: CheckCircle2, bg: "bg-emerald-50 dark:bg-emerald-950/30", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "En retard", value: stats.late, icon: Clock, bg: "bg-rose-50 dark:bg-rose-950/30", color: "text-rose-600 dark:text-rose-400" },
                { label: "Urgentes", value: stats.urgent, icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-950/30", color: "text-amber-600 dark:text-amber-400" },
                { label: "Clients", value: customers.length, icon: Users, bg: "bg-indigo-50 dark:bg-indigo-950/30", color: "text-indigo-600 dark:text-indigo-400" },
              ].map((kpi) => (
                <div key={kpi.label} className={`${surface} flex items-center gap-4 px-5 py-5`}>
                  <div className={`rounded-2xl p-3 ${kpi.bg}`}>
                    <kpi.icon size={17} className={kpi.color} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      {kpi.label}
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                      {kpi.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Revenue banner */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className={`${surface} px-6 py-5`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Chiffre d'affaires total</p>
                <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
                  {stats.revenue.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}
                  <span className="ml-2 text-base font-medium text-slate-400">TND</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">Commandes non annulées / non retournées</p>
              </div>
              <div className={`${surface} px-6 py-5`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Chiffre d'affaires ce mois</p>
                <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.revenueThisMonth.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}
                  <span className="ml-2 text-base font-medium text-slate-400">TND</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">{stats.deliveredThisMonth} commandes livrées ce mois</p>
              </div>
            </div>

            {/* Action required */}
            {(stats.late > 0 || stats.urgent > 0) && (
              <div className={`${surface} overflow-hidden`}>
                <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                  <h2 className="font-semibold text-slate-950 dark:text-white flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-500" />
                    Actions requises
                  </h2>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.lateOrders.map((o) => (
                    <div key={o._id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{o.orderNo}</p>
                        <p className="text-xs text-slate-500">{o.customerName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                          Retard · {o.promisedDate ? new Date(o.promisedDate).toLocaleDateString("fr-TN") : "—"}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusColor(o.status).badge}`}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {stats.urgentOrders.map((o) => (
                    <div key={`u-${o._id}`} className="flex items-center justify-between px-6 py-3 bg-amber-50/50 dark:bg-amber-950/10">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{o.orderNo}</p>
                        <p className="text-xs text-slate-500">{o.customerName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Urgent</span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusColor(o.status).badge}`}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chart + Pipeline */}
            <div className="grid gap-6 xl:grid-cols-2">
              {/* Monthly chart */}
              <div className={`${surface} p-6`}>
                <h2 className="mb-1 font-semibold text-slate-950 dark:text-white">Commandes par mois</h2>
                <p className="mb-4 text-xs text-slate-400">6 derniers mois</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.monthlyChart} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      cursor={{ fill: "#f1f5f9" }}
                    />
                    <Bar dataKey="count" name="Commandes" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Order pipeline */}
              <div className={`${surface} p-6`}>
                <h2 className="mb-1 font-semibold text-slate-950 dark:text-white">Pipeline des commandes</h2>
                <p className="mb-4 text-xs text-slate-400">Répartition par statut</p>
                <div className="space-y-3">
                  {PIPELINE_STATUSES.map((status) => {
                    const count = stats.byStatus[status] || 0;
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    const c = statusColor(status);
                    return (
                      <div key={status}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{status}</span>
                          <span className="text-slate-400">{count} · {pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-2 rounded-full transition-all ${c.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {stats.byStatus["CANCELLED"] ? (
                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300">CANCELLED</span>
                        <span className="text-slate-400">{stats.byStatus["CANCELLED"]} · {Math.round((stats.byStatus["CANCELLED"] / stats.total) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-2 rounded-full bg-rose-400 transition-all" style={{ width: `${Math.round((stats.byStatus["CANCELLED"] / stats.total) * 100)}%` }} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Recent orders + Top customers */}
            <div className="grid gap-6 xl:grid-cols-3">
              {/* Recent orders */}
              <div className={`${surface} overflow-hidden xl:col-span-2`}>
                <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-950 dark:text-white flex items-center gap-2">
                    <BarChart3 size={15} className="text-slate-400" />
                    Commandes récentes
                  </h2>
                  <span className="text-xs text-slate-400">{stats.recentOrders.length} dernières</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.recentOrders.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
                      <XCircle size={16} className="opacity-40" /> Aucune commande
                    </div>
                  ) : stats.recentOrders.map((o) => {
                    const val = orderValue(o);
                    const c = statusColor(o.status);
                    return (
                      <div key={o._id} className="flex items-center gap-4 px-6 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{o.orderNo}</p>
                            {o.isUrgent && (
                              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">URGENT</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{o.customerName}</p>
                        </div>
                        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {val.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND
                          </p>
                          <p>{o.createdAt ? new Date(o.createdAt).toLocaleDateString("fr-TN") : "—"}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${c.badge}`}>
                          {o.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top customers */}
              <div className={`${surface} overflow-hidden`}>
                <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800 flex items-center gap-2">
                  <Users size={15} className="text-slate-400" />
                  <h2 className="font-semibold text-slate-950 dark:text-white">Top clients</h2>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.topCustomers.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-400">Aucun client</div>
                  ) : stats.topCustomers.map((c, idx) => (
                    <div key={c.name} className="flex items-center gap-3 px-6 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 dark:bg-slate-800">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{c.name}</p>
                        <p className="text-xs text-slate-400">{c.count} commande{c.count > 1 ? "s" : ""}</p>
                      </div>
                      <p className="shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {c.revenue.toLocaleString("fr-TN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} TND
                      </p>
                    </div>
                  ))}
                </div>

                {/* Summary stats */}
                <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Clients actifs</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{customers.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Annulées</span>
                    <span className="font-semibold text-rose-600">{stats.cancelled}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Taux livraison</span>
                    <span className="font-semibold text-emerald-600">
                      {stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
