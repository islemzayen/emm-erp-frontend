"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { commercialSettingService, type CommercialSetting, type FuelTypeConfig } from "@/services/commercial/commercialSettingService";
import { useEffect, useState } from "react";
import { FileText, Fuel, Loader2, Plus, Save, Settings, Trash2, Truck } from "lucide-react";

const fmt = (v?: string) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-teal-950/30";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

type SkuDraft = { prefix: string; padding: string };

export default function CommercialSettingsPage() {
  const [setting, setSetting] = useState<CommercialSetting | null>(null);
  const [order, setOrder] = useState<SkuDraft>({ prefix: "ORD", padding: "3" });
  const [plan, setPlan]   = useState<SkuDraft>({ prefix: "PLAN", padding: "1" });
  const [bl, setBl]       = useState<SkuDraft>({ prefix: "BL", padding: "3" });
  const [fuelTypes, setFuelTypes] = useState<FuelTypeConfig[]>([]);
  const [newFT, setNewFT] = useState<{ name: string; pricePerLiter: string; consumptionPer100Km: string }>({
    name: "", pricePerLiter: "", consumptionPer100Km: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    commercialSettingService.get()
      .then((data) => {
        setSetting(data);
        setOrder({ prefix: data.orderPrefix ?? "ORD", padding: String(data.orderPadding ?? 3) });
        setPlan({ prefix: data.planPrefix  ?? "PLAN", padding: String(data.planPadding  ?? 1) });
        setBl({ prefix: data.blPrefix    ?? "BL",   padding: String(data.blPadding    ?? 3) });
        setFuelTypes(data.fuelTypes ?? []);
      })
      .catch(() => setError("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const oPad   = Number(order.padding);
    const planPad = Number(plan.padding);
    const blPad  = Number(bl.padding);

    if (!order.prefix || !plan.prefix || !bl.prefix) {
      setError("Les préfixes ne peuvent pas être vides"); return;
    }
    if ([oPad, planPad, blPad].some((p) => !Number.isInteger(p) || p < 1 || p > 8)) {
      setError("Le padding doit être un entier entre 1 et 8"); return;
    }

    setSaving(true); setError(""); setSuccess("");
    try {
      const updated = await commercialSettingService.update({
        orderPrefix:  order.prefix.toUpperCase(),
        orderPadding: oPad,
        planPrefix:   plan.prefix.toUpperCase(),
        planPadding:  planPad,
        blPrefix:     bl.prefix.toUpperCase(),
        blPadding:    blPad,
        fuelTypes,
      });
      setSetting(updated);
      setSuccess("Paramètres enregistrés.");
    } catch {
      setError("Échec de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const preview = (prefix: string, padding: string, suffix = "") => {
    const n = String(1).padStart(Math.max(1, Number(padding) || 1), "0");
    return `${prefix || "?"}-${n}${suffix}`;
  };

  const skuCards = [
    {
      key: "order",
      label: "Commandes",
      description: "Numérotation des bons de commande",
      icon: <FileText size={16} />,
      iconBg: "bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400",
      draft: order,
      setDraft: setOrder,
      suffix: "",
    },
    {
      key: "plan",
      label: "Plans de livraison",
      description: "Numérotation des plans de livraison",
      icon: <Truck size={16} />,
      iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400",
      draft: plan,
      setDraft: setPlan,
      suffix: "",
    },
    {
      key: "bl",
      label: "Bons de livraison",
      description: "Numérotation des bons de livraison",
      icon: <FileText size={16} />,
      iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
      draft: bl,
      setDraft: setBl,
      suffix: "",
    },
  ];

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Settings size={18} className="text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Paramètres <span className="text-teal-500">Commercial</span>
            </h1>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              EMM ERP · Commercial
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <div className="space-y-6">
            {/* SKU section */}
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Numérotation des documents</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {skuCards.map((card) => (
                  <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg}`}>
                        {card.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{card.label}</p>
                        <p className="text-[11px] text-slate-400">{card.description}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Préfixe</label>
                        <input
                          className={inputClass}
                          value={card.draft.prefix}
                          maxLength={10}
                          onChange={(e) => { card.setDraft((d) => ({ ...d, prefix: e.target.value.toUpperCase() })); setSuccess(""); }}
                          placeholder="ex: ORD"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Chiffres (padding)</label>
                        <input
                          type="number"
                          min={1}
                          max={8}
                          className={inputClass}
                          value={card.draft.padding}
                          onChange={(e) => { card.setDraft((d) => ({ ...d, padding: e.target.value })); setSuccess(""); }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">Aperçu</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {preview(card.draft.prefix, card.draft.padding, card.suffix)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fuel types section */}
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Types de carburant</p>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_140px_160px_40px] gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Type</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Prix / litre (TND)</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Conso. (L / 100 km)</p>
                  <span />
                </div>

                {/* Existing types */}
                {fuelTypes.length === 0 && (
                  <p className="px-5 py-4 text-xs italic text-slate-400 dark:text-slate-500">Aucun type défini</p>
                )}
                {fuelTypes.map((ft, i) => (
                  <div key={i} className="grid grid-cols-[1fr_140px_160px_40px] gap-3 items-center px-5 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <input
                      className={inputClass}
                      value={ft.name}
                      onChange={(e) => { setFuelTypes((prev) => prev.map((t, j) => j === i ? { ...t, name: e.target.value } : t)); setSuccess(""); }}
                      placeholder="ex: Diesel"
                    />
                    <input
                      type="number" min={0} step="0.001"
                      className={inputClass}
                      value={ft.pricePerLiter}
                      onChange={(e) => { setFuelTypes((prev) => prev.map((t, j) => j === i ? { ...t, pricePerLiter: Number(e.target.value) } : t)); setSuccess(""); }}
                      placeholder="ex: 2.295"
                    />
                    <input
                      type="number" min={0} step="0.1"
                      className={inputClass}
                      value={ft.consumptionPer100Km}
                      onChange={(e) => { setFuelTypes((prev) => prev.map((t, j) => j === i ? { ...t, consumptionPer100Km: Number(e.target.value) } : t)); setSuccess(""); }}
                      placeholder="ex: 8.5"
                    />
                    <button
                      type="button"
                      onClick={() => { setFuelTypes((prev) => prev.filter((_, j) => j !== i)); setSuccess(""); }}
                      className="flex items-center justify-center rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {/* Add new row */}
                <div className="grid grid-cols-[1fr_140px_160px_40px] gap-3 items-center border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-5 py-3">
                  <input
                    className={inputClass}
                    placeholder="Nouveau type..."
                    value={newFT.name}
                    onChange={(e) => setNewFT((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    type="number" min={0} step="0.001"
                    className={inputClass}
                    placeholder="Prix/L"
                    value={newFT.pricePerLiter}
                    onChange={(e) => setNewFT((p) => ({ ...p, pricePerLiter: e.target.value }))}
                  />
                  <input
                    type="number" min={0} step="0.1"
                    className={inputClass}
                    placeholder="L/100km"
                    value={newFT.consumptionPer100Km}
                    onChange={(e) => setNewFT((p) => ({ ...p, consumptionPer100Km: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const name = newFT.name.trim();
                      if (!name) return;
                      setFuelTypes((p) => [...p, {
                        name,
                        pricePerLiter: Math.max(0, Number(newFT.pricePerLiter) || 0),
                        consumptionPer100Km: Math.max(0, Number(newFT.consumptionPer100Km) || 0),
                      }]);
                      setNewFT({ name: "", pricePerLiter: "", consumptionPer100Km: "" });
                      setSuccess("");
                    }}
                    className="flex items-center justify-center rounded-xl p-2 text-slate-400 transition hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-950/30 dark:hover:text-teal-400"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
              {setting?.updatedAt && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Dernière mise à jour : {fmt(setting.updatedAt)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
