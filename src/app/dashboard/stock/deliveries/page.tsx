"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  purchaseOrderService,
  PurchaseOrder,
} from "@/services/purchase/purchaseOrderService";
import { purchaseReceiptService, PurchaseReceipt } from "@/services/purchase/purchaseReceiptService";
import { purchaseReturnService, PurchaseReturn } from "@/services/purchase/purchaseReturnService";
import { stockDepotService, Depot } from "@/services/stock/stockDepotService";
import { useEffect, useRef, useState } from "react";
import {
  Truck,
  Loader2,
  X,
  CheckCircle2,
  Star,
  Package,
  ChevronDown,
  AlertTriangle,
  Paperclip,
  RotateCcw,
  ClipboardList,
  ChevronRight,
} from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("fr-TN", { minimumFractionDigits: 3 });
}

function getError(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (err as { response: { data: { message: string } } }).response.data.message;
  }
  return "Une erreur est survenue";
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const labels = ["", "Très mauvais", "Mauvais", "Moyen", "Bon", "Excellent"];
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s === value ? 0 : s)}
        >
          <Star
            size={22}
            className={
              s <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-slate-300 dark:text-slate-600"
            }
          />
        </button>
      ))}
      {(hover || value) > 0 && (
        <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
          {labels[hover || value]}
        </span>
      )}
    </div>
  );
}

// ─── Return status badge ──────────────────────────────────────────────────────

const returnStatusConfig = {
  DRAFT: { label: "Brouillon", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  VALIDATED: { label: "Validé", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  SENT: { label: "Envoyé", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  CLOSED: { label: "Clôturé", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
};

// ─── Receive Modal ────────────────────────────────────────────────────────────

function ReceiveModal({
  order,
  depots,
  myDepot,
  onClose,
  onDone,
}: {
  order: PurchaseOrder;
  depots: Depot[];
  myDepot?: Depot | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const isSupplementary = order.lines.every((l) => !l.productId);

  const [qtys, setQtys] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      order.lines.map((l) => [l._id, Math.max(0, l.quantity - (l.receivedQuantity || 0))])
    )
  );
  const [depotId, setDepotId] = useState(myDepot?._id ?? "");
  const [rating, setRating] = useState(0);
  const [factureFile, setFactureFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const activeDepots = depots.filter((d) => d.status === "ACTIVE");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupplementary && !depotId) { setError("Veuillez sélectionner un dépôt"); return; }
    setSaving(true);
    setError("");
    try {
      const lines = order.lines
        .map((l) => ({ purchaseOrderLineId: l._id, receivedQuantity: qtys[l._id] ?? 0, acceptedQuantity: qtys[l._id] ?? 0 }))
        .filter((l) => l.receivedQuantity > 0);
      if (!lines.length) { setError("Veuillez saisir au moins une quantité reçue"); setSaving(false); return; }

      await purchaseReceiptService.create(
        {
          purchaseOrderId: order._id,
          ...(isSupplementary ? {} : { depotId }),
          lines,
          supplierRating: rating > 0 ? rating : undefined,
        },
        factureFile ?? undefined
      );
      onDone();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Réception — {order.orderNo}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {order.supplierId.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
          >
            <X size={13} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {error && (
            <p className="rounded-xl bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </p>
          )}

          {!isSupplementary && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Dépôt de réception <span className="text-rose-500">*</span>
              </label>
              {myDepot ? (
                <div className={inputCls + " flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 cursor-not-allowed"}>
                  <Package size={13} className="text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700 dark:text-slate-200">{myDepot.name}</span>
                  <span className="ml-auto rounded-lg bg-slate-200 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                    {myDepot.productTypeScope}
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    className={inputCls + " appearance-none pr-8"}
                    value={depotId}
                    onChange={(e) => setDepotId(e.target.value)}
                  >
                    <option value="">— Sélectionner un dépôt —</option>
                    {activeDepots.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.productTypeScope})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" />
                </div>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Quantités reçues
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/40">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Article</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500">Commandé</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500">Qté reçue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {order.lines.map((l) => {
                    const remaining = Math.max(0, l.quantity - (l.receivedQuantity || 0));
                    return (
                      <tr key={l._id}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {l.productId ? l.productId.name : l.description ?? "—"}
                          </p>
                          {l.productId && (
                            <p className="text-xs text-slate-400">{l.productId.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600 dark:text-slate-300">
                          {l.quantity}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            value={qtys[l._id] ?? 0}
                            onChange={(e) =>
                              setQtys((prev) => ({ ...prev, [l._id]: Number(e.target.value) }))
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Évaluation fournisseur
            </label>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Facture reçue avec le colis
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => setFactureFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <Paperclip size={14} />
              {factureFile ? factureFile.name : "Joindre la facture (PDF / image)"}
            </button>
            {factureFile && (
              <button
                type="button"
                onClick={() => setFactureFile(null)}
                className="mt-1 text-xs text-rose-500 hover:underline"
              >
                Supprimer
              </button>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              {saving ? "Enregistrement…" : "Confirmer la réception"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Create Return Modal ──────────────────────────────────────────────────────

function CreateReturnModal({
  receipt,
  onClose,
  onDone,
}: {
  receipt: PurchaseReceipt;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError("Le motif est obligatoire"); return; }
    setSaving(true);
    setError("");
    try {
      await purchaseReturnService.create({ receiptId: receipt._id, reason: reason.trim(), notes: notes.trim() });
      onDone();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Bon de retour — {receipt.receiptNo}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {receipt.supplierId.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
          >
            <X size={13} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {error && (
            <p className="rounded-xl bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </p>
          )}

          {/* Receipt lines summary */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="bg-slate-50 px-4 py-2.5 dark:bg-slate-950/40">
              <p className="text-xs font-medium text-slate-500">Articles réceptionnés (quantités totales)</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {receipt.lines.map((l) => (
                <div key={l._id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {l.productId ? l.productId.name : "Article sans référence"}
                    </p>
                    {l.productId && <p className="text-xs text-slate-400">{l.productId.sku}</p>}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ×{l.acceptedQuantity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Motif du retour <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ex: produit défectueux, erreur de livraison…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Notes internes
            </label>
            <textarea
              rows={3}
              className={inputCls + " resize-none"}
              placeholder="Informations complémentaires (optionnel)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              {saving ? "Création…" : "Créer le bon de retour"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Return action button ─────────────────────────────────────────────────────

function ReturnActionButton({
  ret,
  onAdvance,
}: {
  ret: PurchaseReturn;
  onAdvance: (id: string, status: "VALIDATED" | "SENT" | "CLOSED") => void;
}) {
  const [loading, setLoading] = useState(false);

  const actions: Record<string, { label: string; next: "VALIDATED" | "SENT" | "CLOSED"; cls: string }> = {
    VALIDATED: { label: "Marquer envoyé", next: "SENT", cls: "bg-amber-600 hover:bg-amber-700" },
    SENT: { label: "Clôturer", next: "CLOSED", cls: "bg-slate-600 hover:bg-slate-700" },
  };

  const action = actions[ret.status];
  if (!action) return null;

  const handle = async () => {
    setLoading(true);
    try {
      await onAdvance(ret._id, action.next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50 ${action.cls}`}
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : <ChevronRight size={11} />}
      {action.label}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StockDeliveriesPage() {
  const { user } = useAuth();
  const isDepotManager = user?.role === "DEPOT_MANAGER";

  const [tab, setTab] = useState<"pending" | "mine">("pending");

  // Pending deliveries
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [myDepot, setMyDepot] = useState<Depot | null>(null);
  const [loadingPending, setLoadingPending] = useState(true);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);

  // My receipts & returns
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [creatingReturnFor, setCreatingReturnFor] = useState<PurchaseReceipt | null>(null);

  const [error, setError] = useState("");

  const loadPending = async () => {
    try {
      setLoadingPending(true);
      setError("");
      const [ords, deps, mine] = await Promise.all([
        purchaseOrderService.getPendingDeliveries(),
        stockDepotService.getAll(),
        isDepotManager ? stockDepotService.getMine() : Promise.resolve(null),
      ]);
      setOrders(ords);
      setDepots(deps);
      setMyDepot(mine);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoadingPending(false);
    }
  };

  const loadMine = async () => {
    try {
      setLoadingMine(true);
      setError("");
      const [recs, rets] = await Promise.all([
        purchaseReceiptService.getMine(),
        purchaseReturnService.getMine(),
      ]);
      setReceipts(recs);
      setReturns(rets);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => { loadPending(); }, []);
  useEffect(() => { if (tab === "mine") loadMine(); }, [tab]);

  const returnByReceipt = new Map(returns.map((r) => [r.purchaseReceiptId._id, r]));

  const handleAdvanceReturn = async (id: string, status: "VALIDATED" | "SENT" | "CLOSED") => {
    await purchaseReturnService.updateStatus(id, status);
    await loadMine();
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER", "DEPOT_MANAGER"]}>
      {receiving && (
        <ReceiveModal
          order={receiving}
          depots={depots}
          myDepot={myDepot}
          onClose={() => setReceiving(null)}
          onDone={() => { setReceiving(null); loadPending(); }}
        />
      )}
      {creatingReturnFor && (
        <CreateReturnModal
          receipt={creatingReturnFor}
          onClose={() => setCreatingReturnFor(null)}
          onDone={() => { setCreatingReturnFor(null); loadMine(); }}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
            <Truck size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Réceptions
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isDepotManager
                ? "Gestion des réceptions et bons de retour"
                : "Vos livraisons et retours fournisseurs"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/60">
          <button
            onClick={() => setTab("pending")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === "pending"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Package size={14} />
            En attente
            {orders.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                {orders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("mine")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === "mine"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <ClipboardList size={14} />
            Mes réceptions
          </button>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* ── Tab: En attente ───────────────────────────────────────────────── */}
        {tab === "pending" && (
          <>
            {loadingPending ? (
              <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white py-16 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <Loader2 size={16} className="animate-spin" />
                Chargement…
              </div>
            ) : !orders.length ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900">
                <CheckCircle2 size={32} className="text-emerald-400 dark:text-emerald-600" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Aucune livraison en attente</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-950/40">
                      <tr>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">N° BC</th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">Fournisseur</th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">Articles</th>
                        <th className="px-5 py-3 text-right font-medium text-slate-500">Total TTC</th>
                        <th className="px-5 py-3 text-left font-medium text-slate-500">Envoyé le</th>
                        <th className="px-5 py-3 text-right font-medium text-slate-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {orders.map((order) => (
                        <tr key={order._id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {order.orderNo}
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-slate-900 dark:text-white">{order.supplierId.name}</p>
                            <p className="text-xs text-slate-400">{order.supplierId.supplierNo}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="space-y-0.5">
                              {order.lines.map((l) => (
                                <p key={l._id} className="text-xs text-slate-600 dark:text-slate-300">
                                  {l.productId ? l.productId.name : l.description ?? "—"}
                                  <span className="ml-1 text-slate-400">×{l.quantity}</span>
                                </p>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-slate-900 dark:text-white">
                            {fmt(order.totalTtc)} TND
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                            {order.sentAt ? new Date(order.sentAt).toLocaleDateString("fr-TN") : "—"}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setReceiving(order)}
                              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
                            >
                              <Truck size={12} />
                              Réceptionner
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!loadingPending && !isDepotManager && !myDepot && depots.filter((d) => d.status === "ACTIVE").length === 0 && (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400">
                <AlertTriangle size={14} />
                Aucun dépôt actif trouvé. Créez un dépôt avant de réceptionner.
              </div>
            )}
            {!loadingPending && isDepotManager && !myDepot && (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400">
                <AlertTriangle size={14} />
                Aucun dépôt ne vous est assigné. Contactez le gestionnaire de stock.
              </div>
            )}
          </>
        )}

        {/* ── Tab: Mes réceptions ───────────────────────────────────────────── */}
        {tab === "mine" && (
          <>
            {loadingMine ? (
              <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white py-16 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <Loader2 size={16} className="animate-spin" />
                Chargement…
              </div>
            ) : !receipts.length ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900">
                <ClipboardList size={32} className="text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Aucune réception enregistrée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map((receipt) => {
                  const ret = returnByReceipt.get(receipt._id);
                  const cfg = ret ? returnStatusConfig[ret.status] : null;
                  return (
                    <div
                      key={receipt._id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                    >
                      {/* Receipt header */}
                      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {receipt.receiptNo}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-sm text-slate-600 dark:text-slate-300">
                            {receipt.supplierId.name}
                          </span>
                          {receipt.purchaseOrderId && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="font-mono text-xs text-slate-400">
                                {receipt.purchaseOrderId.orderNo}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">
                            {new Date(receipt.createdAt).toLocaleDateString("fr-TN")}
                          </span>
                          {ret ? (
                            <div className="flex items-center gap-2">
                              <span className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${cfg?.cls}`}>
                                Retour {cfg?.label}
                              </span>
                              <ReturnActionButton ret={ret} onAdvance={handleAdvanceReturn} />
                            </div>
                          ) : (
                            <button
                              onClick={() => setCreatingReturnFor(receipt)}
                              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            >
                              <RotateCcw size={11} />
                              Créer un retour
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Receipt lines */}
                      <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
                        {receipt.lines.map((l) => (
                          <div key={l._id} className="flex items-center justify-between px-5 py-2.5">
                            <div>
                              <p className="text-sm text-slate-800 dark:text-slate-200">
                                {l.productId ? l.productId.name : "Article sans référence"}
                              </p>
                              {l.productId && (
                                <p className="text-xs text-slate-400">{l.productId.sku}</p>
                              )}
                            </div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              ×{l.acceptedQuantity} acceptés
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Return info if exists */}
                      {ret && (
                        <div className="border-t border-dashed border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <RotateCcw size={11} />
                            <span className="font-mono font-semibold">{ret.returnNo}</span>
                            <span>·</span>
                            <span>Motif : {ret.reason}</span>
                            {ret.totalTtc > 0 && (
                              <>
                                <span>·</span>
                                <span>Avoir : {fmt(ret.totalTtc)} TND</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
