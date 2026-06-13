"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { purchaseOrderService, PurchaseOrder } from "@/services/purchase/purchaseOrderService";
import { purchaseRequestService } from "@/services/purchase/purchaseRequestService";
import { purchaseInvoiceService, PurchaseInvoice } from "@/services/purchase/purchaseInvoiceService";
import { supplierService, Supplier } from "@/services/purchase/supplierService";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Receipt,
  ShoppingCart,
  Star,
  TrendingUp,
  XCircle,
} from "lucide-react";

interface PurchaseRequest {
  _id: string;
  requestNo: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  priority: "LOW" | "NORMAL" | "URGENT";
  department?: string;
  createdAt: string;
  productId?: { _id: string; name: string; sku: string };
}

function fmt(n: number) {
  return n.toLocaleString("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toFixed(0);
}

const STATUS_ORDER_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  DRAFT:     { label: "Brouillon",  color: "text-slate-600",  bg: "bg-slate-200",  dot: "bg-slate-400" },
  VALIDATED: { label: "Validé",     color: "text-blue-700",   bg: "bg-blue-200",   dot: "bg-blue-500" },
  SENT:      { label: "Envoyé",     color: "text-amber-700",  bg: "bg-amber-200",  dot: "bg-amber-500" },
  RECEIVED:  { label: "Reçu",       color: "text-emerald-700",bg: "bg-emerald-200",dot: "bg-emerald-500" },
  CLOSED:    { label: "Clôturé",    color: "text-teal-700",   bg: "bg-teal-200",   dot: "bg-teal-500" },
  CANCELLED: { label: "Annulé",     color: "text-rose-700",   bg: "bg-rose-200",   dot: "bg-rose-500" },
};

const STATUS_INV_CFG: Record<string, { label: string; cls: string }> = {
  PENDING_APPROVAL: { label: "En attente",     cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  APPROVED:         { label: "Approuvée",       cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  REJECTED:         { label: "Rejetée",         cls: "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400" },
  PARTIALLY_PAID:   { label: "Part. payée",     cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  PAID:             { label: "Payée",           cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
      </div>
      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-7 w-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          {sub && <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
      )}
    </div>
  );
}

function AlertCard({
  icon: Icon,
  count,
  label,
  sub,
  href,
  cta,
  scheme,
}: {
  icon: React.ElementType;
  count: number;
  label: string;
  sub: string;
  href: string;
  cta: string;
  scheme: "amber" | "blue" | "rose" | "emerald";
}) {
  const schemes = {
    amber:   { wrap: "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20", icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400", badge: "bg-amber-500", btn: "bg-amber-600 hover:bg-amber-700" },
    blue:    { wrap: "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/20",     icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",     badge: "bg-blue-500",   btn: "bg-blue-600 hover:bg-blue-700" },
    rose:    { wrap: "border-rose-200 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-950/20",     icon: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400",     badge: "bg-rose-500",   btn: "bg-rose-600 hover:bg-rose-700" },
    emerald: { wrap: "border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400", badge: "bg-emerald-500", btn: "bg-emerald-600 hover:bg-emerald-700" },
  };
  const s = schemes[scheme];
  return (
    <div className={`rounded-3xl border p-5 ${s.wrap}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${s.icon}`}>
          <Icon size={16} />
        </div>
        <span className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-xl px-2 text-sm font-bold text-white ${s.badge}`}>
          {count}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      <Link
        href={href}
        className={`mt-4 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition ${s.btn}`}
      >
        {cta}
        <ArrowRight size={11} />
      </Link>
    </div>
  );
}


export default function PurchaseDashboardPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [ords, reqs, invs, sups] = await Promise.all([
          purchaseOrderService.getAll(),
          purchaseRequestService.getAll(),
          purchaseInvoiceService.getAll(),
          supplierService.getAll(),
        ]);
        setOrders(ords);
        setRequests(reqs as PurchaseRequest[]);
        setInvoices(invs);
        setSuppliers(sups);
      } catch {
        setError("Impossible de charger les données du tableau de bord.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = new Date();

  const stats = useMemo(() => {
    const totalSpend = orders
      .filter((o) => o.status === "RECEIVED" || o.status === "CLOSED")
      .reduce((s, o) => s + o.totalTtc, 0);

    const openOrders = orders.filter((o) => ["DRAFT", "VALIDATED", "SENT"].includes(o.status));
    const openOrdersValue = openOrders.reduce((s, o) => s + o.totalTtc, 0);

    const unpaidInvoices = invoices.filter((i) => i.status !== "PAID" && i.status !== "REJECTED");
    const unpaidValue = unpaidInvoices.reduce((s, i) => s + Math.max(0, i.totalTtc - i.amountPaid), 0);

    const overdueInvoices = invoices.filter(
      (i) => new Date(i.dueDate) < today && i.status !== "PAID" && i.status !== "REJECTED"
    );

    const activeSuppliers = suppliers.filter((s) => !s.isBlocked);
    const blockedSuppliers = suppliers.filter((s) => s.isBlocked);

    const submittedRequests = requests.filter((r) => r.status === "SUBMITTED");
    const draftOrders = orders.filter((o) => o.status === "DRAFT");

    const orderStatusBreakdown = Object.keys(STATUS_ORDER_CFG).map((st) => ({
      status: st,
      ...STATUS_ORDER_CFG[st],
      count: orders.filter((o) => o.status === st).length,
    }));
    const maxStatusCount = Math.max(...orderStatusBreakdown.map((s) => s.count), 1);

    const topSuppliers = (() => {
      const map = new Map<string, { name: string; supplierNo: string; total: number; count: number; rating: number }>();
      orders.forEach((o) => {
        const key = o.supplierId._id;
        const existing = map.get(key) ?? { name: o.supplierId.name, supplierNo: o.supplierId.supplierNo, total: 0, count: 0, rating: 0 };
        existing.total += o.totalTtc;
        existing.count += 1;
        map.set(key, existing);
      });
      suppliers.forEach((s) => {
        const e = map.get(s._id);
        if (e) e.rating = s.rating;
      });
      return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
    })();

    const monthlySpend = (() => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const label = d.toLocaleDateString("fr-TN", { month: "short" });
        const value = orders
          .filter((o) => {
            if (o.status !== "RECEIVED" && o.status !== "CLOSED") return false;
            const od = new Date(o.createdAt);
            return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
          })
          .reduce((s, o) => s + o.totalTtc, 0);
        months.push({ label, value });
      }
      return months;
    })();

    const recentOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
    const recentInvoices = [...invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

    return {
      totalSpend, openOrders, openOrdersValue, unpaidInvoices, unpaidValue,
      overdueInvoices, activeSuppliers, blockedSuppliers,
      submittedRequests, draftOrders,
      orderStatusBreakdown, maxStatusCount,
      topSuppliers, monthlySpend, recentOrders, recentInvoices,
    };
  }, [orders, requests, invoices, suppliers]);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Module Achat · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30">
                <ShoppingCart size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Tableau de bord Achat
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Vue globale — commandes, factures, fournisseurs et dépenses
                </p>
              </div>
            </div>
          </div>
          {!loading && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Mis à jour à {new Date().toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            icon={TrendingUp}
            label="Dépenses totales TTC"
            value={loading ? "—" : `${fmtShort(stats.totalSpend)} TND`}
            sub={loading ? undefined : `${orders.filter(o => o.status === "RECEIVED" || o.status === "CLOSED").length} commandes réceptionnées`}
            iconBg="bg-blue-50 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
            loading={loading}
          />
          <StatCard
            icon={FileText}
            label="Commandes en cours"
            value={loading ? "—" : `${stats.openOrders.length}`}
            sub={loading ? undefined : `Valeur : ${fmtShort(stats.openOrdersValue)} TND`}
            iconBg="bg-amber-50 dark:bg-amber-900/30"
            iconColor="text-amber-600 dark:text-amber-400"
            loading={loading}
          />
          <StatCard
            icon={Receipt}
            label="Factures à régler"
            value={loading ? "—" : `${fmtShort(stats.unpaidValue)} TND`}
            sub={loading ? undefined : `${stats.unpaidInvoices.length} facture(s) — dont ${stats.overdueInvoices.length} en retard`}
            iconBg="bg-rose-50 dark:bg-rose-900/30"
            iconColor="text-rose-600 dark:text-rose-400"
            loading={loading}
          />
          <StatCard
            icon={Building2}
            label="Fournisseurs actifs"
            value={loading ? "—" : `${stats.activeSuppliers.length}`}
            sub={loading ? undefined : `${stats.blockedSuppliers.length} bloqué(s) sur ${suppliers.length} au total`}
            iconBg="bg-emerald-50 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
            loading={loading}
          />
        </div>

        {/* ── Attention Required ───────────────────────────────────────────── */}
        {!loading && (stats.submittedRequests.length > 0 || stats.draftOrders.length > 0 || stats.overdueInvoices.length > 0) && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Action requise
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {stats.submittedRequests.length > 0 && (
                <AlertCard
                  icon={Clock}
                  count={stats.submittedRequests.length}
                  label="Demandes en attente d'approbation"
                  sub="Des DA soumises attendent votre validation."
                  href="/dashboard/achat/requests"
                  cta="Voir les demandes"
                  scheme="amber"
                />
              )}
              {stats.draftOrders.length > 0 && (
                <AlertCard
                  icon={FileText}
                  count={stats.draftOrders.length}
                  label="Bons de commande à valider"
                  sub="Des BC en brouillon n'ont pas encore été validés."
                  href="/dashboard/achat/orders"
                  cta="Voir les commandes"
                  scheme="blue"
                />
              )}
              {stats.overdueInvoices.length > 0 && (
                <AlertCard
                  icon={AlertTriangle}
                  count={stats.overdueInvoices.length}
                  label="Factures en retard de paiement"
                  sub="La date d'échéance de ces factures est dépassée."
                  href="/dashboard/achat/invoices"
                  cta="Voir les factures"
                  scheme="rose"
                />
              )}
            </div>
          </div>
        )}

        {/* ── Charts Row ───────────────────────────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-3">

          {/* Monthly spend bar chart */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">Dépenses mensuelles</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Commandes réceptionnées / clôturées — 6 derniers mois (TND TTC)</p>
              </div>
              <BarChart3 size={16} className="text-slate-400" />
            </div>
            {loading ? (
              <div className="flex h-44 items-center justify-center gap-2 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                Chargement…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.monthlySpend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                  <Tooltip
                    formatter={(v: number) => [`${fmt(v)} TND`, "Dépenses TTC"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    cursor={{ fill: "#f1f5f9" }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Order status breakdown */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">Statuts BC</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{orders.length} bons de commande au total</p>
              </div>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {stats.orderStatusBreakdown.map((s) => (
                  <div key={s.status}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{s.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{s.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${s.bg} transition-all duration-700`}
                        style={{ width: `${(s.count / stats.maxStatusCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Data Row ─────────────────────────────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-2">

          {/* Recent orders */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">Dernières commandes</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">6 bons de commande les plus récents</p>
              </div>
              <Link href="/dashboard/achat/orders" className="flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400">
                Tous <ArrowRight size={11} />
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin" />
              </div>
            ) : !stats.recentOrders.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <CheckCircle2 size={24} className="text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-400">Aucune commande</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {stats.recentOrders.map((o) => {
                  const cfg = STATUS_ORDER_CFG[o.status];
                  return (
                    <div key={o._id} className="flex items-center justify-between px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{o.orderNo}</span>
                          <span className={`rounded-lg px-1.5 py-0.5 text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{o.supplierId.name}</p>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{fmtShort(o.totalTtc)} TND</p>
                        <p className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleDateString("fr-TN")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top suppliers + recent invoices */}
          <div className="flex flex-col gap-6">

            {/* Top suppliers */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">Top fournisseurs</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Par volume de commandes TTC</p>
                </div>
                <Link href="/dashboard/achat/suppliers" className="flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400">
                  Tous <ArrowRight size={11} />
                </Link>
              </div>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                </div>
              ) : !stats.topSuppliers.length ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10">
                  <Building2 size={24} className="text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-400">Aucune donnée</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
                  {stats.topSuppliers.map((s, i) => (
                    <div key={s.supplierNo} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{s.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-slate-400">{s.count} commande{s.count > 1 ? "s" : ""}</p>
                          {s.rating > 0 && (
                            <div className="flex items-center gap-0.5">
                              <Star size={9} className="fill-amber-400 text-amber-400" />
                              <span className="text-[10px] text-slate-400">{s.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">{fmtShort(s.total)} TND</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent invoices */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">Factures récentes</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">5 dernières factures enregistrées</p>
                </div>
                <Link href="/dashboard/achat/invoices" className="flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400">
                  Toutes <ArrowRight size={11} />
                </Link>
              </div>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                </div>
              ) : !stats.recentInvoices.length ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <Receipt size={24} className="text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-400">Aucune facture</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
                  {stats.recentInvoices.map((inv) => {
                    const cfg = STATUS_INV_CFG[inv.status];
                    const isOverdue = new Date(inv.dueDate) < today && inv.status !== "PAID";
                    return (
                      <div key={inv._id} className="flex items-center justify-between px-5 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{inv.invoiceNo}</span>
                            <span className={`rounded-lg px-1.5 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>{cfg.label}</span>
                            {isOverdue && <XCircle size={11} className="text-rose-500" />}
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-slate-400">{inv.supplierId.name}</p>
                        </div>
                        <p className="ml-3 shrink-0 text-sm font-semibold text-slate-900 dark:text-white">{fmtShort(inv.totalTtc)} TND</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </ProtectedRoute>
  );
}
