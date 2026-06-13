"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import {
  supplementaryCategoryService,
  SupplementaryCategory,
} from "@/services/purchase/supplementaryCategoryService";
import { useEffect, useState } from "react";
import { Tag, Plus, Loader2, X, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

// ─── Colour palette ───────────────────────────────────────────────────────────

const COLORS = [
  { key: "slate",   bg: "bg-slate-100 dark:bg-slate-800",      text: "text-slate-700 dark:text-slate-300",    dot: "bg-slate-500" },
  { key: "blue",    bg: "bg-blue-50 dark:bg-blue-900/30",       text: "text-blue-700 dark:text-blue-300",      dot: "bg-blue-500" },
  { key: "violet",  bg: "bg-violet-50 dark:bg-violet-900/30",   text: "text-violet-700 dark:text-violet-300",  dot: "bg-violet-500" },
  { key: "emerald", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300",dot: "bg-emerald-500" },
  { key: "amber",   bg: "bg-amber-50 dark:bg-amber-900/30",     text: "text-amber-700 dark:text-amber-300",    dot: "bg-amber-500" },
  { key: "rose",    bg: "bg-rose-50 dark:bg-rose-900/30",       text: "text-rose-700 dark:text-rose-300",      dot: "bg-rose-500" },
  { key: "cyan",    bg: "bg-cyan-50 dark:bg-cyan-900/30",       text: "text-cyan-700 dark:text-cyan-300",      dot: "bg-cyan-500" },
  { key: "orange",  bg: "bg-orange-50 dark:bg-orange-900/30",   text: "text-orange-700 dark:text-orange-300",  dot: "bg-orange-500" },
];

function colorStyle(key: string) {
  return COLORS.find((c) => c.key === key) ?? COLORS[0];
}

function CategoryBadge({ category }: { category: SupplementaryCategory }) {
  const c = colorStyle(category.color);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {category.label}
    </span>
  );
}

function getError(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (err as { response: { data: { message: string } } }).response.data.message;
  }
  return "Une erreur est survenue";
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <X size={13} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toCode(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ─── Category form ────────────────────────────────────────────────────────────

const EMPTY = { name: "", label: "", description: "", color: "slate" };

function CategoryForm({
  initial,
  isEdit,
  onSubmit,
  onCancel,
  error,
  saving,
}: {
  initial: typeof EMPTY;
  isEdit: boolean;
  onSubmit: (values: typeof EMPTY) => void;
  onCancel: () => void;
  error: string;
  saving: boolean;
}) {
  const [label, setLabel] = useState(initial.label);
  const [color, setColor] = useState(initial.color);

  const code = isEdit ? initial.name : toCode(label);

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name: code, label, description: "", color });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
          {error}
        </p>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Category Name <span className="text-rose-500">*</span>
        </label>
        <input
          required
          autoFocus
          className={inputCls}
          placeholder="e.g. Office Supplies"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColor(c.key)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${c.bg} ${c.text} ${
                color === c.key
                  ? "ring-2 ring-slate-400 ring-offset-1 dark:ring-slate-500"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
              {c.key.charAt(0).toUpperCase() + c.key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !label.trim()}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          {saving ? "Saving…" : isEdit ? "Save" : "Create"}
        </button>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupplementaryCategoriesPage() {
  const [categories, setCategories] = useState<SupplementaryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<SupplementaryCategory | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setCategories(await supplementaryCategoryService.getAll());
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (values: typeof EMPTY) => {
    setSaving(true);
    setFormError("");
    try {
      const created = await supplementaryCategoryService.create(values);
      setCategories((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
      setShowCreate(false);
    } catch (err) {
      setFormError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (values: typeof EMPTY) => {
    if (!editTarget) return;
    setSaving(true);
    setFormError("");
    try {
      const updated = await supplementaryCategoryService.update(editTarget._id, {
        label: values.label,
        color: values.color,
      });
      setCategories((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      setEditTarget(null);
    } catch (err) {
      setFormError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (cat: SupplementaryCategory) => {
    setActionId(cat._id);
    try {
      const updated = await supplementaryCategoryService.update(cat._id, { isActive: !cat.isActive });
      setCategories((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
    } catch (err) {
      setError(getError(err));
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (cat: SupplementaryCategory) => {
    if (!confirm(`Supprimer la catégorie "${cat.label}" ?`)) return;
    setActionId(cat._id);
    try {
      await supplementaryCategoryService.delete(cat._id);
      setCategories((prev) => prev.filter((c) => c._id !== cat._id));
    } catch (err) {
      setError(getError(err));
    } finally {
      setActionId(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      {showCreate && (
        <Modal title="Nouvelle catégorie" onClose={() => { setShowCreate(false); setFormError(""); }}>
          <CategoryForm
            initial={EMPTY}
            isEdit={false}
            onSubmit={handleCreate}
            onCancel={() => { setShowCreate(false); setFormError(""); }}
            error={formError}
            saving={saving}
          />
        </Modal>
      )}

      {editTarget && (
        <Modal title={`Modifier — ${editTarget.label}`} onClose={() => { setEditTarget(null); setFormError(""); }}>
          <CategoryForm
            initial={{
              name: editTarget.name,
              label: editTarget.label,
              description: "",
              color: editTarget.color,
            }}
            isEdit={true}
            onSubmit={handleEdit}
            onCancel={() => { setEditTarget(null); setFormError(""); }}
            error={formError}
            saving={saving}
          />
        </Modal>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Tag size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                Catégories d&apos;achat
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Gérez les catégories disponibles pour les demandes d&apos;achat supplémentaires
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowCreate(true); setFormError(""); }}
            className="flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Plus size={14} />
            Nouvelle catégorie
          </button>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white py-16 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Chargement…
          </div>
        ) : !categories.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white py-20 dark:border-slate-700 dark:bg-slate-900">
            <Tag size={32} className="text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Aucune catégorie créée</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-1 flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Plus size={12} />
              Créer la première catégorie
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => {
              const busy = actionId === cat._id;
              const c = colorStyle(cat.color);
              return (
                <div
                  key={cat._id}
                  className={`rounded-3xl border bg-white p-5 shadow-sm transition dark:bg-slate-900 ${
                    cat.isActive
                      ? "border-slate-200 dark:border-slate-800"
                      : "border-dashed border-slate-200 opacity-60 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CategoryBadge category={cat} />
                      <p className="mt-2 font-mono text-xs text-slate-400 dark:text-slate-500">{cat.name}</p>
                    </div>
                    <span className={`shrink-0 rounded-xl px-2 py-0.5 text-xs font-medium ${
                      cat.isActive
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    }`}>
                      {cat.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className={`h-1.5 w-20 rounded-full ${c.dot} opacity-40`} />
                    <div className="flex items-center gap-1">
                      {busy ? (
                        <Loader2 size={14} className="animate-spin text-slate-400" />
                      ) : (
                        <>
                          <button
                            onClick={() => handleToggle(cat)}
                            title={cat.isActive ? "Désactiver" : "Activer"}
                            className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            {cat.isActive
                              ? <ToggleRight size={13} className="text-emerald-500" />
                              : <ToggleLeft size={13} />
                            }
                          </button>
                          <button
                            onClick={() => { setEditTarget(cat); setFormError(""); }}
                            title="Modifier"
                            className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(cat)}
                            title="Supprimer"
                            className="flex h-7 w-7 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
