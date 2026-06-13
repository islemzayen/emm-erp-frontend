"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import { purchaseSettingService, PurchaseSettings } from "@/services/purchase/purchaseSettingService";
import { Loader2, Save, Settings } from "lucide-react";

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

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";

export default function PurchaseSettingsPage() {
  const { language } = useLanguage();
  const text =
    language === "fr"
      ? {
          title: "Paramètres Achat",
          subtitle: "Configurez la numérotation, les taxes et la devise",
          save: "Enregistrer les paramètres",
          saveSuccess: "Paramètres achat mis à jour",
          loading: "Chargement des paramètres achat...",
          numbering: "Numérotation",
          taxes: "Taxes et devise",
        }
      : {
          title: "Purchase Settings",
          subtitle: "Configure numbering prefixes, taxes, and currency",
          save: "Save Settings",
          saveSuccess: "Purchase settings updated",
          loading: "Loading purchase settings...",
          numbering: "Numbering",
          taxes: "Taxes & Currency",
        };
  const [settings, setSettings] = useState<PurchaseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError("");
      setSettings(await purchaseSettingService.get());
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load purchase settings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateField = <K extends keyof PurchaseSettings>(key: K, value: PurchaseSettings[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const save = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = { ...settings };
      const updated = await purchaseSettingService.update(payload);
      setSettings(updated);
      setSuccess(text.saveSuccess);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update purchase settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Purchasing · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Settings size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {text.title}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {text.subtitle}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving || !settings}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {text.save}
          </button>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {success}
          </div>
        )}

        {loading || !settings ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500`}>
            <Loader2 size={16} className="animate-spin" />
            {text.loading}
          </div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className={`${surface} p-6`}>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{text.numbering}</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {[
                    ["purchaseOrderPrefix", "BC Prefix"],
                    ["purchaseRequestPrefix", "DA Prefix"],
                    ["receiptPrefix", "BR Prefix"],
                    ["invoicePrefix", "Invoice Prefix"],
                    ["tenderPrefix", "AO Prefix"],
                    ["returnPrefix", "Return Prefix"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {label}
                      </label>
                      <input
                        className={inputClass}
                        value={settings[key as keyof PurchaseSettings] as string}
                        onChange={(e) =>
                          updateField(key as keyof PurchaseSettings, e.target.value.toUpperCase() as never)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${surface} p-6`}>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{text.taxes}</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      TVA Rate
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={inputClass}
                      value={settings.defaultVatRate}
                      onChange={(e) => updateField("defaultVatRate", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      FODEC Rate
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={inputClass}
                      value={settings.defaultFodecRate}
                      onChange={(e) => updateField("defaultFodecRate", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Timbre Fiscal
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      className={inputClass}
                      value={settings.defaultTimbreFiscal}
                      onChange={(e) => updateField("defaultTimbreFiscal", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Default Currency
                    </label>
                    <input
                      className={inputClass}
                      value={settings.defaultCurrency}
                      onChange={(e) => updateField("defaultCurrency", e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Exchange Rate To TND
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      className={inputClass}
                      value={settings.exchangeRateToTnd}
                      onChange={(e) => updateField("exchangeRateToTnd", Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
