"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { financeService, TreasuryResponse } from "@/services/finance/financeService";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, Wallet } from "lucide-react";

function getErrorMessage(err: unknown) {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof err.response === "object" &&
    err.response !== null &&
    "data" in err.response &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    "message" in err.response.data &&
    typeof err.response.data.message === "string"
  ) {
    return err.response.data.message;
  }
  return "Failed to load treasury";
}

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

export default function FinanceTreasuryPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<TreasuryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        setData(await financeService.getTreasury());
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summary = data?.summary;

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{t("fin_treasTitle")}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("fin_treasSubtitle")}
          </p>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400`}>
            <Loader2 size={16} className="animate-spin" />
            {t("fin_loadingTreasury")}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                { label: t("fin_actualDisbursements"), value: summary?.actualOutflows || 0 },
                { label: t("fin_expectedInflowsLabel"), value: summary?.expectedInflows || 0 },
                { label: t("fin_openPayables"), value: summary?.openPayables || 0 },
                { label: t("fin_openReceivables"), value: summary?.openReceivables || 0 },
                { label: t("fin_next30Days"), value: summary?.next30DaysSupplierDue || 0 },
              ].map((item) => (
                <div key={item.label} className={`${surface} p-5`}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                    {item.value.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} {t("fin_tnd")}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className={`${surface} overflow-hidden`}>
                <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <h2 className="font-semibold text-slate-950 dark:text-white">{t("fin_cashMovements")}</h2>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.cashMovements?.length ? (
                    data.cashMovements.map((movement) => (
                      <div key={`${movement.direction}-${movement._id}`} className="flex items-center justify-between gap-4 px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                            {movement.direction === "INFLOW" ? (
                              <ArrowUpRight size={16} className="text-emerald-500" />
                            ) : (
                              <ArrowDownRight size={16} className="text-rose-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{movement.reference}</p>
                            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{movement.counterparty}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {movement.amount.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} {t("fin_tnd")}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {movement.method} · {movement.date ? new Date(movement.date).toLocaleDateString("fr-TN") : "-"}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-sm text-slate-400 dark:text-slate-500">
                      <Wallet size={28} className="mb-3 text-slate-300 dark:text-slate-700" />
                      {t("fin_noCashMovements")}
                    </div>
                  )}
                </div>
              </div>

              <div className={`${surface} overflow-hidden`}>
                <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <h2 className="font-semibold text-slate-950 dark:text-white">{t("fin_recentEntries")}</h2>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.recentEntries?.length ? (
                    data.recentEntries.map((entry) => (
                      <div key={entry._id} className="flex items-center justify-between gap-4 px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{entry.reference || entry.sourceType}</p>
                          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                            {entry.counterpartyName || entry.notes}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {entry.amount.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} {t("fin_tnd")}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">{entry.entryType}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-sm text-slate-400 dark:text-slate-500">
                      {t("fin_noEntries")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
