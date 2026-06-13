"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { financeService, type CompanySettings } from "@/services/finance/financeService";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import { Loader2, Settings } from "lucide-react";

const surface = "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
const inputClass = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";
const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

const empty: CompanySettings = {
  companyName: "", mf: "", rne: "", address: "", phone: "", email: "", rib: "", iban: "", bank: "", agence: "",
};

export default function FinanceSettingsPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState<CompanySettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    financeService.getSettings().then((s) => { setForm(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess(false);
      await financeService.updateSettings(form);
      setSuccess(true);
    } catch {
      setError(t("fin_failed"));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof CompanySettings, label: string, placeholder?: string) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        value={(form[key] as string) || ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={inputClass}
        placeholder={placeholder || ""}
      />
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Settings size={18} className="text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{t("fin_settingsTitle")}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("fin_settingsSubtitle")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500`}>
            <Loader2 size={16} className="animate-spin" /> {t("fin_loading")}
          </div>
        ) : (
          <>
            <div className={`${surface} p-6 space-y-5`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("fin_generalInfo")}</p>
              <div className="grid grid-cols-2 gap-4">
                {field("companyName", t("fin_companyName"), "EMM TN")}
                {field("email", "Email", "info@emmtn.com")}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {field("phone", t("fin_phone"), "+(216) 98 241 790")}
                {field("address", t("fin_address"), "Route de Gabès Km 6, Sfax, Tunisie")}
              </div>
            </div>

            <div className={`${surface} p-6 space-y-5`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("fin_fiscalIds")}</p>
              <div className="grid grid-cols-2 gap-4">
                {field("mf", t("fin_mf"), "0000000A/B/M/000")}
                {field("rne", t("fin_rne"), "00000000")}
              </div>
            </div>

            <div className={`${surface} p-6 space-y-5`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("fin_bankDetails")}</p>
              <div className="grid grid-cols-2 gap-4">
                {field("rib", t("fin_rib"), "00 000 0000000000000 00")}
                {field("iban", t("fin_iban"), "TN59 0000 0000000000000 000")}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {field("bank", t("fin_bank"), "—")}
                {field("agence", t("fin_branch"), "—")}
              </div>
            </div>

            {error && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400">
                {t("fin_saveSuccess")}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? t("fin_saving") : t("fin_save")}
              </button>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
