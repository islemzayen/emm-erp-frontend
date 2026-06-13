"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { documentService, type StockDocument, type DocumentStats } from "@/services/stock/documentService";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  FileText, Loader2, Upload, Download, Trash2,
  File, FileImage, FileSpreadsheet, Archive, HardDrive, CalendarDays, FolderOpen,
} from "lucide-react";

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function DocIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/"))       return <FileImage size={16} className="text-violet-500" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv"))
                                        return <FileSpreadsheet size={16} className="text-emerald-500" />;
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar"))
                                        return <Archive size={16} className="text-amber-500" />;
  if (mime.includes("pdf"))             return <FileText size={16} className="text-rose-500" />;
  return <File size={16} className="text-slate-400" />;
}

function MimeBadge({ mime }: { mime: string }) {
  const ext = mime.split("/").pop()?.split(".").pop()?.toUpperCase().slice(0, 6) ?? "FILE";
  const color =
    mime.startsWith("image/")           ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" :
    mime.includes("pdf")                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" :
    mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" :
    mime.includes("zip") || mime.includes("rar")
                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                                          "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>{ext}</span>
  );
}

export default function DepotDocumentsPage() {
  const [docs, setDocs]       = useState<StockDocument[]>([]);
  const [stats, setStats]     = useState<DocumentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [otpTarget, setOtpTarget]   = useState<string | null>(null);
  const [otpInput, setOtpInput]     = useState("");
  const [otpError, setOtpError]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([documentService.getAll(), documentService.getStats()]);
      setDocs(d);
      setStats(s);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadError("");
    setUploading(true);
    try {
      await documentService.upload(file);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUploadError(msg || "Échec de l'upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openDeleteModal = (id: string) => {
    setOtpTarget(id);
    setOtpInput("");
    setOtpError("");
  };

  const confirmDelete = async () => {
    if (!otpTarget) return;
    setOtpError("");
    setDeletingId(otpTarget);
    try {
      await documentService.delete(otpTarget, otpInput);
      setDocs((prev) => prev.filter((d) => d._id !== otpTarget));
      void documentService.getStats().then(setStats).catch(() => {});
      setOtpTarget(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setOtpError(msg || "Code invalide");
    } finally {
      setDeletingId(null);
    }
  };

  const statCards = [
    {
      label: "TOTAL DOCUMENTS",
      value: String(stats?.total ?? 0),
      sub: "Tous fichiers",
      icon: <FolderOpen size={18} />,
      iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
    },
    {
      label: "CE MOIS",
      value: String(stats?.monthCount ?? 0),
      sub: "Uploadés ce mois",
      icon: <CalendarDays size={18} />,
      iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
    },
    {
      label: "TAILLE TOTALE",
      value: fmtSize(stats?.totalSize ?? 0),
      sub: "Stockage utilisé",
      icon: <HardDrive size={18} />,
      iconBg: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
      large: true,
    },
    {
      label: "DERNIER UPLOAD",
      value: docs[0] ? fmt(docs[0].createdAt) : "—",
      sub: docs[0]?.originalName?.slice(0, 20) ?? "Aucun fichier",
      icon: <FileText size={18} />,
      iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
      large: true,
    },
  ];

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER", "DEPOT_MANAGER"]}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Dépôt <span className="text-teal-500">Documents</span>
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              EMM ERP · DÉPÔT
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Importer un document
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}
        {uploadError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            Upload échoué : {uploadError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {statCards.map((card, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${card.iconBg}`}>
                    {card.icon}
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{card.label}</p>
                  {card.large ? (
                    <p className="mt-1 text-lg font-bold leading-snug text-slate-950 dark:text-white">{card.value}</p>
                  ) : (
                    <p className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{card.value}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 truncate">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Document list */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <p className="font-bold text-slate-950 dark:text-white">Documents</p>
                <p className="mt-0.5 text-xs text-slate-400">{docs.length} fichier{docs.length !== 1 ? "s" : ""}</p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {docs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <FileText size={20} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Aucun document</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">Les documents importés apparaîtront ici</p>
                  </div>
                ) : docs.map((doc) => (
                  <div key={doc._id} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/20">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                      <DocIcon mime={doc.mimeType} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{doc.originalName}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <MimeBadge mime={doc.mimeType} />
                        <span className="text-[10px] text-slate-400">{fmtSize(doc.size)}</span>
                        <span className="text-[10px] text-slate-400">{fmt(doc.createdAt)}</span>
                        {doc.uploadedBy && (
                          <span className="text-[10px] text-slate-400">{doc.uploadedBy.name}</span>
                        )}
                      </div>
                      {doc.description && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-400 italic">{doc.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => documentService.download(doc._id, doc.originalName)}
                        title="Télécharger"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-teal-600 dark:hover:bg-slate-700 dark:hover:text-teal-400"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(doc._id)}
                        disabled={deletingId === doc._id}
                        title="Supprimer"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40 dark:hover:bg-rose-950/20 dark:hover:text-rose-400"
                      >
                        {deletingId === doc._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {/* OTP delete modal */}
      {otpTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                <Trash2 size={18} />
              </div>
              <div>
                <p className="font-bold text-slate-950 dark:text-white">Confirmer la suppression</p>
                <p className="text-xs text-slate-400">Entrez le code OTP généré par l'administrateur</p>
              </div>
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpInput}
              onChange={(e) => { setOtpInput(e.target.value.replace(/\D/g, "")); setOtpError(""); }}
              placeholder="6 chiffres"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.3em] text-slate-950 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />

            {otpError && (
              <p className="mt-2 text-center text-xs font-medium text-rose-500">{otpError}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setOtpTarget(null)}
                className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={otpInput.length !== 6 || !!deletingId}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
