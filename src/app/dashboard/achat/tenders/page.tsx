"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useMemo, useState } from "react";
import { tenderService, Tender, TenderOffer } from "@/services/purchase/tenderService";
import { purchaseRequestService } from "@/services/purchase/purchaseRequestService";
import { supplementaryRequestService, SupplementaryRequest } from "@/services/purchase/supplementaryRequestService";
import { supplierService, Supplier } from "@/services/purchase/supplierService";
import {
  ClipboardList,
  Search,
  Plus,
  Loader2,
  Send,
  CheckCircle2,
  Building2,
  Scale,
  X,
  Trophy,
  FileText,
  Pencil,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovedRequest = {
  _id: string;
  requestNo: string;
  requestedQuantity: number;
  reason: string;
  department: string;
  productId?: { _id: string; name: string; sku: string; category: string };
  status: "APPROVED";
};

type UnifiedDA = {
  _id: string;
  requestNo: string;
  label: string;
  category: string;
  type: "stock" | "supplementary";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";

const labelCls =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400";

function getErr(err: unknown, fallback = "Une erreur est survenue"): string {
  if (err && typeof err === "object" && "response" in err) {
    const r = (err as { response: { data?: { message?: string } } }).response;
    if (typeof r.data?.message === "string") return r.data.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  COMPARING: "En comparaison",
  AWARDED: "Adjugé",
  CANCELLED: "Annulé",
};

const STATUS_CLS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  SENT: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  COMPARING: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  AWARDED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
};

// ─── Comparison table (pure function, not a component, to avoid re-mount) ─────

function renderComparisonTable(
  tender: Tender,
  allSuppliers: Supplier[],
  onChoose: (tenderId: string, offerId: string) => void
) {
  const invited = tender.supplierIds;
  if (invited.length === 0) {
    return (
      <p className="py-4 text-sm text-slate-400">Aucun fournisseur invité.</p>
    );
  }

  // Product-specific price lookup (uses supplier.productPrices for the tender's product)
  const tenderProductId = tender.purchaseRequestId?.productId?._id;
  const priceForSupplier = (supplierId: string): number | null => {
    const live = allSuppliers.find((s) => s._id === supplierId);
    if (tenderProductId && live?.productPrices) {
      const pp = live.productPrices.find((x) => String(x.productId) === String(tenderProductId));
      if (pp && pp.priceHt > 0) return Number(pp.priceHt);
    }
    const offer = tender.offers.find((o) => o.supplierId._id === supplierId);
    return offer?.amountHt ?? null;
  };

  const prices = invited
    .map((s) => priceForSupplier(s._id))
    .filter((p): p is number => p !== null && p > 0);
  const bestPrice = prices.length ? Math.min(...prices) : null;
  const delays = invited.map((supplier) => {
    const live = allSuppliers.find((s) => s._id === supplier._id);
    return live?.leadTimeDays ?? tender.offers.find((o) => o.supplierId._id === supplier._id)?.leadTimeDays ?? 0;
  }).filter((d) => d > 0);
  const bestDelay = delays.length ? Math.min(...delays) : null;

  const isAwarded = tender.status === "AWARDED";

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
            {/* Criteria column */}
            <th className="w-36 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Critère
            </th>
            {invited.map((supplier) => {
              const isSelected =
                isAwarded && tender.selectedSupplierId?._id === supplier._id;
              return (
                <th
                  key={supplier._id}
                  className={`min-w-[180px] px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Building2 size={12} className="opacity-50" />
                    <span className="normal-case text-xs font-bold">{supplier.name}</span>
                    <span className="font-normal normal-case text-[10px] text-slate-400">
                      {supplier.supplierNo}
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                        <Trophy size={9} /> Adjugé
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {/* Prix produit */}
          <tr>
            <td className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Prix produit (TND)
            </td>
            {invited.map((supplier) => {
              const price = priceForSupplier(supplier._id);
              const isBest = price !== null && bestPrice !== null && price === bestPrice;
              return (
                <td key={supplier._id} className="px-4 py-3 text-center">
                  {price !== null ? (
                    <span
                      className={`text-sm font-bold ${
                        isBest
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {price.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}
                      {isBest && (
                        <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                          ★ Moins cher
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              );
            })}
          </tr>

          {/* Délai livraison */}
          <tr className="bg-slate-50/60 dark:bg-slate-950/20">
            <td className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Délai livraison
            </td>
            {invited.map((supplier) => {
              const live = allSuppliers.find((s) => s._id === supplier._id);
              const delay = live?.leadTimeDays ?? tender.offers.find((o) => o.supplierId._id === supplier._id)?.leadTimeDays ?? null;
              const isFastest = delay !== null && bestDelay !== null && delay === bestDelay;
              return (
                <td key={supplier._id} className="px-4 py-3 text-center">
                  {delay !== null ? (
                    <span
                      className={`text-sm font-semibold ${
                        isFastest
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {delay} jour{delay > 1 ? "s" : ""}
                      {isFastest && (
                        <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                          ★ Plus rapide
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              );
            })}
          </tr>

          {/* Rating */}
          <tr>
            <td className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Rating
            </td>
            {invited.map((supplier) => {
              const live = allSuppliers.find((s) => s._id === supplier._id);
              const rating = live?.rating ?? 0;
              const count = live?.ratingCount ?? 0;
              const maxRating = Math.max(...invited.map((s) => allSuppliers.find((x) => x._id === s._id)?.rating ?? 0));
              const isBest = count > 0 && rating === maxRating && maxRating > 0;
              return (
                <td key={supplier._id} className="px-4 py-3 text-center">
                  {count === 0 ? (
                    <span className="text-xs text-slate-400">No ratings yet</span>
                  ) : (
                    <div className={`inline-flex flex-col items-center gap-0.5 ${isBest ? "text-amber-500 dark:text-amber-400" : "text-slate-600 dark:text-slate-300"}`}>
                      <span className="text-sm font-bold">★ {rating.toFixed(1)} / 5</span>
                      <span className="text-[10px] text-slate-400">{count} avis{isBest && (
                        <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-bold text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                          Top
                        </span>
                      )}</span>
                    </div>
                  )}
                </td>
              );
            })}
          </tr>

          {/* Actions */}
          <tr className="bg-slate-50 dark:bg-slate-950/40">
            <td className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Action
            </td>
            {invited.map((supplier) => {
              const offer: TenderOffer | undefined = tender.offers.find(
                (o) => o.supplierId._id === supplier._id
              );
              const isSelected =
                isAwarded && tender.selectedSupplierId?._id === supplier._id;

              return (
                <td key={supplier._id} className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    {/* Choisir */}
                    {!isAwarded && offer && (
                      <button
                        onClick={() => onChoose(tender._id, offer._id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500"
                      >
                        <CheckCircle2 size={11} />
                        Choisir
                      </button>
                    )}

                    {/* Selected badge */}
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <Trophy size={10} /> Sélectionné
                      </span>
                    )}

                    {!offer && (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PurchaseTendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [approvedRequests, setApprovedRequests] = useState<ApprovedRequest[]>([]);
  const [approvedSupp, setApprovedSupp] = useState<SupplementaryRequest[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Create AO modal
  const [showCreate, setShowCreate] = useState(false);
  const [createDaId, setCreateDaId] = useState("");
  const [createDaType, setCreateDaType] = useState<"stock" | "supplementary">("stock");
  const [createSuppliers, setCreateSuppliers] = useState<string[]>([]);
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const activeTenderStatuses: TenderStatus[] = ["DRAFT", "SENT", "COMPARING", "AWARDED"];
  const usedStockIds = new Set(
    tenders
      .filter((t) => activeTenderStatuses.includes(t.status) && t.purchaseRequestId)
      .map((t) => t.purchaseRequestId!._id)
  );
  const usedSuppIds = new Set(
    tenders
      .filter((t) => activeTenderStatuses.includes(t.status) && t.supplementaryRequestId)
      .map((t) => t.supplementaryRequestId!._id)
  );

  const allApprovedDAs: UnifiedDA[] = [
    ...approvedRequests
      .filter((r) => !usedStockIds.has(r._id))
      .map((r) => ({
        _id: r._id,
        requestNo: r.requestNo,
        label: `${r.requestNo} · ${r.productId?.name ?? "Product"} · ${r.requestedQuantity} units`,
        category: r.productId?.category ?? "",
        type: "stock" as const,
      })),
    ...approvedSupp
      .filter((r) => !usedSuppIds.has(r._id))
      .map((r) => ({
        _id: r._id,
        requestNo: r.requestNo,
        label: `${r.requestNo} · ${r.title} · ${r.quantity} ${r.unit}`,
        category: r.category ?? "",
        type: "supplementary" as const,
      })),
  ];

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [tenderData, requestData, suppData, supplierData] = await Promise.all([
        tenderService.getAll(),
        purchaseRequestService.getAll(),
        supplementaryRequestService.getAll(),
        supplierService.getAll(),
      ]);
      setTenders(tenderData);
      setApprovedRequests(
        (requestData as ApprovedRequest[]).filter((r) => r.status === "APPROVED")
      );
      setApprovedSupp(suppData.filter((r) => r.status === "APPROVED"));
      setSuppliers((supplierData as Supplier[]).filter((s) => !s.isBlocked));
    } catch (err) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tenders.filter((t) =>
      [
        t.tenderNo,
        t.purchaseRequestId?.requestNo,
        t.purchaseRequestId?.productId?.name,
        t.supplementaryRequestId?.requestNo,
        t.supplementaryRequestId?.title,
        t.selectedSupplierId?.name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [search, tenders]);

  // Create AO
  const handleCreate = async () => {
    if (!createDaId) {
      setError("Sélectionnez une DA approuvée");
      return;
    }
    setCreating(true);
    try {
      await tenderService.create({
        ...(createDaType === "stock"
          ? { purchaseRequestId: createDaId }
          : { supplementaryRequestId: createDaId }),
        supplierIds: createSuppliers,
        notes: createNotes,
      });
      setShowCreate(false);
      setCreateDaId("");
      setCreateSuppliers([]);
      setCreateNotes("");
      await fetchAll();
    } catch (err) {
      setError(getErr(err));
    } finally {
      setCreating(false);
    }
  };

  // Edit suppliers
  const [editTarget, setEditTarget] = useState<Tender | null>(null);
  const [editSuppliers, setEditSuppliers] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const openEditSuppliers = (tender: Tender) => {
    setEditTarget(tender);
    setEditSuppliers(tender.supplierIds.map((s) => s._id));
    setError("");
  };

  const handleEditSuppliers = async () => {
    if (!editTarget) return;
    try {
      setEditSaving(true);
      setError("");
      await tenderService.updateSuppliers(editTarget._id, editSuppliers);
      setEditTarget(null);
      await fetchAll();
    } catch (err) {
      setError(getErr(err));
    } finally {
      setEditSaving(false);
    }
  };

  // Re-create missing BC for stuck AWARDED tenders
  const [creatingOrder, setCreatingOrder] = useState<string | null>(null);
  const handleCreateMissingOrder = async (tenderId: string) => {
    setCreatingOrder(tenderId);
    try {
      setError("");
      await tenderService.createMissingOrder(tenderId);
      await fetchAll();
    } catch (err) {
      setError(getErr(err));
    } finally {
      setCreatingOrder(null);
    }
  };

  // Choose winner
  const handleChoose = async (tenderId: string, offerId: string) => {
    try {
      setError("");
      await tenderService.selectOffer(tenderId, offerId);
      await fetchAll();
    } catch (err) {
      setError(getErr(err));
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Achats · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Scale size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Appels d&apos;Offres
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Comparez les offres fournisseurs et adjugez la meilleure
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setShowCreate(true);
              setCreateDaId("");
              setCreateSuppliers([]);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            <Plus size={15} />
            Créer un AO
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Total AO",
              value: tenders.length,
              Icon: ClipboardList,
              cls: "text-slate-600 dark:text-slate-300",
              bg: "bg-slate-100 dark:bg-slate-800",
            },
            {
              label: "Envoyés",
              value: tenders.filter((t) => t.status === "SENT").length,
              Icon: Send,
              cls: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-50 dark:bg-blue-950/30",
            },
            {
              label: "En comparaison",
              value: tenders.filter((t) => t.status === "COMPARING").length,
              Icon: Scale,
              cls: "text-amber-600 dark:text-amber-400",
              bg: "bg-amber-50 dark:bg-amber-950/30",
            },
            {
              label: "Adjugés",
              value: tenders.filter((t) => t.status === "AWARDED").length,
              Icon: Trophy,
              cls: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-50 dark:bg-emerald-950/30",
            },
          ].map((card) => (
            <div key={card.label} className={`${surface} flex items-center gap-4 px-5 py-5`}>
              <div className={`rounded-2xl p-3 ${card.bg}`}>
                <card.Icon size={16} className={card.cls} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Tender list */}
        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Tableau de comparaison
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} AO · choisissez le meilleur fournisseur
              </p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher AO, DA, produit..."
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <ClipboardList size={20} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Aucun appel d&apos;offres
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Créez un AO depuis une DA approuvée
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {filtered.map((tender) => (
                <div
                  key={tender._id}
                  className="rounded-3xl border border-slate-200 bg-slate-50/40 p-5 dark:border-slate-800 dark:bg-slate-950/30"
                >
                  {/* AO header */}
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>

                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-950 dark:text-white">
                          {tender.tenderNo}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            STATUS_CLS[tender.status] ?? ""
                          }`}
                        >
                          {STATUS_LABEL[tender.status] ?? tender.status}
                        </span>
                      </div>
                      {tender.purchaseRequestId ? (
                        <>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            DA {tender.purchaseRequestId.requestNo} ·{" "}
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {tender.purchaseRequestId.productId?.name ?? "Product"}
                            </span>{" "}
                            · {tender.purchaseRequestId.requestedQuantity} units
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                            Department: {tender.purchaseRequestId.department}
                          </p>
                        </>
                      ) : tender.supplementaryRequestId ? (
                        <>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            DA {tender.supplementaryRequestId.requestNo} ·{" "}
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {tender.supplementaryRequestId.title}
                            </span>{" "}
                            · {tender.supplementaryRequestId.quantity} {tender.supplementaryRequestId.unit}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                            Department: {tender.supplementaryRequestId.department} · {tender.supplementaryRequestId.category}
                          </p>
                        </>
                      ) : null}
                      {tender.status === "AWARDED" && tender.selectedSupplierId && (
                        <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          🏆 Fournisseur retenu : {tender.selectedSupplierId.name}
                        </p>
                      )}
                      {tender.purchaseOrderId && (
                        <Link
                          href="/dashboard/achat/orders"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <FileText size={11} />
                          BC {tender.purchaseOrderId.orderNo} · {tender.purchaseOrderId.status}
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Re-create missing BC */}
                      {tender.status === "AWARDED" && !tender.purchaseOrderId && (
                        <button
                          onClick={() => handleCreateMissingOrder(tender._id)}
                          disabled={creatingOrder === tender._id}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                        >
                          {creatingOrder === tender._id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <FileText size={12} />
                          )}
                          Generate BC
                        </button>
                      )}

                      {/* Edit suppliers button */}
                      {tender.status !== "AWARDED" && tender.status !== "CANCELLED" && (
                        <button
                          onClick={() => openEditSuppliers(tender)}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Pencil size={12} />
                          Edit Suppliers
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comparison table */}
                  {renderComparisonTable(tender, suppliers, handleChoose)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Create AO Modal ──────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                Créer un Appel d&apos;Offres
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Approved Purchase Request (DA)</label>
                <select
                  className={inputCls}
                  value={createDaId}
                  onChange={(e) => {
                    const daId = e.target.value;
                    setCreateDaId(daId);
                    const da = allApprovedDAs.find((d) => d._id === daId);
                    if (da) setCreateDaType(da.type);
                    // Stock DA → suppliers that sell this product
                    // Supplementary DA → suppliers with products configured in same category
                    let matched: Supplier[] = [];
                    if (da?.type === "stock") {
                      const stockReq = approvedRequests.find((r) => r._id === daId);
                      const productId = stockReq?.productId?._id;
                      matched = productId
                        ? suppliers.filter((s) => (s.productIds ?? []).map(String).includes(String(productId)))
                        : [];
                    } else {
                      const cat = da?.category ?? "";
                      matched = suppliers.filter((s) =>
                        (s.productIds ?? []).length > 0 && (!cat || s.category === cat)
                      );
                    }
                    setCreateSuppliers(matched.map((s) => s._id));
                  }}
                >
                  <option value="">— Select an approved DA —</option>
                  {(() => {
                    const availableStock = approvedRequests.filter((r) => !usedStockIds.has(r._id));
                    const availableSupp  = approvedSupp.filter((r) => !usedSuppIds.has(r._id));
                    return (
                      <>
                        {availableStock.length > 0 && (
                          <optgroup label="Stock Requests">
                            {availableStock.map((r) => (
                              <option key={r._id} value={r._id}>
                                {r.requestNo} · {r.productId?.name ?? "Product"} · {r.requestedQuantity} units
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {availableSupp.length > 0 && (
                          <optgroup label="Supplementary Requests">
                            {availableSupp.map((r) => (
                              <option key={r._id} value={r._id}>
                                {r.requestNo} · {r.title} · {r.quantity} {r.unit}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  Invited Suppliers
                  {createDaId && (() => {
                    const da = allApprovedDAs.find((d) => d._id === createDaId);
                    if (da?.type === "stock") {
                      const stockReq = approvedRequests.find((r) => r._id === createDaId);
                      const productName = stockReq?.productId?.name;
                      return productName ? (
                        <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                          {productName}
                        </span>
                      ) : null;
                    }
                    return da?.category ? (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {da.category}
                      </span>
                    ) : null;
                  })()}
                </label>
                {(() => {
                  if (!createDaId) {
                    return (
                      <div className="max-h-48 overflow-y-auto space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                        <p className="text-sm text-slate-400">Select a DA first</p>
                      </div>
                    );
                  }
                  const da = allApprovedDAs.find((d) => d._id === createDaId);
                  let pool: Supplier[] = [];
                  let emptyMsg = "No suppliers found";
                  if (da?.type === "stock") {
                    const stockReq = approvedRequests.find((r) => r._id === createDaId);
                    const productId = stockReq?.productId?._id;
                    pool = productId
                      ? suppliers.filter((s) => (s.productIds ?? []).map(String).includes(String(productId)))
                      : [];
                    emptyMsg = "Aucun fournisseur ne vend ce produit";
                  } else {
                    const cat = da?.category ?? "";
                    // Only show suppliers that have at least one product configured
                    pool = suppliers.filter((s) =>
                      (s.productIds ?? []).length > 0 && (!cat || s.category === cat)
                    );
                    emptyMsg = "Aucun fournisseur configuré pour cette catégorie";
                  }
                  return (
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                      {pool.length === 0 ? (
                        <p className="text-sm text-slate-400">{emptyMsg}</p>
                      ) : (
                        pool.map((s) => {
                          let supplierPrice: number | null = null;
                          if (da?.type === "stock") {
                            const stockReq = approvedRequests.find((r) => r._id === createDaId);
                            const productId = stockReq?.productId?._id;
                            const pp = (s.productPrices ?? []).find(
                              (x) => String(x.productId) === String(productId)
                            );
                            supplierPrice = pp ? Number(pp.priceHt) : null;
                          }
                          return (
                            <label
                              key={s._id}
                              className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <input
                                type="checkbox"
                                className="accent-slate-700"
                                checked={createSuppliers.includes(s._id)}
                                onChange={(e) =>
                                  setCreateSuppliers((prev) =>
                                    e.target.checked
                                      ? [...prev, s._id]
                                      : prev.filter((id) => id !== s._id)
                                  )
                                }
                              />
                              <Building2 size={13} className="text-slate-400" />
                              <span className="font-medium">{s.name}</span>
                              {supplierPrice !== null && supplierPrice > 0 && (
                                <span className="ml-auto rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
                                  {supplierPrice.toFixed(3)} TND
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950"
                >
                  {creating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Créer l&apos;AO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Suppliers Modal ─────────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Edit Suppliers
                </h3>
                <p className="text-xs text-slate-400">{editTarget.tenderNo}</p>
              </div>
              <button
                onClick={() => setEditTarget(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {(() => {
              const productId = editTarget.purchaseRequestId?.productId?._id;
              const cat = editTarget.purchaseRequestId?.productId?.category
                ?? editTarget.supplementaryRequestId?.category
                ?? "";
              let filteredForEdit: Supplier[];
              if (productId) {
                // Stock DA → only suppliers that sell this product
                filteredForEdit = suppliers.filter((s) =>
                  (s.productIds ?? []).map(String).includes(String(productId))
                );
              } else {
                // Supplementary DA → only suppliers with products configured
                filteredForEdit = suppliers.filter((s) =>
                  (s.productIds ?? []).length > 0 && (!cat || s.category === cat)
                );
              }
              const headerLabel = editTarget.purchaseRequestId?.productId?.name ?? cat;
              return (
            <div className="max-h-64 overflow-y-auto space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
              {headerLabel && (
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {productId ? "Produit" : "Category"} : {headerLabel}
                </p>
              )}
              {filteredForEdit.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {productId ? "Aucun fournisseur ne vend ce produit" : "Aucun fournisseur configuré pour cette catégorie"}
                </p>
              ) : filteredForEdit.map((s) => (
                <label
                  key={s._id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    className="accent-slate-700"
                    checked={editSuppliers.includes(s._id)}
                    onChange={(e) =>
                      setEditSuppliers((prev) =>
                        e.target.checked
                          ? [...prev, s._id]
                          : prev.filter((id) => id !== s._id)
                      )
                    }
                  />
                  <Building2 size={13} className="text-slate-400" />
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-auto text-xs text-slate-400">{s.category}</span>
                </label>
              ))}
            </div>
              );
            })()}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSuppliers}
                disabled={editSaving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
              >
                {editSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </ProtectedRoute>
  );
}
