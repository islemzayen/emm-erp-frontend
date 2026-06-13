"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { ArrowDownToLine, ArrowUpFromLine, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { stockMovementService } from "@/services/stock/stockMovementService";

interface Movement {
  _id: string;
  type: string;
  quantity: number;
  createdAt: string;
  productId?: { name: string; sku: string };
}

export default function DepotDashboardPage() {
  const { t } = useLanguage();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const surface =
    "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const movData = await stockMovementService.getAll();
        setMovements(movData);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load depot dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const movementsToday = useMemo(() => {
    const today = new Date().toDateString();
    return movements.filter((m) => new Date(m.createdAt).toDateString() === today).length;
  }, [movements]);

  const entriesTotal = useMemo(
    () => movements.filter((m) => m.type === "ENTRY").reduce((s, m) => s + m.quantity, 0),
    [movements]
  );

  const exitsTotal = useMemo(
    () => movements.filter((m) => m.type === "EXIT" || m.type === "DEDUCTION").reduce((s, m) => s + m.quantity, 0),
    [movements]
  );

  const recentMovements = useMemo(
    () => [...movements].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8),
    [movements]
  );

  const formatDate = (val?: string | null) => {
    if (!val) return "—";
    return new Date(val).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const movTypeBadge = (type: string) => {
    if (type === "ENTRY") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    if (type === "EXIT" || type === "DEDUCTION") return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
    if (type === "ADJUSTMENT") return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  };

  const kpis = [
    {
      icon: <FileText size={16} />,
      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
      label: "Movements Today",
      value: String(movementsToday),
      sub: "entries & exits",
    },
    {
      icon: <ArrowDownToLine size={16} />,
      iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
      label: "Total Entries",
      value: String(entriesTotal),
      sub: "units received",
    },
    {
      icon: <ArrowUpFromLine size={16} />,
      iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400",
      label: "Total Exits",
      value: String(exitsTotal),
      sub: "units dispatched",
    },
    {
      icon: <FileText size={16} />,
      iconBg: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
      label: "All Movements",
      value: String(movements.length),
      sub: "total records",
    },
  ];

  return (
    <ProtectedRoute allowedRoles={["DEPOT_MANAGER"]}>
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Depot · ERP
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Depot{" "}
            <span className="text-slate-400 dark:text-slate-500">Dashboard</span>
          </h1>
        </div>

        {loading ? (
          <div className={`${surface} flex items-center justify-center px-6 py-16 text-sm text-slate-500 dark:text-slate-400`}>
            Loading...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={`${surface} p-5`}
                >
                  <div className={`inline-flex rounded-2xl p-2.5 ${kpi.iconBg}`}>{kpi.icon}</div>
                  <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {kpi.label}
                  </p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                    {kpi.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{kpi.sub}</p>
                </motion.div>
              ))}
            </div>

            {/* Recent movements */}
            <div className={`${surface} p-6`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  Recent Movements
                </h2>
                <Link
                  href="/dashboard/stock/movements"
                  className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  View all →
                </Link>
              </div>
              {recentMovements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
                  No movements yet
                </div>
              ) : (
                <div className="space-y-2">
                  {recentMovements.map((m) => (
                    <div
                      key={m._id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 dark:border-slate-800"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {m.productId?.name ?? "—"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(m.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {m.type === "EXIT" || m.type === "DEDUCTION" ? "-" : "+"}
                          {m.quantity}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${movTypeBadge(m.type)}`}>
                          {m.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
