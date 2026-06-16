"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { salesOrderService } from "@/services/commercial/salesOrderService";
import { stockProductService } from "@/services/stock/stockProductService";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Loader2,
  X,
  Search,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  ChevronDown,
  Clock,
  ExternalLink,
  RotateCcw,
  Zap,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { backorderService } from "@/services/commercial/backorderService";
import { rmaService } from "@/services/commercial/rmaService";
import { customerService, type Customer } from "@/services/commercial/customerService";

interface Product {
  _id: string;
  sku: string;
  name: string;
  type: string;
  status: "ACTIVE" | "INACTIVE";
  salePrice?: number;
}

interface OrderLine {
  productId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
}

const EMPTY_ORDER_LINE: OrderLine = {
  productId: "",
  quantity: "",
  unitPrice: "",
  discount: "",
};

const DEFAULT_TVA    = 19;
const DEFAULT_FODEC  = 1;
const DEFAULT_TIMBRE = 1;
const TAX_MULT       = 1 + DEFAULT_TVA / 100 + DEFAULT_FODEC / 100; // 1.20

function r3(n: number) { return Math.round(n * 1000) / 1000; }

function computeBreakdown(lines: OrderLine[], mode: "HT_BASED" | "TTC_BASED") {
  let subtotalHt = 0;
  for (const l of lines) {
    const qty      = Number(l.quantity)  || 0;
    const price    = Number(l.unitPrice) || 0;
    const discount = Number(l.discount)  || 0;
    if (qty <= 0 || price <= 0) continue;
    const htPrice  = mode === "TTC_BASED" ? price / TAX_MULT : price;
    subtotalHt    += qty * htPrice * (1 - discount / 100);
  }
  const totalTva    = r3(subtotalHt * DEFAULT_TVA   / 100);
  const totalFodec  = r3(subtotalHt * DEFAULT_FODEC / 100);
  const avantTimbre = r3(subtotalHt + totalTva + totalFodec);
  return {
    subtotalHt:   r3(subtotalHt),
    totalTva,
    totalFodec,
    avantTimbre,
    timbre:       DEFAULT_TIMBRE,
    totalTtc:     r3(avantTimbre + DEFAULT_TIMBRE),
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function suggestedPromiseDate(lines: OrderLine[]) {
  const totalQuantity = lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0),
    0
  );

  if (totalQuantity <= 10) return addDays(new Date(), 2);
  if (totalQuantity <= 50) return addDays(new Date(), 4);
  return addDays(new Date(), 7);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

interface ShipApproval {
  status: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
}

interface Order {
  _id: string;
  orderNo: string;
  customerName: string;
  splitFromOrderId?: string | { _id: string; orderNo?: string } | null;
  source?: "MANUAL" | "RECURRING";
  status: "DRAFT" | "ORDONNANCED" | "CONFIRMED" | "PREPARED" | "SHIPPED" | "DELIVERED" | "RETURNED" | "CLOSED" | "CANCELLED";
  plannedStartDate?: string;
  plannedEndDate?: string;
  ordonnancedAt?: string;
  preparedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  trackingNumber?: string;
  promisedDate?: string;
  notes?: string;
  createdAt?: string;
  isUrgent?: boolean;
  shipApproval?: ShipApproval;
  vehicleId?: { _id: string; matricule: string } | null;
  lines: {
    productId: Product;
    quantity: number;
    unitPrice: number;
    discount?: number;
    allocatedQuantity?: number;
    plannedProductionQuantity?: number;
  }[];
}

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    ORDONNANCED: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    CONFIRMED: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    PREPARED: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    SHIPPED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    DELIVERED: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    RETURNED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    CLOSED: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    CANCELLED: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return map[status] ?? "bg-slate-100 text-slate-600";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "ORDONNANCED") return <Clock size={12} className="text-amber-500" />;
  if (status === "CONFIRMED") return <CheckCircle size={12} className="text-blue-500" />;
  if (status === "PREPARED") return <Package size={12} className="text-violet-500" />;
  if (status === "SHIPPED") return <Truck size={12} className="text-emerald-500" />;
  if (status === "DELIVERED") return <CheckCircle size={12} className="text-teal-500" />;
  if (status === "RETURNED") return <RotateCcw size={12} className="text-rose-500" />;
  if (status === "CANCELLED") return <XCircle size={12} className="text-rose-500" />;
  return <Package size={12} className="text-slate-400" />;
}

const ACTIVE_STATUSES = ["DRAFT", "ORDONNANCED", "CONFIRMED", "PREPARED", "SHIPPED"];

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: { data?: unknown } }).response !== null
  ) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === "string") {
      return response.data.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function lineAmount(line: { quantity: number; unitPrice: number; discount?: number }) {
  const subtotal = line.quantity * line.unitPrice;
  const discountPct = Math.min(100, Math.max(0, line.discount || 0));
  return subtotal * (1 - discountPct / 100);
}

function isLate(order: Order): boolean {
  if (!order.promisedDate) return false;
  if (!ACTIVE_STATUSES.includes(order.status)) return false;
  return new Date(order.promisedDate) < new Date();
}

function hasPlanningRisk(order: Order): boolean {
  if (!order.promisedDate || !order.plannedEndDate) return false;
  return new Date(order.plannedEndDate) > new Date(order.promisedDate);
}

export default function CommercialOrdersPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const isManager = user?.role === "ADMIN" || user?.role === "COMMERCIAL_MANAGER";

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [backorderedIds, setBackorderedIds] = useState<Set<string>>(new Set());
  const [closedReturnOrderIds, setClosedReturnOrderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRetryCountRef = useRef(0);

  const [form, setForm] = useState({
    customerId: "",
    promisedDate: toDateInputValue(suggestedPromiseDate([EMPTY_ORDER_LINE])),
    pricingMode: "HT_BASED" as "HT_BASED" | "TTC_BASED",
  });
  const [lines, setLines] = useState<OrderLine[]>([EMPTY_ORDER_LINE]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setForm((prev) => {
      if (prev.promisedDate) return prev;
      return {
        ...prev,
        promisedDate: toDateInputValue(suggestedPromiseDate(lines)),
      };
    });
  }, [lines]);

  useEffect(() => {
    fetchAll();
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [productResult, orderResult, backorderResult, customerResult, rmaResult] = await Promise.allSettled([
        stockProductService.getAll(),
        salesOrderService.getAll(),
        backorderService.getAll(),
        customerService.getActive(),
        rmaService.getAll(),
      ]);

      if (orderResult.status !== "fulfilled") {
        throw orderResult.reason;
      }

      const productData =
        productResult.status === "fulfilled" && Array.isArray(productResult.value)
          ? productResult.value
          : [];
      const backorderData =
        backorderResult.status === "fulfilled" && Array.isArray(backorderResult.value)
          ? backorderResult.value
          : [];
      const customerData =
        customerResult.status === "fulfilled" && Array.isArray(customerResult.value)
          ? customerResult.value
          : [];
      const rmaData =
        rmaResult.status === "fulfilled" && Array.isArray(rmaResult.value)
          ? rmaResult.value
          : [];
      const orderData = Array.isArray(orderResult.value) ? orderResult.value : [];

      setProducts(
        productData.filter((p: Product) => p.status === "ACTIVE" && p.type === "PRODUIT_FINI")
      );
      setOrders(orderData);
      setBackorderedIds(
        new Set(
          backorderData
            .filter((b) => b?.status === "PENDING")
            .map((b) => String(b.salesOrderId?._id || b.salesOrderId))
        )
      );
      setCustomers(customerData);
      setClosedReturnOrderIds(
        new Set(
          Array.from(
            rmaData.reduce<Map<string, string[]>>((map, rma) => {
              const orderId = String(rma.salesOrderId?._id || "");
              if (!orderId) return map;
              const existing = map.get(orderId) || [];
              existing.push(rma.status);
              map.set(orderId, existing);
              return map;
            }, new Map())
          )
            .filter(([, statuses]) => statuses.length > 0 && statuses.every((status) => status === "CLOSED"))
            .map(([orderId]) => orderId)
        )
      );
      fetchRetryCountRef.current = 0;
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to load orders"));
      if (fetchRetryCountRef.current < 2) {
        fetchRetryCountRef.current += 1;
        retryTimeoutRef.current = setTimeout(() => {
          fetchAll();
        }, 1200);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateLine = (index: number, key: keyof OrderLine, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { ...EMPTY_ORDER_LINE }]);
  };

  const handleCreate = async () => {
    if (!form.customerId) {
      setError("Please select a customer");
      return;
    }
    const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      setError("At least one valid line is required");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await salesOrderService.create({
        customerId: form.customerId,
        promisedDate: form.promisedDate ? new Date(form.promisedDate).toISOString() : undefined,
        pricingMode: form.pricingMode,
        lines: validLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice) || 0,
          discount: Number(l.discount) || 0,
        })),
      });
      setForm({
        customerId: "",
        promisedDate: toDateInputValue(suggestedPromiseDate([EMPTY_ORDER_LINE])),
        pricingMode: "HT_BASED",
      });
      setLines([{ ...EMPTY_ORDER_LINE }]);
      setShowForm(false);
      await fetchAll();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to create order"));
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (
    action: "confirm" | "prepare" | "cancel" | "deliver" | "markReturned" | "reorder" | "markUrgent" | "unmarkUrgent",
    id: string
  ) => {
    try {
      setActionId(id);
      setError("");

      if (action === "confirm") await salesOrderService.confirm(id);
      if (action === "prepare") await salesOrderService.prepare(id);
      if (action === "cancel") await salesOrderService.cancel(id);
      if (action === "deliver") await salesOrderService.deliver(id);
      if (action === "markReturned") await salesOrderService.markReturned(id);
      if (action === "reorder") await salesOrderService.reorder(id);
      if (action === "markUrgent") await salesOrderService.markUrgent(id, true);
      if (action === "unmarkUrgent") await salesOrderService.markUrgent(id, false);

      await fetchAll();
    } catch (error: unknown) {
      setError(getErrorMessage(error, `Failed to ${action} order`));
    } finally {
      setActionId(null);
    }
  };

  const orderTotal = (order: Order) =>
    order.lines.reduce((sum, l) => sum + lineAmount(l), 0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        o.orderNo.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "LATE" ? isLate(o) : o.status === statusFilter);
      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  // KPI counts
  const kpis = useMemo(() => ({
    total: orders.length,
    draft: orders.filter((o) => o.status === "DRAFT").length,
    confirmed: orders.filter((o) => o.status === "CONFIRMED").length,
    prepared: orders.filter((o) => o.status === "PREPARED").length,
    shipped: orders.filter((o) => o.status === "SHIPPED").length,
    late: orders.filter(isLate).length,
  }), [orders]);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("commercialModule")} · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <ShoppingCart size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {t("commercialOrdersTitle")}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("commercialOrdersSubtitle")}
                </p>
              </div>
            </div>
          </div>
          {isManager && (
            <button
              onClick={() => { setShowForm((v) => !v); setError(""); }}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <Plus size={15} /> {t("createSalesOrder")}
            </button>
          )}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 shrink-0 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { label: t("totalOrdersKpi"), value: kpis.total, color: "text-slate-900 dark:text-white" },
            { label: t("draft"), value: kpis.draft, color: "text-slate-600 dark:text-slate-300" },
            { label: t("confirmedOrders"), value: kpis.confirmed, color: "text-blue-700 dark:text-blue-400" },
            { label: t("prepared") || "Prepared", value: kpis.prepared, color: "text-violet-700 dark:text-violet-400" },
            { label: t("lateOrders") || "Late Orders", value: kpis.late, color: kpis.late > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300" },
          ].map((kpi) => (
            <div key={kpi.label} className={`${surface} px-6 py-5`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {kpi.label}
              </p>
              <p className={`mt-2 text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ── Create order form (collapsible) ── */}
        {showForm && (
          <div className={`${surface} p-6`}>
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {t("createSalesOrder")}
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {t("orderNumber")}
                  </p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-white">
                    Order number will be generated automatically
                  </p>
                </div>
              <div>
                <label className={labelClass}>{t("customerName")}</label>
                <select
                  className={inputClass}
                  value={form.customerId}
                  onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                >
                  <option value="">{t("selectCustomer") || "Select customer…"}</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}{c.company ? ` — ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>{t("promisedDateLabel")}</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.promisedDate}
                    onChange={(e) => setForm((f) => ({ ...f, promisedDate: e.target.value }))}
                  />
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
                  Suggested SLA date: {toDateInputValue(suggestedPromiseDate(lines))}
                </div>
              </div>
            </div>

            {/* Pricing mode */}
            <div className="mt-4">
              <label className={labelClass}>Mode de tarification</label>
              <div className="flex gap-2">
                {(["HT_BASED", "TTC_BASED"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, pricingMode: mode }))}
                    className={`flex-1 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                      form.pricingMode === mode
                        ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {mode === "HT_BASED" ? "HT — prix hors taxes" : "TTC — prix toutes taxes comprises"}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                {form.pricingMode === "HT_BASED"
                  ? "Les prix saisis sont hors taxes. TVA et FODEC seront ajoutés."
                  : "Les prix saisis incluent toutes taxes. TVA et FODEC seront déduits."}
              </p>
            </div>

            {/* Lines */}
            <div className="mt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {t("orderLines")}
              </p>
              <div className="mb-1 hidden grid-cols-[1fr_100px_120px_100px_36px] gap-3 md:grid">
                {[
                  "Product",
                  t("quantity") || "Qty",
                  form.pricingMode === "TTC_BASED" ? "Prix TTC (sans timbre)" : "Prix HT",
                  "Remise",
                  "",
                ].map((h, i) => (
                  <span key={i} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{h}</span>
                ))}
              </div>
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_100px_120px_100px_36px]">
                    <select
                      className={inputClass}
                      value={line.productId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const product = products.find((p) => p._id === pid);
                        // Catalogue price is shown as-is in both modes. The pricing
                        // mode only controls whether tax is added (HT) or backed out (TTC).
                        const catalogPrice = product?.salePrice ?? 0;
                        const suggested = catalogPrice > 0 ? String(catalogPrice) : "";
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === index
                              ? { ...l, productId: pid, unitPrice: suggested || l.unitPrice }
                              : l
                          )
                        );
                      }}
                    >
                      <option value="">{t("selectProduct")}</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.sku} · {p.name}{p.salePrice ? ` — ${p.salePrice} TND` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      placeholder={t("quantity")}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, "quantity", e.target.value)}
                    />
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder={form.pricingMode === "TTC_BASED" ? "Prix TTC" : "Prix HT"}
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, "unitPrice", e.target.value)}
                    />
                    <div className="relative">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={line.discount}
                        onChange={(e) => updateLine(index, "discount", e.target.value)}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">%</span>
                    </div>
                    <button
                      onClick={() => removeLine(index)}
                      disabled={lines.length === 1}
                      className="flex h-10 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 dark:border-slate-700 dark:hover:border-rose-900/40 dark:hover:bg-rose-950/20"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addLine}
                className="mt-3 inline-flex items-center gap-1.5 rounded-2xl border border-dashed border-slate-300 px-4 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-300"
              >
                <Plus size={12} /> {t("addLineBtn")}
              </button>

              {/* Live tax breakdown */}
              {(() => {
                const bd = computeBreakdown(lines, form.pricingMode);
                if (bd.subtotalHt === 0) return null;
                const fmtTnd = (v: number) =>
                  v.toLocaleString("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " TND";
                return (
                  <div className="mt-4 flex justify-end">
                    <div className="w-72 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 space-y-1.5">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        Récapitulatif — aperçu
                      </p>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>Sous-total HT</span>
                        <span className="font-medium tabular-nums">{fmtTnd(bd.subtotalHt)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>TVA ({DEFAULT_TVA}%)</span>
                        <span className="tabular-nums">+ {fmtTnd(bd.totalTva)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>FODEC ({DEFAULT_FODEC}%)</span>
                        <span className="tabular-nums">+ {fmtTnd(bd.totalFodec)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-1.5">
                        <span>Avant timbre</span>
                        <span className="tabular-nums">{fmtTnd(bd.avantTimbre)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>Timbre fiscal</span>
                        <span className="tabular-nums">+ {fmtTnd(bd.timbre)}</span>
                      </div>
                      <div className="flex justify-between rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
                        <span>Total TTC</span>
                        <span className="tabular-nums">{fmtTnd(bd.totalTtc)}</span>
                      </div>
                      <p className="pt-1 text-[10px] text-slate-400 dark:text-slate-600">
                        Aperçu basé sur TVA {DEFAULT_TVA}% / FODEC {DEFAULT_FODEC}% / Timbre {DEFAULT_TIMBRE} TND
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowForm(false); setError(""); }}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {t("createOrder")}
              </button>
            </div>
          </div>
        )}

        {/* ── Orders list ── */}
        <div className={`${surface} overflow-hidden`}>
          {/* Table header + filters */}
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-950 dark:text-white">
              {t("allOrdersList")}
              <span className="ml-2 text-sm font-normal text-slate-400">{filtered.length}</span>
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchCommercialOrders")}
                  className="w-52 rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
              >
                <option value="ALL">{t("allStatus")}</option>
                <option value="LATE">{t("late") || "Late"}</option>
                <option value="DRAFT">{t("draft")}</option>
                <option value="ORDONNANCED">{t("ordonnancedLabel")}</option>
                <option value="CONFIRMED">{t("confirmedOrders")}</option>
                <option value="PREPARED">{t("prepared") || "Prepared"}</option>
                <option value="SHIPPED">{t("shipped")}</option>
                <option value="DELIVERED">{t("delivered") || "Delivered"}</option>
                <option value="RETURNED">Returned</option>
                <option value="CLOSED">{t("closedStatus")}</option>
                <option value="CANCELLED">{t("cancelled")}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> {t("loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-sm text-slate-400 dark:text-slate-500">
              <ShoppingCart size={32} className="opacity-30" />
              {orders.length === 0 ? t("noOrdersYet") : t("noCommercialOrdersMatch")}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((order) => {
                const total = orderTotal(order);
                const isExpanded = expandedId === order._id;
                const busy = actionId === order._id;

                return (
                  <div key={order._id}>
                    {/* Order row */}
                    <div className="flex flex-wrap items-center gap-4 px-6 py-4">
                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : order._id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        <ChevronDown
                          size={14}
                          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>

                      {/* Order info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {order.source === "RECURRING" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                              Auto
                            </span>
                          )}
                          <Link
                            href={`/dashboard/commercial/orders/${order._id}`}
                            className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {order.orderNo}
                            <ExternalLink size={11} className="opacity-40" />
                          </Link>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusBadge(order.status)}`}
                          >
                            <StatusIcon status={order.status} />
                            {order.status}
                          </span>
                          {isLate(order) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                              <Clock size={10} />
                              {t("late") || "Late"}
                            </span>
                          )}
                          {backorderedIds.has(order._id) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              <RotateCcw size={10} />
                              {t("backorders") || "Backorder"}
                            </span>
                          )}
                          {order.isUrgent && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
                              <Zap size={10} />
                              {t("urgent") || "Urgent"}
                            </span>
                          )}
                          {order.isUrgent && order.shipApproval?.status === "PENDING" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400">
                              <Clock size={10} />
                              {t("awaitingApproval") || "Awaiting Approval"}
                            </span>
                          )}
                          {order.isUrgent && order.shipApproval?.status === "APPROVED" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                              <ShieldCheck size={10} />
                              {t("approved") || "Approved"}
                            </span>
                          )}
                          {order.isUrgent && order.shipApproval?.status === "REJECTED" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                              <ShieldX size={10} />
                              {t("rejected") || "Rejected"}
                            </span>
                          )}
                          {order.splitFromOrderId && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2.5 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-950">
                              Split Order
                            </span>
                          )}
                          {hasPlanningRisk(order) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                              <Clock size={10} />
                              {t("planningRiskLabel")}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                          {order.customerName}
                          {order.splitFromOrderId && (
                            <span className="ml-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Split waiting quantity
                            </span>
                          )}
                          {order.source === "RECURRING" && (
                            <span className="ml-2 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                              · {t("recurringLabel")}
                            </span>
                          )}
                          {order.promisedDate && (
                            <span className={`ml-2 text-[11px] ${isLate(order) ? "text-rose-500 dark:text-rose-400" : "text-slate-400"}`}>
                              · {new Date(order.promisedDate).toLocaleDateString("fr-TN")}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Total */}
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {total.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {order.lines.length} {t("orderLines").toLowerCase()}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {/* Managers only: confirm draft */}
                        {order.status === "DRAFT" && isManager && (
                          <button
                            onClick={() => runAction("confirm", order._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                            {t("confirm")}
                          </button>
                        )}

                        {order.status === "CONFIRMED" && isManager && (
                          <Link
                            href={`/dashboard/commercial/ordonnancement?order=${order._id}`}
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600"
                          >
                            <Clock size={11} />
                            {t("ordonanceAction")}
                          </Link>
                        )}

                        {/* Managers only: mark/unmark urgent on active orders */}
                        {isManager && !["SHIPPED", "DELIVERED", "CLOSED", "CANCELLED"].includes(order.status) && (
                          <button
                            onClick={() => runAction(order.isUrgent ? "unmarkUrgent" : "markUrgent", order._id)}
                            disabled={busy}
                            className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                              order.isUrgent
                                ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-400"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            }`}
                          >
                            <Zap size={11} />
                            {order.isUrgent ? t("unmarkUrgent") : t("markUrgent")}
                          </button>
                        )}

                        {/* Operational actions are handled from dedicated workflow pages */}
                        {order.status === "ORDONNANCED" && backorderedIds.has(order._id) && (
                          <span className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                            <RotateCcw size={11} />
                            {t("backorderPending")}
                          </span>
                        )}

                        {order.isUrgent && order.shipApproval?.status === "PENDING" && (
                          <span className="inline-flex items-center gap-1.5 rounded-2xl bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400">
                            <Clock size={11} />
                            {t("awaitingApproval")}
                          </span>
                        )}

                        {isManager && order.isUrgent && order.shipApproval?.status === "PENDING" && (
                          <Link
                            href="/dashboard/commercial/approvals"
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                          >
                            <ShieldCheck size={11} />
                            {t("approvalQueueTitle")}
                          </Link>
                        )}

                        {/* Cancel: managers only, before ordonnancement */}
                        {isManager && order.status === "DRAFT" && (
                          <button
                            onClick={() => runAction("cancel", order._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400"
                          >
                            <XCircle size={11} /> {t("cancel")}
                          </button>
                        )}

                        {order.status === "DELIVERED" && isManager && closedReturnOrderIds.has(order._id) && (
                          <button
                            onClick={() => runAction("markReturned", order._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                            Returned
                          </button>
                        )}

                        {isManager && order.status === "DELIVERED" && (
                          <button
                            onClick={() => runAction("reorder", order._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                          >
                            {busy ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                            Reorder
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded lines */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                        {order.notes && (
                          <p className="mb-3 text-xs italic text-slate-500 dark:text-slate-400">
                            {order.notes}
                          </p>
                        )}
                        <div className="mb-3 flex flex-wrap gap-4 text-[11px] text-slate-500 dark:text-slate-400">
  {order.createdAt && <span>{t("createdOnLabel")}: {new Date(order.createdAt).toLocaleDateString("fr-TN")}</span>}
  {order.promisedDate && <span>{t("promisedDateLabel")}: {new Date(order.promisedDate).toLocaleDateString("fr-TN")}</span>}
  {order.ordonnancedAt && <span>{t("ordonnancedLabel")}: {new Date(order.ordonnancedAt).toLocaleDateString("fr-TN")}</span>}
  {order.preparedAt && <span>{t("preparedOnLabel")}: {new Date(order.preparedAt).toLocaleDateString("fr-TN")}</span>}
  {order.shippedAt && <span>{t("shippedOnLabel")}: {new Date(order.shippedAt).toLocaleDateString("fr-TN")}</span>}
  {order.deliveredAt && <span>{t("deliveredOnLabel")}: {new Date(order.deliveredAt).toLocaleDateString("fr-TN")}</span>}
  {order.vehicleId?.matricule && <span>{t("carrier")}: {order.vehicleId.matricule}</span>}
  {!order.vehicleId?.matricule && order.trackingNumber && <span>{t("trackingNo")}: {order.trackingNumber}</span>}
</div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                              {[t("product"), t("quantity"), t("unitPrice"), "Remise", t("amount")].map((h) => (
                                <th
                                  key={h}
                                  className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {order.lines.map((line, idx) => (
                              <tr key={idx}>
                                <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                                  {line.productId?.name || "—"}
                                  {line.productId?.sku && (
                                    <span className="ml-1.5 text-[11px] text-slate-400">
                                      ({line.productId.sku})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 text-slate-600 dark:text-slate-300">
                                  {line.quantity}
                                  {(order.status === "ORDONNANCED" || order.status === "CONFIRMED") && (
                                    <div className="mt-1 text-[11px] text-slate-400">
                                      <div>Stock: {line.allocatedQuantity || 0}</div>
                                      <div>Production: {line.plannedProductionQuantity || 0}</div>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 text-slate-600 dark:text-slate-300">
                                  {line.unitPrice.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                                </td>
                                <td className="py-2.5 text-slate-600 dark:text-slate-300">
                                  {line.discount || 0}%
                                </td>
                                <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                                  {lineAmount(line).toLocaleString("fr-TN", {
                                    minimumFractionDigits: 2,
                                  })}{" "}
                                  TND
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200 dark:border-slate-800">
                              <td colSpan={4} className="pt-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {t("totalTnd")}
                              </td>
                              <td className="pt-3 font-bold text-slate-900 dark:text-white">
                                {total.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </ProtectedRoute>
  );
}