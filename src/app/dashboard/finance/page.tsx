"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { financeService, FinanceDashboardResponse, SalesReportMonth } from "@/services/finance/financeService";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  FileText,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
  Receipt,
  PieChart,
  Activity,
  Users,
} from "lucide-react";

function tnd(v: number) {
  return (v ?? 0).toLocaleString("fr-TN", { minimumFractionDigits: 3 });
}

function tndCompact(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

const MONTH_SHORT: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr",
  "05": "Mai", "06": "Jui", "07": "Jul", "08": "Aoû",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

// ─── Revenue area chart ───────────────────────────────────────────────────────
function RevenueChart({ data, noDataLabel }: { data: SalesReportMonth[]; noDataLabel: string }) {
  const W = 700, H = 220, padL = 56, padR = 16, padT = 16, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const values = data.map((d) => d.totalTtc);
  const maxVal = Math.max(...values, 1);

  const xScale = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * innerW;
  const yScale = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.totalTtc), v: d.totalTtc }));

  const linePath = points.length < 2 ? "" : points.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }, "");

  const areaPath = linePath
    ? `${linePath} L${points[points.length - 1].x},${padT + innerH} L${points[0].x},${padT + innerH} Z`
    : "";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    v: maxVal * f,
    y: yScale(maxVal * f),
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        {noDataLabel}
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 220 }}>
      <defs>
        <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid lines + y-axis labels */}
      {yTicks.map((t) => (
        <g key={t.v}>
          <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
          <text x={padL - 8} y={t.y + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.45">
            {tndCompact(t.v)}
          </text>
        </g>
      ))}

      {/* area fill */}
      {areaPath && <path d={areaPath} fill="url(#rev-grad)" />}

      {/* line */}
      {linePath && (
        <path d={linePath} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* dots + month labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#0ea5e9" stroke="white" strokeWidth="2" />
          <text x={p.x} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.5">
            {MONTH_SHORT[data[i].month.slice(5, 7)] ?? data[i].month.slice(5, 7)}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Donut chart (receivables vs payables) ────────────────────────────────────
function CashHealthDonut({ receivables, payables }: { receivables: number; payables: number }) {
  const total = receivables + payables;
  if (total <= 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Aucune donnée
      </div>
    );
  }
  const recPct = receivables / total;
  const r = 60, cx = 90, cy = 90;
  const c = 2 * Math.PI * r;
  const dashRec = c * recPct;
  const dashPay = c * (1 - recPct);

  return (
    <div className="flex items-center gap-6">
      <svg width="180" height="180" viewBox="0 0 180 180" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fb7185" strokeWidth="22" />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#10b981"
          strokeWidth="22"
          strokeDasharray={`${dashRec} ${dashPay}`}
          strokeDashoffset={c / 4}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="13" fill="currentColor" fillOpacity="0.5" fontWeight="600">Solde</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="14" fontWeight="700" fill={receivables - payables >= 0 ? "#059669" : "#dc2626"}>
          {(receivables - payables >= 0 ? "+" : "−") + tndCompact(Math.abs(receivables - payables))}
        </text>
      </svg>

      <div className="flex flex-col gap-3 flex-1">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Créances clients
          </div>
          <p className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {tnd(receivables)} <span className="text-xs text-slate-400">TND</span>
          </p>
          <p className="text-[11px] text-slate-400">{(recPct * 100).toFixed(1)}% du total</p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
            Dettes fournisseurs
          </div>
          <p className="mt-0.5 text-lg font-bold text-rose-600 dark:text-rose-400">
            {tnd(payables)} <span className="text-xs text-slate-400">TND</span>
          </p>
          <p className="text-[11px] text-slate-400">{((1 - recPct) * 100).toFixed(1)}% du total</p>
        </div>
      </div>
    </div>
  );
}

export default function FinanceDashboardPage() {
  const { t } = useLanguage();
  const [dashboard, setDashboard] = useState<FinanceDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesData, setSalesData] = useState<SalesReportMonth[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const ENTRY_LABELS: Record<string, string> = {
    INVOICE_ISSUED: t("fin_entryInvoiceIssued"),
    REGLEMENT_RECU: t("fin_entryPaymentReceived"),
    PAYABLE_RECORDED: t("fin_entrySupplierInvoice"),
    PAYABLE_PAYMENT: t("fin_entrySupplierPayment"),
    PAYABLE_CREDIT: t("fin_entryCreditNote"),
    MANUAL_ENTRY: t("fin_entryManual"),
  };

  const fetchAll = async () => {
    setError("");
    try {
      const d = await financeService.getDashboard();
      setDashboard(d);
      const to = new Date();
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const fmt = (dd: Date) => dd.toISOString().slice(0, 10);
      const r = await financeService.getSalesReport(fmt(from), fmt(to));
      setSalesData(r.byMonth);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err?.response?.data?.message || "Échec du chargement");
    }
  };

  useEffect(() => {
    setLoading(true);
    void fetchAll().finally(() => { setLoading(false); setSalesLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const totals = dashboard?.totals;
  const creances = totals?.totalReceivables ?? 0;
  const dettes   = totals?.totalPayablesOutstanding ?? 0;
  const net      = creances - dettes;

  const lastSalesValue   = salesData[salesData.length - 1]?.totalTtc ?? 0;
  const prevSalesValue   = salesData[salesData.length - 2]?.totalTtc ?? 0;
  const salesDeltaPct    = prevSalesValue > 0 ? ((lastSalesValue - prevSalesValue) / prevSalesValue) * 100 : 0;
  const totalRevenueLast12 = useMemo(() => salesData.reduce((s, m) => s + m.totalTtc, 0), [salesData]);

  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // KPI tiles
  const heroKpis = [
    {
      label: "Créances clients",
      sub: "À encaisser",
      value: creances,
      icon: <ArrowUpRight size={16} />,
      accent: "emerald",
      href: "/dashboard/finance/receivables",
    },
    {
      label: "Encaissé clients",
      sub: "Trésorerie reçue",
      value: totals?.totalCollected ?? 0,
      icon: <Receipt size={16} />,
      accent: "blue",
      href: "/dashboard/finance/receivables",
    },
    {
      label: "Dettes fournisseurs",
      sub: "À régler",
      value: dettes,
      icon: <ArrowDownLeft size={16} />,
      accent: "rose",
      href: "/dashboard/finance/payables",
    },
    {
      label: "Décaissements",
      sub: "Total payé",
      value: totals?.totalPaidOut ?? 0,
      icon: <Wallet size={16} />,
      accent: "amber",
      href: "/dashboard/finance/payables",
    },
  ];

  const accentMap: Record<string, { iconBg: string; iconColor: string; chipBg: string; chipColor: string }> = {
    emerald: {
      iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      chipBg: "bg-emerald-50 dark:bg-emerald-950/40",
      chipColor: "text-emerald-600 dark:text-emerald-400",
    },
    blue: {
      iconBg: "bg-blue-50 dark:bg-blue-950/40",
      iconColor: "text-blue-600 dark:text-blue-400",
      chipBg: "bg-blue-50 dark:bg-blue-950/40",
      chipColor: "text-blue-600 dark:text-blue-400",
    },
    rose: {
      iconBg: "bg-rose-50 dark:bg-rose-950/40",
      iconColor: "text-rose-600 dark:text-rose-400",
      chipBg: "bg-rose-50 dark:bg-rose-950/40",
      chipColor: "text-rose-600 dark:text-rose-400",
    },
    amber: {
      iconBg: "bg-amber-50 dark:bg-amber-950/40",
      iconColor: "text-amber-600 dark:text-amber-400",
      chipBg: "bg-amber-50 dark:bg-amber-950/40",
      chipColor: "text-amber-600 dark:text-amber-400",
    },
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              EMM ERP · Finance
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("fin_dashTitle")}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 capitalize">
              Vue d&apos;ensemble · {currentMonth} · Exercice {currentYear}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <CalendarDays size={12} />
              Mis à jour {timeAgo(lastRefresh.toISOString())}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              Actualiser
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white py-24 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            <Loader2 size={16} className="animate-spin" /> {t("fin_loading")}
          </div>
        ) : (
          <>
            {/* ── Overdue alert ── */}
            {(totals?.overduePayables ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/50">
                  <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                    {totals?.overduePayables} facture{(totals?.overduePayables ?? 0) > 1 ? "s" : ""} fournisseur en retard
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400/80">
                    {t("fin_resolveOverdue")}
                  </p>
                </div>
                <Link
                  href="/dashboard/finance/payables"
                  className="shrink-0 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
                >
                  {t("fin_seeMore")}
                </Link>
              </div>
            )}

            {/* ── KPI row ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {heroKpis.map((k) => {
                const accent = accentMap[k.accent];
                return (
                  <Link
                    key={k.label}
                    href={k.href}
                    className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${accent.iconBg}`}>
                        <span className={accent.iconColor}>{k.icon}</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${accent.chipBg} ${accent.chipColor}`}>
                        {k.sub}
                      </span>
                    </div>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      {k.label}
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                      {tnd(k.value)}
                      <span className="ml-1 text-xs font-medium text-slate-400">TND</span>
                    </p>
                    <div className={`absolute inset-x-0 bottom-0 h-1 ${accent.iconBg.replace("/40", "/80")} opacity-0 transition group-hover:opacity-100`} />
                  </Link>
                );
              })}
            </div>

            {/* ── Mid row: Revenue chart + Cash health donut ── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Chiffre d&apos;affaires</h2>
                      {salesLoading && <Loader2 size={12} className="animate-spin text-slate-400" />}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">12 derniers mois</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total période</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-950 dark:text-white">
                      {tnd(totalRevenueLast12)} <span className="text-xs font-medium text-slate-400">TND</span>
                    </p>
                    {salesDeltaPct !== 0 && (
                      <p className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold ${
                        salesDeltaPct >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {salesDeltaPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(salesDeltaPct).toFixed(1)}% mois précédent
                      </p>
                    )}
                  </div>
                </div>
                <RevenueChart data={salesData} noDataLabel={t("fin_noSalesData")} />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-2">
                  <PieChart size={15} className="text-slate-400" />
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">Santé trésorerie</h2>
                </div>
                <CashHealthDonut receivables={creances} payables={dettes} />
              </div>
            </div>

            {/* ── Secondary metrics row ── */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {[
                {
                  label: "Position nette",
                  value: (net >= 0 ? "+" : "−") + tnd(Math.abs(net)),
                  unit: "TND",
                  sub: net >= 0 ? "Solde positif" : "Solde négatif",
                  icon: net >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />,
                  valueColor: net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                  iconBg: net >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",
                },
                {
                  label: "CA reconnu",
                  value: tnd(totals?.recognizedRevenue ?? 0),
                  unit: "TND",
                  sub: "Factures émises",
                  icon: <BarChart3 size={14} />,
                  iconBg: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400",
                },
                {
                  label: "Total salaires",
                  value: tnd(totals?.totalSalary ?? 0),
                  unit: "TND",
                  sub: `${totals?.salariedEmployees ?? 0} employé${(totals?.salariedEmployees ?? 0) > 1 ? "s" : ""} · masse mensuelle`,
                  icon: <Users size={14} />,
                  iconBg: "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
                  valueColor: "text-violet-700 dark:text-violet-300",
                },
                {
                  label: "Trésorerie nette",
                  value: tnd(totals?.netExpectedCash ?? 0),
                  unit: "TND",
                  sub: "Encaissable",
                  icon: <Wallet size={14} />,
                  iconBg: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
                },
                {
                  label: "Factures en retard",
                  value: String(totals?.overduePayables ?? 0),
                  unit: "",
                  sub: (totals?.overduePayables ?? 0) > 0 ? "Action requise" : "À jour",
                  icon: <AlertTriangle size={14} />,
                  iconBg: (totals?.overduePayables ?? 0) > 0
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500",
                  valueColor: (totals?.overduePayables ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : undefined,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-2xl ${item.iconBg}`}>
                    {item.icon}
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className={`mt-1 text-xl font-bold tracking-tight ${item.valueColor ?? "text-slate-950 dark:text-white"}`}>
                    {item.value}
                    {item.unit && <span className="ml-1 text-xs font-medium text-slate-400">{item.unit}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.sub}</p>
                </div>
              ))}
            </div>

            {/* ── Recent activity ── */}
            {(dashboard?.recentEntries?.length ?? 0) > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Activity size={15} className="text-slate-400" />
                    <div>
                      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Activité récente</h2>
                      <p className="text-xs text-slate-400">Dernières écritures comptables</p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard/finance/journal"
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {t("fin_seeJournal")} →
                  </Link>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
                  {dashboard!.recentEntries.slice(0, 8).map((entry) => {
                    const isIn  = entry.direction === "INFLOW";
                    const isOut = entry.direction === "OUTFLOW";
                    return (
                      <div key={entry._id} className="flex items-center gap-4 px-6 py-3.5 transition hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          isIn  ? "bg-emerald-50 dark:bg-emerald-950/40"
                          : isOut ? "bg-rose-50 dark:bg-rose-950/40"
                          : "bg-slate-100 dark:bg-slate-800"
                        }`}>
                          {isIn  ? <ArrowUpRight  size={16} className="text-emerald-600 dark:text-emerald-400" />
                          : isOut ? <ArrowDownLeft size={16} className="text-rose-600 dark:text-rose-400" />
                                  : <FileText      size={16} className="text-slate-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {entry.counterpartyName || entry.reference}
                          </p>
                          <p className="text-xs text-slate-400">
                            {ENTRY_LABELS[entry.entryType] ?? entry.entryType}
                            {entry.reference && entry.counterpartyName ? ` · ${entry.reference}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${
                            isIn  ? "text-emerald-600 dark:text-emerald-400"
                            : isOut ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-700 dark:text-slate-300"
                          }`}>
                            {isIn ? "+" : isOut ? "−" : ""}{tnd(entry.amount)} TND
                          </p>
                          <p className="text-[11px] text-slate-400">{timeAgo(entry.occurredAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
