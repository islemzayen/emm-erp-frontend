"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import {
  rmaService,
  type Rma,
} from "@/services/commercial/rmaService";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

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

function statusBadge(status: Rma["status"]) {
  const map: Record<Rma["status"], string> = {
    OPEN: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    RECEIVED: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    RESTOCKED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    DISPOSED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    CLOSED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  };
  return map[status];
}

function resolutionBadge(resolution: Rma["resolution"]) {
  const map: Record<Rma["resolution"], string> = {
    PENDING: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    RESTOCK: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    DESTROY: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return map[resolution];
}

export default function CommercialReturnsPage() {
  const { t } = useLanguage();
  const [rmas, setRmas] = useState<Rma[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showProcess, setShowProcess] = useState(false);
  const [selectedRma, setSelectedRma] = useState<Rma | null>(null);
  const [processResolution, setProcessResolution] = useState<"RESTOCK" | "DESTROY">("RESTOCK");
  const [processNotes, setProcessNotes] = useState("");

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const rmaData = await rmaService.getAll();
      setRmas(rmaData);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load returns"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return rmas.filter((rma) => {
      const matchesSearch =
        rma.rmaNo.toLowerCase().includes(query) ||
        rma.orderNo.toLowerCase().includes(query) ||
        rma.customerName.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "ALL" || rma.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rmas, search, statusFilter]);

  const kpis = useMemo(
    () => ({
      total: rmas.length,
      open: rmas.filter((rma) => rma.status === "OPEN").length,
      received: rmas.filter((rma) => rma.status === "RECEIVED").length,
      closed: rmas.filter((rma) => rma.status === "CLOSED").length,
    }),
    [rmas]
  );

  const runAction = async (
    action: "receive" | "close" | "cancel" | "process",
    id: string,
    payload?: { resolution: "RESTOCK" | "DESTROY"; notes?: string }
  ) => {
    try {
      setActionId(id);
      setError("");
      if (action === "receive") await rmaService.receive(id);
      if (action === "close") await rmaService.close(id);
      if (action === "cancel") await rmaService.cancel(id);
      if (action === "process" && payload) await rmaService.process(id, payload);
      await fetchAll();
    } catch (err: unknown) {
      setError(getErrorMessage(err, `Failed to ${action} return`));
    } finally {
      setActionId(null);
      setShowProcess(false);
      setSelectedRma(null);
      setProcessNotes("");
      setProcessResolution("RESTOCK");
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("commercialModule")} · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <RotateCcw size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {t("returnsRefunds")}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("returnsSub")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 shrink-0 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: t("total"), value: kpis.total, color: "text-slate-900 dark:text-white" },
            { label: t("pending"), value: kpis.open, color: "text-blue-700 dark:text-blue-400" },
            { label: t("received"), value: kpis.received, color: "text-amber-700 dark:text-amber-400" },
            { label: t("closed"), value: kpis.closed, color: "text-slate-700 dark:text-slate-300" },
          ].map((item) => (
            <div key={item.label} className={`${surface} px-6 py-5`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {item.label}
              </p>
              <p className={`mt-2 text-3xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-950 dark:text-white">
              {t("returnRequests")}
              <span className="ml-2 text-sm font-normal text-slate-400">{filtered.length}</span>
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchReturns")}
                  className="w-52 rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
              >
                <option value="ALL">{t("allStatus")}</option>
                <option value="OPEN">OPEN</option>
                <option value="RECEIVED">RECEIVED</option>
                <option value="RESTOCKED">RESTOCKED</option>
                <option value="DISPOSED">DISPOSED</option>
                <option value="CLOSED">{t("closed")}</option>
                <option value="CANCELLED">{t("cancelled")}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> {t("loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-sm text-slate-400">
              <RotateCcw size={32} className="opacity-30" />
              {t("noReturnsMatch")}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((rma) => {
                const busy = actionId === rma._id;
                return (
                  <div key={rma._id} className="px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{rma.rmaNo}</p>
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusBadge(rma.status)}`}>
                            {rma.status}
                          </span>
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${resolutionBadge(rma.resolution)}`}>
                            {rma.resolution}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {rma.orderNo} · {rma.customerName}
                        </p>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-3">
                          <p>
                            <span className="text-slate-400">{t("requests")}:</span> {rma.lines.length}
                          </p>
                          <p>
                            <span className="text-slate-400">{t("quantity")}:</span>{" "}
                            {rma.lines.reduce((sum, line) => sum + line.quantity, 0)}
                          </p>
                          <p>
                            <span className="text-slate-400">{t("date")}:</span>{" "}
                            {rma.createdAt ? new Date(rma.createdAt).toLocaleDateString("fr-TN") : "-"}
                          </p>
                        </div>
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full min-w-[500px] text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800">
                                <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                  {t("product")}
                                </th>
                                <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                  {t("quantity")}
                                </th>
                                <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                  {t("reason")}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {rma.lines.map((line, index) => (
                                <tr key={`${rma._id}-${index}`}>
                                  <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                                    {line.productId?.name || "-"}
                                    {line.productId?.sku ? (
                                      <span className="ml-1.5 text-[11px] text-slate-400">
                                        ({line.productId.sku})
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="py-2.5 text-slate-600 dark:text-slate-300">{line.quantity}</td>
                                  <td className="py-2.5 text-slate-500 dark:text-slate-400">
                                    {line.reason || "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:w-[230px] lg:justify-end">
                        {rma.status === "OPEN" ? (
                          <>
                            <button
                              onClick={() => runAction("receive", rma._id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={11} className="animate-spin" /> : <Archive size={11} />}
                              Receive
                            </button>
                            <button
                              onClick={() => runAction("cancel", rma._id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400"
                            >
                              <X size={11} /> {t("cancel")}
                            </button>
                          </>
                        ) : null}

                        {rma.status === "RECEIVED" ? (
                          <button
                            onClick={() => {
                              setSelectedRma(rma);
                              setShowProcess(true);
                              setProcessResolution("RESTOCK");
                              setProcessNotes(rma.notes || "");
                            }}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Archive size={11} /> {t("restockLabel")} / {t("destroyLabel")}
                          </button>
                        ) : null}

                        {["RESTOCKED", "DISPOSED"].includes(rma.status) ? (
                          <button
                            onClick={() => runAction("close", rma._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                          >
                            {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                            Close
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showProcess && selectedRma ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                    Process {selectedRma.rmaNo}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Choose whether returned items go back to stock or are destroyed
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowProcess(false);
                    setSelectedRma(null);
                    setProcessNotes("");
                    setProcessResolution("RESTOCK");
                  }}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className={labelClass}>{t("resolutionLabel")}</label>
                  <select
                    value={processResolution}
                    onChange={(e) => setProcessResolution(e.target.value as "RESTOCK" | "DESTROY")}
                    className={inputClass}
                  >
                    <option value="RESTOCK">{t("restockLabel")}</option>
                    <option value="DESTROY">{t("destroyLabel")}</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t("notes")}</label>
                  <textarea
                    rows={3}
                    value={processNotes}
                    onChange={(e) => setProcessNotes(e.target.value)}
                    className={`${inputClass} resize-none`}
                    placeholder={t("notesPlaceholder")}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                <button
                  onClick={() => {
                    setShowProcess(false);
                    setSelectedRma(null);
                    setProcessNotes("");
                    setProcessResolution("RESTOCK");
                  }}
                  className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() =>
                    runAction("process", selectedRma._id, {
                      resolution: processResolution,
                      notes: processNotes,
                    })
                  }
                  disabled={actionId === selectedRma._id}
                  className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${
                    processResolution === "RESTOCK"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {actionId === selectedRma._id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : processResolution === "RESTOCK" ? (
                    <Archive size={14} />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
