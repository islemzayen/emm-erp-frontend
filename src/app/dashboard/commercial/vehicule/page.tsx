"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { vehicleService, Vehicle } from "@/services/commercial/vehicleService";
import { commercialSettingService } from "@/services/commercial/commercialSettingService";
import { useRouter } from "next/navigation";
import {
  Car, Plus, Pencil, Power, ArrowRight,
  Weight, Package, CalendarDays, Clock, Loader2, Search, X, TrendingUp, Fuel,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-900/30";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

// ─── Durability helpers ────────────────────────────────────────────────────────
function calcDurabilityFromAgeDays(ageDays: number): number {
  if (ageDays < 365) return 50;
  if (ageDays <= 4 * 365) return 100;
  return Math.max(0, 100 - 0.07 * (ageDays - 4 * 365));
}

function calcDurability(purchaseDate: string): number {
  const ageDays = (Date.now() - new Date(purchaseDate).getTime()) / 86_400_000;
  return calcDurabilityFromAgeDays(Math.max(0, ageDays));
}

function durColor(pct: number) {
  if (pct >= 80) return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-400" };
  if (pct >= 50) return { bar: "bg-amber-400", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-400" };
  return { bar: "bg-red-500", text: "text-red-600 dark:text-red-400", ring: "ring-red-400" };
}

function ageStr(purchaseDate: string) {
  const ms = Date.now() - new Date(purchaseDate).getTime();
  const years = ms / (1000 * 60 * 60 * 24 * 365);
  if (years < 1) return `${Math.round(years * 12)} mois`;
  return `${years.toFixed(1)} ans`;
}


// ─── SVG Durability Curve ─────────────────────────────────────────────────────
function DurabilityCurve({ purchaseDate }: { purchaseDate: string }) {
  const W = 320, H = 130, PX = 36, PY = 16;
  const plotW = W - PX - 12, plotH = H - PY - 24;
  const maxDays = 10 * 365;

  const points: { x: number; y: number }[] = [];
  for (let d = 0; d <= maxDays; d += Math.max(1, Math.floor(maxDays / 200))) {
    const pct = calcDurabilityFromAgeDays(d);
    points.push({
      x: PX + (d / maxDays) * plotW,
      y: PY + plotH - (pct / 100) * plotH,
    });
  }
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  const ageDays = Math.min((Date.now() - new Date(purchaseDate).getTime()) / 86_400_000, maxDays);
  const curPct = calcDurabilityFromAgeDays(Math.max(0, ageDays));
  const curX = PX + (ageDays / maxDays) * plotW;
  const curY = PY + plotH - (curPct / 100) * plotH;
  const c = durColor(curPct);
  const strokeColor = c.bar === "bg-emerald-500" ? "#22c55e" : c.bar === "bg-amber-400" ? "#f59e0b" : "#ef4444";

  const yTicks = [0, 25, 50, 75, 100];
  const stepDays = maxDays <= 30 ? 5 : maxDays <= 180 ? 30 : maxDays <= 365 ? 60 : 365;
  const xLabels = Array.from({ length: Math.floor(maxDays / stepDays) + 1 }, (_, i) => i * stepDays).filter(
    (day) => day <= maxDays
  );

  return (
    <svg width={W} height={H} className="w-full">
      {/* Y grid */}
      {yTicks.map((pct) => {
        const y = PY + plotH - (pct / 100) * plotH;
        return (
          <g key={pct}>
            <line x1={PX} y1={y} x2={PX + plotW} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
            <text x={PX - 4} y={y + 3.5} fontSize={8} fill="currentColor" fillOpacity={0.4} textAnchor="end">{pct}</text>
          </g>
        );
      })}
      {/* X labels */}
      {xLabels.map((day) => (
        <text key={day} x={PX + (day / maxDays) * plotW} y={H - 4} fontSize={8} fill="currentColor" fillOpacity={0.35} textAnchor="middle">{day}j</text>
      ))}
      {/* Axes */}
      <line x1={PX} y1={PY} x2={PX} y2={PY + plotH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
      <line x1={PX} y1={PY + plotH} x2={PX + plotW} y2={PY + plotH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
      {/* Gradient fill */}
      <defs>
        <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${PX},${PY + plotH} ${polyline} ${PX + plotW},${PY + plotH}`}
        fill="url(#curveGrad)"
      />
      {/* Curve */}
      <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" />
      {/* Current marker */}
      <line x1={curX} y1={PY} x2={curX} y2={PY + plotH} stroke={strokeColor} strokeWidth={1.5} strokeDasharray="4,3" />
      <circle cx={curX} cy={curY} r={5} fill={strokeColor} fillOpacity={0.2} stroke={strokeColor} strokeWidth={2} />
      <circle cx={curX} cy={curY} r={2.5} fill={strokeColor} />
      {/* Tooltip */}
      <rect x={curX + 7} y={curY - 14} width={32} height={14} rx={4} fill={strokeColor} fillOpacity={0.15} />
      <text x={curX + 23} y={curY - 3} fontSize={9} fill={strokeColor} fontWeight="700" textAnchor="middle">
        {curPct.toFixed(0)}%
      </text>
    </svg>
  );
}

// ─── Durability ring ──────────────────────────────────────────────────────────
function DurabilityRing({ pct }: { pct: number }) {
  const r = 22, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const c = durColor(pct);
  const stroke = c.bar === "bg-emerald-500" ? "#22c55e" : c.bar === "bg-amber-400" ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
      <svg width={56} height={56} className="-rotate-90">
        <circle cx={28} cy={28} r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={5} />
        <circle
          cx={28} cy={28} r={r} fill="none"
          stroke={stroke} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={`absolute text-xs font-bold ${c.text}`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ─── Vehicle Card ─────────────────────────────────────────────────────────────
function VehicleCard({
  vehicle,
  onEdit,
  onToggle,
  onAdjust,
}: {
  vehicle: Vehicle;
  onEdit: (v: Vehicle) => void;
  onToggle: (v: Vehicle) => void;
  onAdjust: (v: Vehicle) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const durPct = calcDurability(vehicle.purchaseDate);
  const c = durColor(durPct);

  const barGradient =
    durPct >= 80 ? "from-emerald-400 to-emerald-500" :
    durPct >= 50 ? "from-amber-400 to-amber-500" :
                   "from-red-400 to-red-500";

  return (
    <div
      className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
      onClick={() => router.push(`/dashboard/commercial/vehicule/${vehicle._id}`)}
    >
      {/* Colored top accent */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${barGradient}`} />

      {/* Main body */}
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <DurabilityRing pct={durPct} />
            <div>
              <p className="text-lg font-bold tracking-widest text-slate-900 dark:text-white">
                {vehicle.matricule}
              </p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                vehicle.active
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}>
                {vehicle.active ? t("activeLabel") : t("inactiveLabel")}
              </span>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <button
              className="p-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-400 hover:text-indigo-600 transition-colors"
              onClick={() => onAdjust(vehicle)}
              title="Ajuster la durabilité"
            >
              <TrendingUp size={13} />
            </button>
            <button
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              onClick={() => onEdit(vehicle)}
              title={t("editAction")}
            >
              <Pencil size={13} />
            </button>
            <button
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              onClick={() => onToggle(vehicle)}
              title={vehicle.active ? t("deactivateAction") : t("activateAction")}
            >
              <Power size={13} />
            </button>
          </div>
        </div>

        {/* Info chips */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
            <Weight size={12} className="text-slate-400 shrink-0" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{vehicle.capacityKg} <span className="text-slate-400">kg</span></span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
            <Package size={12} className="text-slate-400 shrink-0" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{vehicle.capacityPackets} <span className="text-slate-400">colis</span></span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
            <Clock size={12} className="text-slate-400 shrink-0" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{ageStr(vehicle.purchaseDate)}</span>
          </div>
          {vehicle.fuelType ? (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
              <Fuel size={12} className="text-amber-500 shrink-0" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300 truncate">
                {vehicle.fuelType}{vehicle.fuelCapacityLiters ? ` · ${vehicle.fuelCapacityLiters}L` : ""}
              </span>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2" />
          )}
        </div>

        {/* Durability bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Durabilité</span>
            <span className={`text-xs font-bold ${c.text}`}>{durPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-2 rounded-full bg-gradient-to-r transition-all duration-500 ${barGradient}`}
              style={{ width: `${durPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-5 py-2.5">
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {new Date(vehicle.purchaseDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-indigo-500 group-hover:text-indigo-600 dark:text-indigo-400 transition-colors">
          Voir détails <ArrowRight size={11} />
        </span>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface FormState {
  matricule: string;
  capacityKg: string;
  capacityPackets: string;
  purchaseDate: string;
  fuelType: string;
  fuelCapacityLiters: string;
}

const EMPTY: FormState = {
  matricule: "",
  capacityKg: "",
  capacityPackets: "",
  purchaseDate: "",
  fuelType: "",
  fuelCapacityLiters: "",
};

function splitMatricule(value: string) {
  const match = value.trim().toUpperCase().match(/^(\d{0,3})\s*TU\s*(\d{0,4})$/);
  return {
    left: match?.[1] || "",
    right: match?.[2] || "",
  };
}

function buildMatricule(left: string, right: string) {
  return `${left} TU ${right}`.trim();
}

function VehicleModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Vehicle;
  onClose: () => void;
  onSave: (data: FormState) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          matricule: initial.matricule,
          capacityKg: String(initial.capacityKg),
          capacityPackets: String(initial.capacityPackets),
          purchaseDate: initial.purchaseDate.split("T")[0],
          fuelType: initial.fuelType || "",
          fuelCapacityLiters: String(initial.fuelCapacityLiters ?? ""),
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [fuelTypes, setFuelTypes] = useState<{ name: string }[]>([]);
  const matriculeParts = splitMatricule(form.matricule);

  useEffect(() => {
    commercialSettingService.get().then((s) => setFuelTypes(s.fuelTypes ?? [])).catch(() => {});
  }, []);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMatriculePart = (part: "left" | "right") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const numericValue = e.target.value.replace(/\D/g, "").slice(0, part === "left" ? 3 : 4);
      const nextLeft = part === "left" ? numericValue : matriculeParts.left;
      const nextRight = part === "right" ? numericValue : matriculeParts.right;

      setForm((p) => ({
        ...p,
        matricule: buildMatricule(nextLeft, nextRight),
      }));
    };


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await onSave(form);
      onClose();
    } catch (ex: unknown) {
      setErr((ex as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`${surface} w-full max-w-lg p-6 shadow-2xl`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {initial ? t("editVehicleTitle") : t("newVehicleTitle")}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Matricule */}
          <div>
            <label className={labelClass}>{t("licensePlate")}</label>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
              <input
                className={inputClass}
                placeholder="200"
                inputMode="numeric"
                maxLength={3}
                value={matriculeParts.left}
                onChange={setMatriculePart("left")}
                required
              />
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                TU
              </div>
              <input
                className={inputClass}
                placeholder="1234"
                inputMode="numeric"
                maxLength={4}
                value={matriculeParts.right}
                onChange={setMatriculePart("right")}
                required
              />
            </div>
          </div>

          {/* Capacities */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("capacityKgLabel")}</label>
              <input type="number" min={0} className={inputClass} value={form.capacityKg} onChange={set("capacityKg")} required />
            </div>
            <div>
              <label className={labelClass}>{t("capacityPacketsLabel2")}</label>
              <input type="number" min={0} className={inputClass} value={form.capacityPackets} onChange={set("capacityPackets")} required />
            </div>
          </div>

          {/* Purchase date */}
          <div>
            <label className={labelClass}>{t("purchaseDateLabel")}</label>
            <input
              type="date"
              className={inputClass}
              value={form.purchaseDate}
              onChange={set("purchaseDate")}
              required
            />
          </div>

          {/* Fuel type + capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Type de carburant</label>
              <select
                className={inputClass}
                value={form.fuelType}
                onChange={set("fuelType")}
              >
                <option value="">— Sélectionner —</option>
                {fuelTypes.map((ft) => (
                  <option key={ft.name} value={ft.name}>{ft.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Capacité réservoir (L)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                className={inputClass}
                value={form.fuelCapacityLiters}
                onChange={set("fuelCapacityLiters")}
                placeholder="ex: 60"
              />
            </div>
          </div>

          {err && <p className="text-xs text-red-500">{err}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Adjust Durability Modal ──────────────────────────────────────────────────
function AdjustDurabilityModal({
  vehicle,
  onClose,
  onSave,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onSave: (addPct: number, reason: string) => Promise<void>;
}) {
  const currentPct = calcDurability(vehicle.purchaseDate);
  const [addPct, setAddPct] = useState("10");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const parsed = Math.min(100, Math.max(0, Number(addPct) || 0));
  const newPct = Math.min(100, currentPct + parsed);
  const newColor = durColor(newPct);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setErr("La raison est obligatoire."); return; }
    if (parsed <= 0) { setErr("Le pourcentage doit être supérieur à 0."); return; }
    setSaving(true);
    setErr("");
    try {
      await onSave(parsed, reason.trim());
      onClose();
    } catch (ex: unknown) {
      setErr((ex as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`${surface} w-full max-w-sm p-6 shadow-2xl`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Ajuster la durabilité</h2>
            <p className="text-xs text-slate-400 mt-0.5">{vehicle.matricule}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>Pourcentage à ajouter (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              className={inputClass}
              value={addPct}
              onChange={(e) => setAddPct(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Raison</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Révision complète effectuée, remplacement des pièces..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-900/30"
            />
          </div>

          {/* Preview */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Avant</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{currentPct.toFixed(0)}%</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Ajout</span>
              <span className="font-semibold text-emerald-600">+{parsed}%</span>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-slate-700 dark:text-slate-200">Après</span>
                <span className={newColor.text}>{newPct.toFixed(0)}%</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={`h-2 rounded-full transition-all ${newColor.bar}`} style={{ width: `${newPct}%` }} />
              </div>
            </div>
          </div>

          {err && <p className="text-xs text-red-500">{err}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Confirmer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FleetPage() {
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vehicle | undefined>();
  const [adjusting, setAdjusting] = useState<Vehicle | undefined>();

  const load = async () => {
    try {
      const v = await vehicleService.getAll();
      setVehicles(v);
    }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = vehicles.filter((v) =>
    v.matricule.toLowerCase().includes(search.toLowerCase())
  );

  const totalActive = vehicles.filter((v) => v.active).length;
  const avgDur = vehicles.length
    ? Math.round(vehicles.reduce((s, v) => s + calcDurability(v.purchaseDate), 0) / vehicles.length)
    : 0;
  const atRisk = vehicles.filter((v) => calcDurability(v.purchaseDate) < 50).length;

  const openCreate = () => { setEditing(undefined); setShowModal(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setShowModal(true); };

  const handleSave = async (form: FormState) => {
    const payload = {
      matricule: form.matricule.trim().toUpperCase(),
      capacityKg: Number(form.capacityKg),
      capacityPackets: Number(form.capacityPackets),
      purchaseDate: form.purchaseDate,
      fuelType: form.fuelType,
      fuelCapacityLiters: form.fuelCapacityLiters ? Number(form.fuelCapacityLiters) : 0,
    };
    if (editing) {
      const updated = await vehicleService.update(editing._id, payload);
      setVehicles((p) => p.map((v) => (v._id === editing._id ? updated : v)));
    } else {
      const created = await vehicleService.create(payload);
      setVehicles((p) => [created, ...p]);
    }
  };

  const handleToggle = async (v: Vehicle) => {
    const updated = await vehicleService.toggleActive(v._id);
    setVehicles((p) => p.map((x) => (x._id === v._id ? updated : x)));
  };

  const handleAdjust = async (addPct: number, reason: string) => {
    if (!adjusting) return;
    const currentPct = calcDurability(adjusting.purchaseDate);
    const newPct = Math.min(100, currentPct + addPct);
    const date = new Date().toLocaleDateString("fr-TN");
    const noteEntry = `[${date}] +${addPct}% — ${reason}`;
    const existingNotes = adjusting.notes ? adjusting.notes.trim() : "";
    const updatedNotes = existingNotes ? `${existingNotes}\n${noteEntry}` : noteEntry;
    const updated = await vehicleService.update(adjusting._id, {
      durabilityPercent: newPct,
      notes: updatedNotes,
    });
    setVehicles((p) => p.map((x) => (x._id === adjusting._id ? updated : x)));
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("fleetTitle")}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{t("fleetSub")}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 shadow-sm dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          <Plus size={16} />
          {t("addVehicle")}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total véhicules", value: vehicles.length, icon: Car, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
          { label: "Actifs", value: totalActive, icon: Power, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
          { label: "Durabilité moy.", value: `${avgDur}%`, icon: Clock, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
          { label: "À risque (<50%)", value: atRisk, icon: Car, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
        ].map((k) => (
          <div key={k.label} className={`${surface} p-5 flex items-center gap-4`}>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${k.bg}`}>
              <k.icon size={20} className={k.color} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 dark:focus:border-indigo-500 transition"
          placeholder={t("searchByPlate")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-3 text-slate-400 py-8">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${surface} p-16 text-center`}>
          <Car size={36} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t("noVehicleFound")}</p>
          <button onClick={openCreate} className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            {t("addVehicle")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => (
            <VehicleCard key={v._id} vehicle={v} onEdit={openEdit} onToggle={handleToggle} onAdjust={(veh) => setAdjusting(veh)} />
          ))}
        </div>
      )}

      {showModal && (
        <VehicleModal
          initial={editing}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}

      {adjusting && (
        <AdjustDurabilityModal
          vehicle={adjusting}
          onClose={() => setAdjusting(undefined)}
          onSave={handleAdjust}
        />
      )}
    </div>
  );
}
