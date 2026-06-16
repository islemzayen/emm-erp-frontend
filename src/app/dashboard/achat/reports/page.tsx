"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supplierService, Supplier } from "@/services/purchase/supplierService";
import { purchaseRequestService } from "@/services/purchase/purchaseRequestService";
import { purchaseOrderService, PurchaseOrder } from "@/services/purchase/purchaseOrderService";
import { purchaseReceiptService, PurchaseReceipt } from "@/services/purchase/purchaseReceiptService";
import { purchaseInvoiceService, PurchaseInvoice } from "@/services/purchase/purchaseInvoiceService";
import { purchaseReturnService, PurchaseReturn } from "@/services/purchase/purchaseReturnService";
import {
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  Loader2,
  PackageCheck,
  SearchCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";

type PurchaseRequestLike = {
  _id: string;
  department: string;
  availableBudget?: number;
  status: string;
  createdAt: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function daysBetween(from: string, to: string) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
}

export default function PurchaseReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodDays, setPeriodDays] = useState<30 | 90 | 365>(90);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [requests, setRequests] = useState<PurchaseRequestLike[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");
        const [supplierData, requestData, orderData, receiptData, invoiceData, returnData] =
          await Promise.all([
            supplierService.getAll(),
            purchaseRequestService.getAll(),
            purchaseOrderService.getAll(),
            purchaseReceiptService.getAll(),
            purchaseInvoiceService.getAll(),
            purchaseReturnService.getAll(),
          ]);
        setSuppliers(supplierData);
        setRequests(requestData);
        setOrders(orderData);
        setReceipts(receiptData);
        setInvoices(invoiceData);
        setReturns(returnData);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Failed to load purchase reports"));
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const periodStart = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - periodDays);
    return now;
  }, [periodDays]);

  const inPeriod = useCallback((date: string) => new Date(date) >= periodStart, [periodStart]);

  const filteredRequests = useMemo(
    () => requests.filter((item) => inPeriod(item.createdAt)),
    [requests, inPeriod]
  );
  const filteredOrders = useMemo(
    () => orders.filter((item) => inPeriod(item.createdAt)),
    [orders, inPeriod]
  );
  const filteredReceipts = useMemo(
    () => receipts.filter((item) => inPeriod(item.createdAt)),
    [receipts, inPeriod]
  );
  const filteredInvoices = useMemo(
    () => invoices.filter((item) => inPeriod(item.createdAt)),
    [invoices, inPeriod]
  );
  const filteredReturns = useMemo(
    () => returns.filter((item) => inPeriod(item.createdAt)),
    [returns, inPeriod]
  );

  const supplierMap = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier._id, supplier])),
    [suppliers]
  );

  const receiptByOrder = useMemo(() => {
    const map = new Map<string, PurchaseReceipt[]>();
    for (const receipt of filteredReceipts) {
      const key = receipt.purchaseOrderId?._id;
      if (!key) continue;
      map.set(key, [...(map.get(key) || []), receipt]);
    }
    return map;
  }, [filteredReceipts]);

  const metrics = useMemo(() => {
    const totalSpend = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalTtc, 0);
const totalRefunds = filteredReturns.reduce((sum, item) => sum + (item.totalTtc || 0), 0);    const realizedSpend = totalSpend - totalRefunds;
    const budget = filteredRequests.reduce(
      (sum, request) => sum + Number(request.availableBudget || 0),
      0
    );

    const compliantReceipts = filteredReceipts.filter(
      (receipt) => receipt.receiptStatus !== "LITIGATION"
    ).length;
    const complianceRate = filteredReceipts.length
      ? (compliantReceipts / filteredReceipts.length) * 100
      : 100;

    const deliveryDelays = filteredOrders
      .map((order) => {
        const receiptsForOrder = receiptByOrder.get(order._id) || [];
        if (!receiptsForOrder.length) return null;
        const firstReceipt = receiptsForOrder.reduce((best, item) =>
          new Date(item.createdAt) < new Date(best.createdAt) ? item : best
        );
        return daysBetween(order.createdAt, firstReceipt.createdAt);
      })
      .filter((value): value is number => value !== null);

    const averageDeliveryDelay = deliveryDelays.length
      ? deliveryDelays.reduce((sum, value) => sum + value, 0) / deliveryDelays.length
      : 0;

    const statusCounts = ["DRAFT", "VALIDATED", "SENT", "RECEIVED", "CLOSED"].map((status) => ({
      status,
      count: filteredOrders.filter((order) => order.status === status).length,
    }));

    const spendBySupplier = new Map<
      string,
      { supplierName: string; amount: number; orders: number }
    >();
    for (const invoice of filteredInvoices) {
      const supplier = supplierMap.get(invoice.supplierId._id);
      const current = spendBySupplier.get(invoice.supplierId._id) || {
        supplierName: supplier?.name || invoice.supplierId.name,
        amount: 0,
        orders: 0,
      };
      current.amount += invoice.totalTtc;
      current.orders += 1;
      spendBySupplier.set(invoice.supplierId._id, current);
    }

    const topSuppliers = Array.from(spendBySupplier.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const spendByCategory = new Map<string, number>();
    for (const invoice of filteredInvoices) {
      const category = supplierMap.get(invoice.supplierId._id)?.category || "GENERAL";
      spendByCategory.set(category, (spendByCategory.get(category) || 0) + invoice.totalTtc);
    }

    const categoryBreakdown = Array.from(spendByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalSpend,
      realizedSpend,
      totalRefunds,
      budget,
      complianceRate,
      averageDeliveryDelay,
      statusCounts,
      topSuppliers,
      categoryBreakdown,
    };
  }, [filteredInvoices, filteredOrders, filteredReceipts, filteredRequests, filteredReturns, receiptByOrder, supplierMap]);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Purchasing · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <BarChart3 size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Purchase Reports
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Monitor expenses, supplier performance, delivery timing, compliance, and budget vs realized
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            {[30, 90, 365].map((days) => (
              <button
                key={days}
                onClick={() => setPeriodDays(days as 30 | 90 | 365)}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  periodDays === days
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {days === 30 ? "30d" : days === 90 ? "90d" : "12m"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500`}>
            <Loader2 size={16} className="animate-spin" />
            Loading purchase reports...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[
                {
                  label: "Realized Spend",
                  value: `${metrics.realizedSpend.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND`,
                  icon: CircleDollarSign,
                },
                {
                  label: "Budget vs Actual",
                  value: `${metrics.budget.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} / ${metrics.realizedSpend.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}`,
                  icon: ClipboardList,
                },
                {
                  label: "Compliance Rate",
                  value: `${metrics.complianceRate.toFixed(1)}%`,
                  icon: ShieldCheck,
                },
                {
                  label: "Avg Delivery Delay",
                  value: `${metrics.averageDeliveryDelay.toFixed(1)} days`,
                  icon: Truck,
                },
              ].map((card) => (
                <div key={card.label} className={`${surface} flex items-center gap-4 px-5 py-5`}>
                  <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
                    <card.icon size={16} className="text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{card.label}</p>
                    <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{card.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
              <div className={`${surface} p-6`}>
                <div className="flex items-center gap-2">
                  <SearchCheck size={16} className="text-slate-500" />
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Top Suppliers</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {metrics.topSuppliers.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No supplier spend in this period</p>
                  ) : (
                    metrics.topSuppliers.map((supplier) => (
                      <div key={supplier.supplierName} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{supplier.supplierName}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {supplier.orders} invoice{supplier.orders > 1 ? "s" : ""}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {supplier.amount.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={`${surface} p-6`}>
                <div className="flex items-center gap-2">
                  <PackageCheck size={16} className="text-slate-500" />
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Spend by Category</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {metrics.categoryBreakdown.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No category spend in this period</p>
                  ) : (
                    metrics.categoryBreakdown.map((item) => {
                      const maxAmount = metrics.categoryBreakdown[0]?.amount || 1;
                      const width = (item.amount / maxAmount) * 100;
                      return (
                        <div key={item.category}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-900 dark:text-white">{item.category}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {item.amount.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-2.5 rounded-full bg-slate-900 dark:bg-white"
                              style={{ width: `${Math.max(width, 6)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr,1.1fr]">
              <div className={`${surface} p-6`}>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Purchase Orders by Status</h2>
                <div className="mt-4 space-y-3">
                  {metrics.statusCounts.map((item) => (
                    <div key={item.status} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                      <span className="font-medium text-slate-900 dark:text-white">{item.status}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${surface} p-6`}>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Operational Summary</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Requests", value: filteredRequests.length },
                    { label: "Orders", value: filteredOrders.length },
                    { label: "Receipts", value: filteredReceipts.length },
                    { label: "Invoices", value: filteredInvoices.length },
                    { label: "Returns", value: filteredReturns.length },
                    {
                      label: "Refunds",
                      value: `${metrics.totalRefunds.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND`,
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-800">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.label}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{item.value}</p>
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
