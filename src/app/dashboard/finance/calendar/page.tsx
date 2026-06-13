"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { financeService, type CalendarDay } from "@/services/finance/financeService";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, TrendingDown, TrendingUp } from "lucide-react";

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function tnd(v: number) {
  return Math.abs(v).toLocaleString("fr-TN", { minimumFractionDigits: 3 });
}

function netLabel(net: number) {
  if (net === 0) return "0,000";
  return (net > 0 ? "+" : "−") + tnd(net);
}

export default function FinanceCalendarPage() {
  const { t } = useLanguage();
  const DAYS = t("fin_calDays").split(",");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<Record<string, CalendarDay>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setApiError("");
    financeService.getCalendar(year, month).then((res) => {
      if (!cancelled) { setDays(res.days); setLoading(false); }
    }).catch((err) => {
      if (!cancelled) {
        setLoading(false);
        const msg = err?.response?.data?.message || err?.message || t("fin_calError");
        setApiError(msg);
      }
    });
    return () => { cancelled = true; };
  }, [year, month, t]);

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  const firstWeekDay = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayKey = now.toISOString().slice(0, 10);

  const cells: (number | null)[] = [
    ...Array(firstWeekDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const totalInflows = Object.values(days).reduce((s, d) => s + d.inflows, 0);
  const totalOutflows = Object.values(days).reduce((s, d) => s + d.outflows, 0);
  const totalNet = totalInflows - totalOutflows;

  const selectedData = selectedDay ? days[selectedDay] : null;

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <CalendarDays size={18} className="text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("fin_calTitle")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("fin_calSubtitle")}
            </p>
          </div>
        </div>

        {apiError && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {apiError}
          </div>
        )}

        {/* Monthly summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("fin_calInflows")}</p>
              <TrendingUp size={15} className="text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              +{tnd(totalInflows)} <span className="text-base font-medium">{t("fin_tnd")}</span>
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("fin_calOutflows")}</p>
              <TrendingDown size={15} className="text-rose-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
              −{tnd(totalOutflows)} <span className="text-base font-medium">{t("fin_tnd")}</span>
            </p>
          </div>
          <div className={`rounded-3xl border p-5 shadow-sm ${totalNet >= 0 ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20" : "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20"}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("fin_calNet")}</p>
            <p className={`mt-2 text-2xl font-bold ${totalNet >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {netLabel(totalNet)} <span className="text-base font-medium">{t("fin_tnd")}</span>
            </p>
          </div>
        </div>

        {/* Calendar */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

          {/* Month nav */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <button
              onClick={prevMonth}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                {MONTHS_FR[month - 1]} {year}
              </h2>
            </div>
            <button
              onClick={nextMonth}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
            {cells.map((day, idx) => {
              if (!day) {
                return <div key={`e${idx}`} className="min-h-[100px] bg-slate-50/50 dark:bg-slate-950/20" />;
              }

              const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const d = days[dateKey];
              const isToday = dateKey === todayKey;
              const isSelected = selectedDay === dateKey;

              let bg = "";
              let netColor = "text-slate-400";
              if (d) {
                if (d.net > 0)      { bg = "bg-emerald-50 dark:bg-emerald-950/25"; netColor = "text-emerald-700 dark:text-emerald-400"; }
                else if (d.net < 0) { bg = "bg-rose-50 dark:bg-rose-950/25";       netColor = "text-rose-600 dark:text-rose-400"; }
                else                { bg = "bg-amber-50 dark:bg-amber-950/20";      netColor = "text-amber-600 dark:text-amber-400"; }
              }

              return (
                <div
                  key={dateKey}
                  onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                  className={`min-h-[100px] cursor-pointer p-2 transition ${bg} ${isSelected ? "ring-2 ring-inset ring-slate-900 dark:ring-white" : "hover:brightness-95"}`}
                >
                  <div className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 dark:text-slate-400"}`}>
                    {day}
                  </div>

                  {d ? (
                    <div className="space-y-0.5">
                      {d.inflows > 0 && (
                        <div className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          <span>↑</span>
                          <span>{tnd(d.inflows)}</span>
                        </div>
                      )}
                      {d.outflows > 0 && (
                        <div className="flex items-center gap-0.5 text-[10px] font-medium text-rose-500 dark:text-rose-400">
                          <span>↓</span>
                          <span>{tnd(d.outflows)}</span>
                        </div>
                      )}
                      <div className={`text-[11px] font-bold ${netColor}`}>
                        {netLabel(d.net)} {t("fin_tnd")}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected day detail panel */}
        {selectedDay && selectedData && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 font-semibold text-slate-950 dark:text-white">
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("fr-TN", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t("fin_calInflows")}</p>
                <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  +{tnd(selectedData.inflows)} {t("fin_tnd")}
                </p>
                <p className="mt-0.5 text-xs text-emerald-600/70 dark:text-emerald-500">
                  {selectedData.inflowCount} {selectedData.inflowCount !== 1 ? t("fin_calPayments") : t("fin_calPayment")} {t("fin_calReceived")}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-900/30 dark:bg-rose-950/20">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">{t("fin_calOutflows")}</p>
                <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-400">
                  −{tnd(selectedData.outflows)} {t("fin_tnd")}
                </p>
                <p className="mt-0.5 text-xs text-rose-600/70 dark:text-rose-500">
                  {selectedData.outflowCount} {selectedData.outflowCount !== 1 ? t("fin_calPayments") : t("fin_calPayment")}
                </p>
              </div>
              <div className={`rounded-2xl border p-4 ${selectedData.net >= 0 ? "border-emerald-100 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/20" : "border-rose-100 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-950/20"}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t("fin_calNetDay")}</p>
                <p className={`mt-1 text-xl font-bold ${selectedData.net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                  {netLabel(selectedData.net)} {t("fin_tnd")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-emerald-100 dark:bg-emerald-950/50" />
            {t("fin_calPositiveTip")}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-rose-100 dark:bg-rose-950/50" />
            {t("fin_calNegativeTip")}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-amber-100 dark:bg-amber-950/50" />
            {t("fin_calBalanced")}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
