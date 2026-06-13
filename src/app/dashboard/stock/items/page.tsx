"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { BarChart3, Boxes, Loader2, Package, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { stockItemService } from "@/services/stock/stockItemService";
import { stockDepotService } from "@/services/stock/stockDepotService";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

const PAGE_SIZE = 20;

interface StockProduct {
  _id: string;
  sku: string;
  name: string;
  type: "PRODUIT_FINI" | "SOUS_ENSEMBLE" | "COMPOSANT" | "MATIERE_PREMIERE";
  unit: string;
  status: "ACTIVE" | "INACTIVE";
}

interface StockItem {
  _id: string;
  productId: StockProduct;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  lastMovementAt?: string | null;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: string;
}

function depotScopeToTypes(scope?: string): string[] {
  if (scope === "MP")  return ["MATIERE_PREMIERE"];
  if (scope === "PF")  return ["PRODUIT_FINI"];
  return ["PRODUIT_FINI", "SOUS_ENSEMBLE", "COMPOSANT", "MATIERE_PREMIERE"];
}

// Format quantity according to product unit:
// - kg / l / m → 2 decimals with comma (e.g. 12,50)
// - pcs (or any integer-like unit) → integer
function fmtQty(qty: number, unit?: string): string {
  const u = (unit || "").toLowerCase();
  const fractional = u === "kg" || u === "l" || u === "m";
  return Number(qty || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: fractional ? 2 : 0,
    maximumFractionDigits: fractional ? 2 : 0,
  });
}

export default function StockItemsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [items, setItems] = useState<StockItem[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("PRODUIT_FINI");
  const [depotScope, setDepotScope]   = useState<string | null>(null);
  const [myDepotId, setMyDepotId]     = useState<string | null>(null);
  const [depotQtyMap, setDepotQtyMap] = useState<Record<string, { onHand: number; reserved: number; available: number }>>({});
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; productId: string } | null>(null);
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const surface =
    "rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900";

  useEffect(() => {
    if (user?.id) fetchItems();
  }, [user?.id]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await stockItemService.getAll();
      setItems(data);

      if (user?.role === "DEPOT_MANAGER") {
        const depots = await stockDepotService.getAll();
        const myDepot = depots.find(
          (d: any) => d.managerId?._id === user.id || d.managerId === user.id
        );
        if (myDepot) {
          setDepotScope(myDepot.productTypeScope);
          setMyDepotId(String(myDepot._id));
          const scope = myDepot.productTypeScope;
          setTypeFilter(scope === "MP" ? "MATIERE_PREMIERE" : "PRODUIT_FINI");

          // Build per-depot quantity map
          const availability = await stockItemService.getAvailabilityByDepot();
          const map: Record<string, { onHand: number; reserved: number; available: number }> = {};
          for (const row of availability.rows) {
            if (String(row.depotId) === String(myDepot._id)) {
              map[String(row.productId)] = {
                onHand:    row.quantityOnHand,
                reserved:  row.quantityReserved,
                available: row.quantityAvailable,
              };
            }
          }
          setDepotQtyMap(map);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load stock items");
    } finally {
      setLoading(false);
    }
  };

  const allowedTypes = depotScope ? depotScopeToTypes(depotScope) : null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      const product = item.productId;
      // Depot managers only see items that exist in their depot
      if (myDepotId && !(String(item.productId?._id) in depotQtyMap)) return false;
      const matchScope  = !allowedTypes || allowedTypes.includes(product?.type);
      const matchType   = typeFilter === "ALL" || product?.type === typeFilter;
      const matchSearch = !q || product?.name?.toLowerCase().includes(q);
      return matchScope && matchType && matchSearch;
    });
  }, [items, search, typeFilter, allowedTypes, myDepotId, depotQtyMap]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, item) => {
        acc.onHand += item.quantityOnHand || 0;
        acc.reserved += item.quantityReserved || 0;
        acc.available += item.quantityAvailable || 0;
        return acc;
      },
      { onHand: 0, reserved: 0, available: 0 }
    );
  }, [filtered]);

  const lowAvailabilityCount = filtered.filter((i) => i.quantityAvailable <= 0).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => { setPage(1); }, [search, typeFilter]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [ctxMenu]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER", "DEPOT_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Stock Module · ERP
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("stockItems")}{" "}
              <span className="text-slate-400 dark:text-slate-500">Live State</span>
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            {
              label: t("stockItems"),
              value: String(filtered.length),
              sub: "tracked products",
              icon: <Boxes size={16} />,
              iconBg:
                "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
            },
            {
              label: t("onHand"),
              value: String(totals.onHand),
              sub: "physical quantity",
              icon: <Package size={16} />,
              iconBg:
                "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
            },
            {
              label: t("reserved"),
              value: String(totals.reserved),
              sub: "allocated quantity",
              icon: <BarChart3 size={16} />,
              iconBg:
                "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
            },
            {
              label: t("availableQty"),
              value: String(totals.available),
              sub: `${lowAvailabilityCount} critical items`,
              icon: <BarChart3 size={16} />,
              iconBg:
                "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`${surface} flex items-center gap-4 px-5 py-5`}
            >
              <div className={`rounded-2xl p-3 ${card.iconBg}`}>{card.icon}</div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {card.value}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{card.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {t("stockItems")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} {t("ofText")} {items.length} {t("records")}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                disabled={!!depotScope && depotScopeToTypes(depotScope).length === 1}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                {!depotScope && <option value="ALL">Tous les types</option>}
                {(!depotScope || depotScopeToTypes(depotScope).includes("PRODUIT_FINI")) && <option value="PRODUIT_FINI">Produit Fini</option>}
                {(!depotScope || depotScopeToTypes(depotScope).includes("SOUS_ENSEMBLE")) && <option value="SOUS_ENSEMBLE">Sous-ensemble</option>}
                {(!depotScope || depotScopeToTypes(depotScope).includes("COMPOSANT")) && <option value="COMPOSANT">Composant</option>}
                {(!depotScope || depotScopeToTypes(depotScope).includes("MATIERE_PREMIERE")) && <option value="MATIERE_PREMIERE">Matière Première</option>}
              </select>

              <div className="relative w-full sm:w-72">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800"
                  placeholder={t("searchStock")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              Loading...
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-sm text-rose-600 dark:text-rose-400">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("noStockMatch")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-3 font-medium">{t("sku")}</th>
                    <th className="px-6 py-3 font-medium">{t("product")}</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">{t("onHand")}</th>
                    <th className="px-6 py-3 font-medium">{t("reserved")}</th>
                    <th className="px-6 py-3 font-medium">{t("availableQty")}</th>
                    <th className="px-6 py-3 font-medium">{t("unit")}</th>
                    <th className="px-6 py-3 font-medium">{t("lastMovement")}</th>
                    <th className="px-6 py-3 font-medium">{t("status")}</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paginated.map((item, i) => (
                    <motion.tr
                      key={item._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const pid = item.productId?._id;
                        if (!pid) return;
                        setCtxMenu({ x: e.clientX, y: e.clientY, productId: pid });
                      }}
                      className="cursor-context-menu transition hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {item.productId?.sku || "—"}
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {item.productId?.name || "—"}
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {item.productId?.type || "—"}
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {fmtQty(
                          myDepotId ? (depotQtyMap[String(item.productId?._id)]?.onHand ?? 0) : item.quantityOnHand,
                          item.productId?.unit
                        )}
                      </td>

                      <td className="px-6 py-4 text-amber-700 dark:text-amber-300">
                        {fmtQty(
                          myDepotId ? (depotQtyMap[String(item.productId?._id)]?.reserved ?? 0) : item.quantityReserved,
                          item.productId?.unit
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {(() => {
                          const qty = myDepotId
                            ? (depotQtyMap[String(item.productId?._id)]?.available ?? 0)
                            : item.quantityAvailable;
                          return (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              qty > 0
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            }`}>
                              {fmtQty(qty, item.productId?.unit)}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {item.productId?.unit || "—"}
                      </td>

                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {formatDateTime(item.lastMovementAt)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages} · {filtered.length} records
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-medium transition ${
                          page === p
                            ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          style={{ position: "fixed", top: ctxMenu.y, left: ctxMenu.x, zIndex: 100 }}
          onClick={(e) => e.stopPropagation()}
          className="min-w-[180px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            onClick={() => {
              router.push(`/dashboard/stock/purchase-request?productId=${ctxMenu.productId}`);
              setCtxMenu(null);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-700 dark:text-slate-200 dark:hover:bg-teal-950/30 dark:hover:text-teal-300"
          >
            <Send size={14} /> Request
          </button>
        </div>
      )}
    </ProtectedRoute>
  );
}