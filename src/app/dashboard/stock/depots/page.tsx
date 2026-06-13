"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Warehouse, Plus, Pencil, Trash2, X, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { stockDepotService, type Depot } from "@/services/stock/stockDepotService";

interface Manager {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface DepotForm {
  name: string;
  address: string;
  managerId: string;
  productTypeScope: "MP" | "PF" | "MP_PF";
  capacityKg: string;
  capacityPackets: string;
  status: "ACTIVE" | "INACTIVE";
}

const emptyForm: DepotForm = {
  name: "",
  address: "",
  managerId: "",
  productTypeScope: "MP_PF",
  capacityKg: "",
  capacityPackets: "",
  status: "ACTIVE",
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function StockDepotsPage() {
  const { t } = useLanguage();

  const [depots, setDepots] = useState<Depot[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editDepot, setEditDepot] = useState<Depot | null>(null);
  const [deleteDepot, setDeleteDepot] = useState<Depot | null>(null);

  const [form, setForm] = useState<DepotForm>(emptyForm);

  const surface = "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
  const inputCls = "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";
  const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [depotData, managerData] = await Promise.all([
        stockDepotService.getAll(),
        stockDepotService.getManagers(),
      ]);
      setDepots(depotData);
      setManagers(managerData);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load depots");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setForm(emptyForm); setFormError(""); setShowCreate(true); };
  const openEdit = (depot: Depot) => {
    setForm({
      name: depot.name,
      address: depot.address,
      managerId: depot.managerId?._id ?? "",
      productTypeScope: depot.productTypeScope,
      capacityKg: depot.capacityKg != null ? String(depot.capacityKg) : "",
      capacityPackets: depot.capacityPackets != null ? String(depot.capacityPackets) : "",
      status: depot.status,
    });
    setFormError("");
    setEditDepot(depot);
  };

  const handleCreate = async () => {
    if (!form.name || !form.address || !form.managerId) { setFormError("Name, address and manager are required."); return; }
    try {
      setSaving(true);
      await stockDepotService.create({
        ...form,
        capacityKg: form.capacityKg !== "" ? Number(form.capacityKg) : null,
        capacityPackets: form.capacityPackets !== "" ? Number(form.capacityPackets) : null,
      });
      await fetchAll();
      setShowCreate(false);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Failed to create depot");
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editDepot) return;
    try {
      setSaving(true);
      await stockDepotService.update(editDepot._id, {
        ...form,
        capacityKg: form.capacityKg !== "" ? Number(form.capacityKg) : null,
        capacityPackets: form.capacityPackets !== "" ? Number(form.capacityPackets) : null,
      });
      await fetchAll();
      setEditDepot(null);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Failed to update depot");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteDepot) return;
    try {
      setSaving(true);
      await stockDepotService.delete(deleteDepot._id);
      await fetchAll();
      setDeleteDepot(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to delete depot");
    } finally { setSaving(false); }
  };

  const filtered = depots.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.address.toLowerCase().includes(search.toLowerCase()) ||
      (d.managerId?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const scopeLabel: Record<string, string> = { MP: "Matière Première", PF: "Produit Fini", MP_PF: "MP + PF" };

  const depotFormFields = (
    <div className="space-y-4">
      {formError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
          {formError}
        </div>
      )}
      <div>
        <label className={labelCls}>{t("depotNameLabel")}</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Central Depot" />
      </div>
      <div>
        <label className={labelCls}>{t("depotAddressLabel")}</label>
        <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={inputCls} placeholder="123 Industrial Zone" />
      </div>
      <div>
        <label className={labelCls}>{t("depotManagerLabel")}</label>
        <select value={form.managerId} onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))} className={inputCls}>
          <option value="">{t("selectManager")}</option>
          {managers.map((m) => (
            <option key={m._id} value={m._id}>{m.name} ({m.email})</option>
          ))}
        </select>
        {managers.length === 0 && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t("noDepotManagers")}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t("productScope")}</label>
          <select value={form.productTypeScope} onChange={(e) => setForm((f) => ({ ...f, productTypeScope: e.target.value as any }))} className={inputCls}>
            <option value="MP">Matière Première</option>
            <option value="PF">Produit Fini</option>
            <option value="MP_PF">MP + PF</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("status")}</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))} className={inputCls}>
            <option value="ACTIVE">{t("active")}</option>
            <option value="INACTIVE">{t("inactive")}</option>
          </select>
        </div>
      </div>
      {(form.productTypeScope === "MP" || form.productTypeScope === "MP_PF") && (
        <div>
          <label className={labelCls}>{t("capacityKgLabel")}</label>
          <input
            type="number"
            min={0}
            value={form.capacityKg}
            onChange={(e) => setForm((f) => ({ ...f, capacityKg: e.target.value }))}
            className={inputCls}
            placeholder="e.g. 10000"
          />
        </div>
      )}
      {(form.productTypeScope === "PF" || form.productTypeScope === "MP_PF") && (
        <div>
          <label className={labelCls}>{t("capacityPacketsLabel")}</label>
          <input
            type="number"
            min={0}
            value={form.capacityPackets}
            onChange={(e) => setForm((f) => ({ ...f, capacityPackets: e.target.value }))}
            className={inputCls}
            placeholder="e.g. 5000"
          />
        </div>
      )}
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={["STOCK_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("stockModule")} · ERP
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("depots")} <span className="text-slate-400 dark:text-slate-500">{t("depotManagement")}</span>
            </h1>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus size={15} />
            {t("newDepot")}
          </button>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        <div className={`${surface} flex items-center gap-3 px-4 py-3`}>
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchDepots")}
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
        </div>

        <div className={`${surface} overflow-hidden`}>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> {t("loadingDepots")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">{t("noDepotsFound")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    {[t("depotNameLabel"), t("depotAddressLabel"), t("manager"), t("scopeColumn"), t("capacityColumn"), t("status"), ""].map((h) => (
                      <th key={h} className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((depot) => (
                    <motion.tr key={depot._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2"><Warehouse size={15} className="text-slate-400" />{depot.name}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{depot.address}</td>
                      <td className="px-6 py-4">
                        {depot.managerId ? (
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{depot.managerId.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{depot.managerId.email}</p>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {scopeLabel[depot.productTypeScope]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {(depot.productTypeScope === "MP" || depot.productTypeScope === "MP_PF") && (
                            <p>{depot.capacityKg != null ? <><span className="font-semibold">{depot.capacityKg.toLocaleString()}</span> kg</> : <span className="text-slate-400">— kg</span>}</p>
                          )}
                          {(depot.productTypeScope === "PF" || depot.productTypeScope === "MP_PF") && (
                            <p>{depot.capacityPackets != null ? <><span className="font-semibold">{depot.capacityPackets.toLocaleString()}</span> pkts</> : <span className="text-slate-400">— pkts</span>}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${depot.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>
                          {depot.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-0 transition group-hover:opacity-100">
                          <button onClick={() => openEdit(depot)} className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteDepot(depot)} className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <Modal title={t("newDepot")} onClose={() => setShowCreate(false)}>
            {depotFormFields}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">{t("cancel")}</button>
              <button onClick={handleCreate} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950">
                {saving && <Loader2 size={14} className="animate-spin" />} {t("createBtn")}
              </button>
            </div>
          </Modal>
        )}
        {editDepot && (
          <Modal title={t("editDepotTitle")} onClose={() => setEditDepot(null)}>
            {depotFormFields}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditDepot(null)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">{t("cancel")}</button>
              <button onClick={handleEdit} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950">
                {saving && <Loader2 size={14} className="animate-spin" />} {t("save")}
              </button>
            </div>
          </Modal>
        )}
        {deleteDepot && (
          <Modal title={t("deleteDepotTitle")} onClose={() => setDeleteDepot(null)}>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t("deleteConfirmDepot")} <span className="font-semibold text-slate-900 dark:text-white">{deleteDepot.name}</span>? {t("cannotBeUndone")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteDepot(null)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">{t("cancel")}</button>
              <button onClick={handleDelete} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />} {t("deleteBtn")}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </ProtectedRoute>
  );
}
