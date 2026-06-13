"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { financeService, RsPayment } from "@/services/finance/financeService";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import { Loader2, Receipt } from "lucide-react";

function tnd(v: number | undefined | null) {
  return `${(v ?? 0).toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND`;
}

function getErrorMessage(err: unknown) {
  if (
    typeof err === "object" && err !== null &&
    "response" in err && typeof err.response === "object" && err.response !== null &&
    "data" in err.response && typeof err.response.data === "object" && err.response.data !== null &&
    "message" in err.response.data && typeof err.response.data.message === "string"
  ) return err.response.data.message;
  return "Échec du chargement";
}

const surface = "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Virement",
  CHECK: "Chèque",
  CASH: "Espèces",
};

export default function RsPage() {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<RsPayment[]>([]);
  const [totalRs, setTotalRs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const result = await financeService.getRsPayments();
        setPayments(result.payments);
        setTotalRs(result.totalRs);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Receipt size={18} className="text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("fin_rsTitle")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("fin_rsSubtitle")}
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        <div className={`${surface} p-5`}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("fin_rsTotalLabel")}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {tnd(totalRs)}
          </p>
        </div>

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400`}>
            <Loader2 size={16} className="animate-spin" />
            {t("fin_loading")}
          </div>
        ) : !payments.length ? (
          <div className={`${surface} flex flex-col items-center justify-center py-16`}>
            <Receipt size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-400 dark:text-slate-500">{t("fin_noRs")}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {t("fin_rsNote")}
            </p>
          </div>
        ) : (
          <div className={`${surface} overflow-hidden`}>
            <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-950 dark:text-white">{t("fin_rsDetail")}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/40">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_paymentNo")}</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_supplier")}</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_invoice")}</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_mode")}</th>
                    <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_date")}</th>
                    <th className="px-6 py-3 text-right font-medium text-slate-500">{t("fin_grossAmount")}</th>
                    <th className="px-6 py-3 text-right font-medium text-slate-500">{t("fin_rsRate")}</th>
                    <th className="px-6 py-3 text-right font-medium text-slate-500">{t("fin_rsRetained")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{p.paymentNo}</td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                        {p.supplierName}
                        {p.supplierNo ? <span className="ml-1 text-slate-400">({p.supplierNo})</span> : null}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{p.invoiceNo || "—"}</td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{METHOD_LABELS[p.method] || p.method}</td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                        {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("fr-TN") : "—"}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-900 dark:text-white">{tnd(p.amount)}</td>
                      <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">
                        {p.rsRate > 0 ? `${p.rsRate}%` : "—"}
                        {p.rsType ? <span className="ml-1 text-slate-400">({p.rsType})</span> : null}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-900 dark:text-white">{tnd(p.rsAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-950/40">
                  <tr>
                    <td colSpan={7} className="px-6 py-3 font-semibold text-slate-900 dark:text-white text-right">{t("fin_rsTotal")}</td>
                    <td className="px-6 py-3 text-right font-bold text-slate-900 dark:text-white">{tnd(totalRs)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
          <p className="font-medium">{t("fin_rsLegal")}</p>
          <p className="mt-1 text-xs">
            {t("fin_rsLegalText")}
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
