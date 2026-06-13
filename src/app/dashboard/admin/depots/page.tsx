"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Warehouse,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { stockDepotService, type Depot } from "@/services/stock/stockDepotService";
import { adminService } from "@/services/admin/adminService";

interface User {
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
  status: "ACTIVE" | "INACTIVE";
}

const emptyForm: DepotForm = {
  name: "",
  address: "",
  managerId: "",
  productTypeScope: "MP_PF",
  status: "ACTIVE",
};

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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

export default function AdminDepotsPage() {
  const { t } = useLanguage();

  const [depots, setDepots] = useState<Depot[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editDepot, setEditDepot] = useState<Depot | null>(null);
  const [deleteDepot, setDeleteDepot] = useState<Depot | null>(null);

  const [form, setForm] = useState<DepotForm>(emptyForm);

  const surface =
    "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [depotData, userData] = await Promise.all([
        stockDepotService.getAll(),
        adminService.getAllUsers(),
      ]);
      setDepots(depotData);
      // Only show DEPOT_MANAGER users in the manager selector
      setManagers(userData.filter((u: User) => u.role === "DEPOT_MANAGER"));
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load depots");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFormError("");
    setShowCreate(true);
  };

  const openEdit = (depot: Depot) => {
    setForm({
      name: depot.name,
      address: depot.address,
      managerId: depot.managerId?._id ?? "",
      productTypeScope: depot.productTypeScope,
      status: depot.status,
    });
    setFormError("");
    setEditDepot(depot);
  };

  const handleCreate = async () => {
    if (!form.name || !form.address || !form.managerId) {
      setFormError("Name, address and manager are required.");
      return;
    }
    try {
      setSaving(true);
      await stockDepotService.create(form);
      await fetchAll();
      setShowCreate(false);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Failed to create depot");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editDepot) return;
    try {
      setSaving(true);
      await stockDepotService.update(editDepot._id, form);
      await fetchAll();
      setEditDepot(null);
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Failed to update depot");
    } finally {
      setSaving(false);
    }
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
    } finally {
      setSaving(false);
    }
  };

  const filtered = depots.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.address.toLowerCase().includes(search.toLowerCase()) ||
      (d.managerId?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const scopeLabel: Record<string, string> = { MP: "Matière Première", PF: "Produit Fini", MP_PF: "MP + PF" };

  const DepotForm = () => (
    <div className="space-y-4">
      {formError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
          {formError}
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Name
        </label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800"
          placeholder="Central Depot"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Address
        </label>
        <input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800"
          placeholder="123 Industrial Zone, Tunis"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Manager (DEPOT_MANAGER)
        </label>
        <select
          value={form.managerId}
          onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
        >
          <option value="">— Select manager —</option>
          {managers.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name} ({m.email})
            </option>
          ))}
        </select>
        {managers.length === 0 && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            No users with DEPOT_MANAGER role found.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Product Scope
          </label>
          <select
            value={form.productTypeScope}
            onChange={(e) => setForm((f) => ({ ...f, productTypeScope: e.target.value as any }))}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          >
            <option value="MP">Matière Première</option>
            <option value="PF">Produit Fini</option>
            <option value="MP_PF">MP + PF</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Status
          </label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={["STOCK_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Admin · Stock
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Depots <span className="text-slate-400 dark:text-slate-500">Management</span>
            </h1>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus size={15} />
            New Depot
          </button>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Search */}
        <div className={`${surface} flex items-center gap-3 px-4 py-3`}>
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search depots..."
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
        </div>

        {/* Table */}
        <div className={`${surface} overflow-hidden`}>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading depots...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">
              No depots found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    {["Name", "Address", "Manager", "Scope", "Status", ""].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((depot) => (
                    <motion.tr
                      key={depot._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="group"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <Warehouse size={15} className="text-slate-400" />
                          {depot.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {depot.address}
                      </td>
                      <td className="px-6 py-4">
                        {depot.managerId ? (
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {depot.managerId.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {depot.managerId.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {scopeLabel[depot.productTypeScope]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            depot.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}
                        >
                          {depot.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-0 transition group-hover:opacity-100">
                          <button
                            onClick={() => openEdit(depot)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteDepot(depot)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                          >
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
        {/* Create modal */}
        {showCreate && (
          <Modal title="New Depot" onClose={() => setShowCreate(false)}>
            <DepotForm />
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Create
              </button>
            </div>
          </Modal>
        )}

        {/* Edit modal */}
        {editDepot && (
          <Modal title="Edit Depot" onClose={() => setEditDepot(null)}>
            <DepotForm />
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditDepot(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            </div>
          </Modal>
        )}

        {/* Delete confirm */}
        {deleteDepot && (
          <Modal title="Delete Depot" onClose={() => setDeleteDepot(null)}>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{deleteDepot.name}</span>?
              This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteDepot(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </ProtectedRoute>
  );
}
