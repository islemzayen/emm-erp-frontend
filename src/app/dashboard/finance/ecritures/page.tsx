"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { financeService, ManualJournalEntry, ManualJournalEntryLine } from "@/services/finance/financeService";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import { BookOpen, Loader2, Plus, Trash2, X } from "lucide-react";

function getErrorMessage(err: unknown) {
  if (
    typeof err === "object" && err !== null &&
    "response" in err && typeof err.response === "object" && err.response !== null &&
    "data" in err.response && typeof err.response.data === "object" && err.response.data !== null &&
    "message" in err.response.data && typeof err.response.data.message === "string"
  ) return err.response.data.message;
  return "Opération échouée";
}

function roundAmount(v: number) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 1000) / 1000;
}

const surface = "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const COMMON_ACCOUNTS = [
  { code: "411", name: "Clients" },
  { code: "401", name: "Fournisseurs" },
  { code: "512", name: "Banque" },
  { code: "531", name: "Caisse" },
  { code: "706", name: "Ventes de marchandises" },
  { code: "607", name: "Achats de marchandises" },
  { code: "4457", name: "TVA collectée" },
  { code: "4456", name: "TVA déductible" },
  { code: "44581", name: "FODEC collecté" },
  { code: "60800", name: "FODEC sur achats" },
  { code: "4371", name: "Timbre fiscal à décaisser" },
  { code: "6371", name: "Timbre fiscal" },
  { code: "4028", name: "Retenues à la source à décaisser" },
  { code: "609", name: "Avoirs fournisseurs" },
];

type NewLine = { accountCode: string; accountName: string; side: "DEBIT" | "CREDIT"; amount: string };

export default function EcrituresPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<ManualJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<NewLine[]>([
    { accountCode: "", accountName: "", side: "DEBIT", amount: "" },
    { accountCode: "", accountName: "", side: "CREDIT", amount: "" },
  ]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setEntries(await financeService.getManualEntries());
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalDebit = lines
    .filter((l) => l.side === "DEBIT")
    .reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const totalCredit = lines
    .filter((l) => l.side === "CREDIT")
    .reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const balanced = Math.abs(roundAmount(totalDebit) - roundAmount(totalCredit)) <= 0.001;

  const addLine = () =>
    setLines((prev) => [...prev, { accountCode: "", accountName: "", side: "DEBIT", amount: "" }]);

  const removeLine = (index: number) =>
    setLines((prev) => prev.filter((_, i) => i !== index));

  const updateLine = (index: number, field: keyof NewLine, value: string) =>
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const updated = { ...l, [field]: value };
        if (field === "accountCode") {
          const found = COMMON_ACCOUNTS.find((a) => a.code === value);
          if (found) updated.accountName = found.name;
        }
        return updated;
      })
    );

  const openCreate = () => {
    setReference("");
    setDescription("");
    setOccurredAt(new Date().toISOString().slice(0, 10));
    setLines([
      { accountCode: "", accountName: "", side: "DEBIT", amount: "" },
      { accountCode: "", accountName: "", side: "CREDIT", amount: "" },
    ]);
    setCreateOpen(true);
  };

  const save = async () => {
    if (!balanced) return;
    const payload: ManualJournalEntryLine[] = lines.map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      side: l.side,
      amount: Number(l.amount || 0),
    }));
    try {
      setSaving(true);
      setError("");
      await financeService.createManualEntry({ reference, description, occurredAt, lines: payload });
      setCreateOpen(false);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      setDeleting(id);
      await financeService.deleteManualEntry(id);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <BookOpen size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {t("fin_ecrTitle")}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("fin_ecrSubtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl border border-black bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-900"
          >
            <Plus size={15} />
            {t("fin_newEntry")}
          </button>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400`}>
            <Loader2 size={16} className="animate-spin" />
            {t("fin_loading")}
          </div>
        ) : !entries.length ? (
          <div className={`${surface} flex flex-col items-center justify-center py-16`}>
            <BookOpen size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-400 dark:text-slate-500">{t("fin_noManualEntries")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry._id} className={`${surface} overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">{entry.reference}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {entry.description || t("fin_entryManual")} · {new Date(entry.occurredAt).toLocaleDateString("fr-TN")}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteEntry(entry._id)}
                    disabled={deleting === entry._id}
                    className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                  >
                    {deleting === entry._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-950/40">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_accountCol")}</th>
                        <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_accountLabel")}</th>
                        <th className="px-6 py-3 text-right font-medium text-slate-500">{t("fin_debit")}</th>
                        <th className="px-6 py-3 text-right font-medium text-slate-500">{t("fin_credit")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {entry.lines.map((line, i) => (
                        <tr key={i}>
                          <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{line.accountCode}</td>
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{line.accountName}</td>
                          <td className="px-6 py-3 text-right text-slate-900 dark:text-white">
                            {line.side === "DEBIT" ? `${line.amount.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} ${t("fin_tnd")}` : "—"}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-900 dark:text-white">
                            {line.side === "CREDIT" ? `${line.amount.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} ${t("fin_tnd")}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {createOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{t("fin_newEntry")}</h3>
                <button onClick={() => setCreateOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm sm:col-span-1">
                    <span className="mb-1.5 block text-slate-600 dark:text-slate-300">{t("fin_refField")}</span>
                    <input className={inputClass} placeholder={t("fin_refPlaceholder")} value={reference} onChange={(e) => setReference(e.target.value)} />
                  </label>
                  <label className="block text-sm sm:col-span-1">
                    <span className="mb-1.5 block text-slate-600 dark:text-slate-300">{t("fin_dateField")}</span>
                    <input className={inputClass} type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
                  </label>
                  <label className="block text-sm sm:col-span-1">
                    <span className="mb-1.5 block text-slate-600 dark:text-slate-300">{t("fin_descriptionField")}</span>
                    <input className={inputClass} placeholder={t("fin_descPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </label>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("fin_accountLines")}</span>
                    <button onClick={addLine} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      <Plus size={13} /> {t("fin_addLine")}
                    </button>
                  </div>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-950/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-500 w-28">{t("fin_accountNo")}</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">{t("fin_accountLabel")}</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500 w-24">{t("fin_side")}</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-500 w-32">{t("fin_amountField")}</th>
                          <th className="px-3 py-2 w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {lines.map((line, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1.5">
                              <select
                                className={inputClass}
                                value={line.accountCode}
                                onChange={(e) => updateLine(i, "accountCode", e.target.value)}
                              >
                                <option value="">—</option>
                                {COMMON_ACCOUNTS.map((a) => (
                                  <option key={a.code} value={a.code}>{a.code}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className={inputClass}
                                placeholder={t("fin_accountLabel")}
                                value={line.accountName}
                                onChange={(e) => updateLine(i, "accountName", e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <select
                                className={inputClass}
                                value={line.side}
                                onChange={(e) => updateLine(i, "side", e.target.value)}
                              >
                                <option value="DEBIT">{t("fin_debit")}</option>
                                <option value="CREDIT">{t("fin_credit")}</option>
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className={inputClass + " text-right"}
                                type="number"
                                min="0"
                                step="0.001"
                                placeholder="0.000"
                                value={line.amount}
                                onChange={(e) => updateLine(i, "amount", e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              {lines.length > 2 && (
                                <button onClick={() => removeLine(i)} className="text-slate-400 hover:text-rose-600">
                                  <X size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-6 text-sm">
                    <span className="text-slate-500">
                      {t("fin_debitTotal")} <strong className="text-slate-900 dark:text-white">{roundAmount(totalDebit).toLocaleString("fr-TN", { minimumFractionDigits: 3 })} {t("fin_tnd")}</strong>
                    </span>
                    <span className="text-slate-500">
                      {t("fin_creditTotal")} <strong className="text-slate-900 dark:text-white">{roundAmount(totalCredit).toLocaleString("fr-TN", { minimumFractionDigits: 3 })} {t("fin_tnd")}</strong>
                    </span>
                    {!balanced && (
                      <span className="font-medium text-rose-600">{t("fin_imbalance")} {roundAmount(Math.abs(totalDebit - totalCredit)).toLocaleString("fr-TN", { minimumFractionDigits: 3 })} {t("fin_tnd")}</span>
                    )}
                    {balanced && totalDebit > 0 && (
                      <span className="font-medium text-emerald-600">{t("fin_balanced")}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setCreateOpen(false)} className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  {t("fin_cancel")}
                </button>
                <button
                  onClick={save}
                  disabled={saving || !balanced || totalDebit <= 0 || !reference.trim()}
                  className="rounded-2xl border border-black bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                >
                  {saving ? t("fin_saving") : t("fin_saveEntry")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
