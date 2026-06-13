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

export default function PurchaseCalendarPage() {
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

  const totalOutflows = Object.values(days).reduce((s, d) => s + d.outflows, 0);

  const selectedData = selectedDay ? days[selectedDay] : null;

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      <div className="space-y-6">

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <CalendarDays size={18} className="text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Calendrier des achats
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Suivi des paiements fournisseurs par jour
            </p>
          </div>
        </div>

        {apiError && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {apiError}
          </div>
        )}

        {/* Monthly summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total dépenses du mois</p>
              <TrendingDown size={15} className="text-rose-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
              {tnd(totalOutflows)} <span className="text-base font-medium">{t("fin_tnd")}</span>
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Nombre de jours avec achats</p>
              <TrendingUp size={15} className="text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-700 dark:text-slate-300">
              {Object.values(days).filter((d) => d.outflows > 0).length} <span className="text-base font-medium text-slate-400">jours</span>
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

              const bg = d && d.outflows > 0 ? "bg-rose-50 dark:bg-rose-950/25" : "";

              return (
                <div
                  key={dateKey}
                  onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                  className={`min-h-[100px] cursor-pointer p-2 transition ${bg} ${isSelected ? "ring-2 ring-inset ring-slate-900 dark:ring-white" : "hover:brightness-95"}`}
                >
                  <div className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "text-slate-500 dark:text-slate-400"}`}>
                    {day}
                  </div>

                  {d && d.outflows > 0 ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-0.5 text-[10px] font-medium text-rose-500 dark:text-rose-400">
                        <span>↓</span>
                        <span>{tnd(d.outflows)}</span>
                      </div>
                      <div className="text-[10px] text-rose-400 dark:text-rose-500">
                        {d.outflowCount} paiement{d.outflowCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected day detail panel */}
        {selectedDay && selectedData && selectedData.outflows > 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 font-semibold text-slate-950 dark:text-white">
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("fr-TN", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-900/30 dark:bg-rose-950/20">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Dépenses du jour</p>
                <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-400">
                  {tnd(selectedData.outflows)} {t("fin_tnd")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nombre de paiements</p>
                <p className="mt-1 text-xl font-bold text-slate-700 dark:text-slate-300">
                  {selectedData.outflowCount} paiement{selectedData.outflowCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-rose-100 dark:bg-rose-950/50" />
            Jour avec paiements fournisseurs
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700" />
            Aucun achat ce jour
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
