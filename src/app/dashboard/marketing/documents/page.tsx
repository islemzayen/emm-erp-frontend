"use client";

import { useState, useEffect, useRef } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Download, Trash2, FileText, X, Search,
  Filter, ChevronDown, Loader2, Clock, ShieldAlert,
} from "lucide-react";
import { marketingDocumentService } from "@/services/marketingDocumentService";
import deleteRequestService from "@/services/deleteRequestService";

const DOC_TYPES = ["Dashboard Report", "Invoice", "Quote", "Campaign Brief", "Budget Report", "Contract", "Other"];

const TYPE_COLORS: Record<string, string> = {
  "Dashboard Report": "bg-[#c8202f]/10 text-[#c8202f] border-[#c8202f]/20",
  "Invoice":          "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Quote":            "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "Campaign Brief":   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Budget Report":    "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Contract":         "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Other":            "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

interface Doc {
  _id: string; type: string; fileName: string;
  fileSize: number; note: string; uploadedBy: string; createdAt: string;
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function unwrap(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

export default function MarketingDocumentsPage() {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs]           = useState<Doc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [preview, setPreview]     = useState<{ url: string; name: string } | null>(null);

  const [search, setSearch]         = useState("");
  const [filterType, setFilterType] = useState("All");

  const [form, setForm]               = useState({ type: DOC_TYPES[0], note: "" });
  const [file, setFile]               = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [deleteTarget, setDeleteTarget]   = useState<Doc | null>(null);
  const [deleteStep, setDeleteStep]       = useState<"idle" | "requesting" | "awaiting" | "entering">("idle");
  const [deleteCode, setDeleteCode]       = useState("");
  const [deleteError, setDeleteError]     = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const card       = "bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";
  const inputClass = "w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#c8202f]/60 transition";
  const labelClass = "text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1 block";

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try { setDocs(unwrap(await marketingDocumentService.list())); } catch {}
    setLoading(false);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") { setUploadError("Only PDF files are accepted."); return; }
    if (f.size > 10 * 1024 * 1024)    { setUploadError("File must be under 10MB."); return; }
    setFile(f); setUploadError("");
  }

  async function handleUpload() {
    if (!file) { setUploadError("Please select a PDF file."); return; }
    setUploading(true); setUploadError("");
    try {
      const result = await marketingDocumentService.upload({ type: form.type, note: form.note, file });
      if (result && !result.message?.toLowerCase().includes("error") && !result.statusCode) {
        setShowModal(false); setForm({ type: DOC_TYPES[0], note: "" }); setFile(null); fetchAll();
      } else { setUploadError(result?.message || "Upload failed."); }
    } catch (err: any) { setUploadError(err?.response?.data?.message || "Upload failed."); }
    finally { setUploading(false); }
  }

  async function handlePreview(doc: Doc) {
    try {
      const res = await marketingDocumentService.download(doc._id);
      setPreview({ url: URL.createObjectURL(res.data), name: doc.fileName });
    } catch { alert("Failed to load document."); }
  }

  async function handleDownload(doc: Doc) {
    try {
      const res = await marketingDocumentService.download(doc._id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = doc.fileName; a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Download failed."); }
  }

  // ── Delete flow ──────────────────────────────────────────────────────────
  async function openDeleteModal(doc: Doc) {
    setDeleteTarget(doc); setDeleteCode(""); setDeleteError(""); setDeleteLoading(true);
    setDeleteStep("requesting");
    try {
      const res  = await deleteRequestService.getForDocument(doc._id);
      const data = (res as any)?.data !== undefined ? (res as any).data : res;
      const isApproved = data !== null && data?.status === "Approved" && data?.codeExpiresAt && new Date(data.codeExpiresAt) > new Date();
      setDeleteStep(isApproved ? "entering" : "awaiting");
    } catch { setDeleteStep("awaiting"); }
    finally { setDeleteLoading(false); }
  }

  async function handleRequestApproval() {
    if (!deleteTarget) return;
    setDeleteLoading(true); setDeleteError("");
    try {
      await deleteRequestService.request(deleteTarget._id);
      cancelDelete();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Failed to send request";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("pending")) { cancelDelete(); }
      else { setDeleteError(msg); setDeleteLoading(false); }
    }
  }

  async function handleCodeSubmit() {
    if (!deleteTarget || deleteCode.length !== 6) { setDeleteError("Enter the 6-digit code."); return; }
    setDeleteLoading(true); setDeleteError("");
    try {
      await deleteRequestService.verify(deleteTarget._id, deleteCode);
      setDocs(prev => prev.filter(d => d._id !== deleteTarget._id));
      setDeleteStep("idle"); setDeleteTarget(null); setDeleteCode("");
    } catch (e: any) {
      setDeleteError(e?.response?.data?.message || "Invalid or expired code.");
    } finally { setDeleteLoading(false); }
  }

  function cancelDelete() { setDeleteStep("idle"); setDeleteTarget(null); setDeleteCode(""); setDeleteError(""); }

  // ── Filters ──────────────────────────────────────────────────────────────
  const types    = ["All", ...DOC_TYPES];
  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = (d.fileName || "").toLowerCase().includes(q) || (d.note || "").toLowerCase().includes(q);
    return matchSearch && (filterType === "All" || d.type === filterType);
  });

  return (
    <ProtectedRoute allowedRoles={["MARKETING_MANAGER"]}>

      {/* ── Delete Modal ── */}
      <AnimatePresence>
        {deleteStep !== "idle" && deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center"><ShieldAlert size={15} className="text-red-400" /></div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Delete Document</h2>
                    <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{deleteTarget.fileName}</p>
                  </div>
                </div>
                <button onClick={cancelDelete} className="text-gray-500 hover:text-white transition"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-4">
                {deleteStep === "requesting" && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Loader2 size={24} className="animate-spin text-amber-400" />
                    <p className="text-xs text-gray-400">Checking request status…</p>
                  </div>
                )}
                {deleteStep === "awaiting" && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-3 py-2 text-center">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center"><Clock size={22} className="text-amber-400" /></div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Admin Approval Required</p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">Deleting a document requires admin approval.<br />Once approved you will receive a 6-digit code valid for <span className="text-amber-400 font-bold">30 minutes</span>.</p>
                      </div>
                    </div>
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                      <p className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-1">Document</p>
                      <p className="text-xs text-gray-700 dark:text-gray-200 font-mono truncate">{deleteTarget.fileName}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{deleteTarget.uploadedBy}</p>
                    </div>
                    {deleteError && <p className="text-red-400 text-xs text-center">{deleteError}</p>}
                    <button onClick={handleRequestApproval} disabled={deleteLoading}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition disabled:opacity-50 flex items-center justify-center gap-2">
                      {deleteLoading ? <Loader2 size={13} className="animate-spin" /> : <ShieldAlert size={13} />} Request Approval
                    </button>
                    <button onClick={cancelDelete} className="w-full py-2 rounded-xl text-xs text-gray-600 hover:text-gray-400 transition">Cancel</button>
                  </div>
                )}
                {deleteStep === "entering" && (
                  <div className="space-y-4">
                    <div className="text-center space-y-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Enter Authorization Code</p>
                      <p className="text-xs text-gray-400">Enter the 6-digit code from your notification bell.</p>
                      <p className="text-[10px] text-amber-400 flex items-center justify-center gap-1 mt-1"><Clock size={10} /> Code expires 30 minutes after approval</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <input key={i} id={`mcode-${i}`} type="text" inputMode="numeric" maxLength={1}
                          value={deleteCode[i] || ""}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, "");
                            const arr = deleteCode.split(""); arr[i] = val;
                            const next = arr.join("").slice(0, 6);
                            setDeleteCode(next); setDeleteError("");
                            if (val && i < 5) (document.getElementById(`mcode-${i + 1}`) as HTMLInputElement)?.focus();
                          }}
                          onKeyDown={e => { if (e.key === "Backspace" && !deleteCode[i] && i > 0) (document.getElementById(`mcode-${i - 1}`) as HTMLInputElement)?.focus(); }}
                          className={`w-10 h-12 text-center text-lg font-bold font-mono rounded-xl border bg-gray-100 dark:bg-black/30 text-gray-900 dark:text-white focus:outline-none transition ${deleteError ? "border-red-500/60" : "border-white/10 focus:border-[#c8202f]/60"}`}
                        />
                      ))}
                    </div>
                    {deleteError && <p className="text-red-400 text-xs text-center">{deleteError}</p>}
                    <button onClick={handleCodeSubmit} disabled={deleteCode.length !== 6 || deleteLoading}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-400 text-white transition disabled:opacity-50 flex items-center justify-center gap-2">
                      {deleteLoading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Confirm Delete
                    </button>
                    <button onClick={() => { setDeleteStep("awaiting"); setDeleteCode(""); setDeleteError(""); }}
                      className="w-full py-2 rounded-xl text-xs border border-white/10 text-gray-500 hover:text-white transition">← Back</button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#f0f4ff] dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Marketing <span className="text-[#c8202f]">Documents</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP · Marketing Department</p>
          </div>
          <button
            onClick={() => { setShowModal(true); setUploadError(""); setFile(null); setForm({ type: DOC_TYPES[0], note: "" }); }}
            className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-white font-bold">
            <Upload size={13} /> Import Document
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Documents", value: docs.length },
            { label: "Uploaded By",     value: new Set(docs.map(d => d.uploadedBy)).size },
            { label: "This Month",      value: docs.filter(d => new Date(d.createdAt).getMonth() === new Date().getMonth()).length },
            { label: "Document Types",  value: new Set(docs.map(d => d.type)).size },
          ].map((s, i) => (
            <div key={i} className={`${card} px-5 py-4`}>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? "—" : s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className={`${card} p-4 flex flex-wrap gap-3 items-center`}>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-8 pr-4 py-2 bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition placeholder:text-gray-400"
              placeholder="Search file name or note…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="relative">
            <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="pl-8 pr-8 py-2 bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none appearance-none transition">
              {types.map(t => <option key={t}>{t}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <span className="text-xs text-gray-500 ml-auto">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* ── Card grid — matching Sales style ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[#c8202f]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText size={36} className="text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-500">No documents found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(doc => (
              <motion.div key={doc._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`${card} p-5 flex flex-col gap-3`}>

                {/* Type badge + size */}
                <div className="flex items-start justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${TYPE_COLORS[doc.type] || TYPE_COLORS["Other"]}`}>
                    <FileText size={9} /> {doc.type}
                  </span>
                  <span className="text-[10px] text-gray-500">{formatBytes(doc.fileSize)}</span>
                </div>

                {/* Filename — click to preview */}
                <button onClick={() => handlePreview(doc)}
                  className="text-left text-sm font-bold text-gray-900 dark:text-white hover:text-[#c8202f] transition truncate">
                  {doc.fileName}
                </button>

                {/* Note */}
                {doc.note && (
                  <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 italic">{doc.note}</p>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-100 dark:border-white/[0.04]">
                  <span>By {doc.uploadedBy || "—"}</span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => handleDownload(doc)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-bold transition">
                    <Download size={11} /> Download
                  </button>
                  <button onClick={() => openDeleteModal(doc)}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition" title="Request deletion">
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Upload Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Upload Marketing Document</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition"><X size={18} /></button>
              </div>
              <div>
                <label className={labelClass}>Document Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {DOC_TYPES.map(type => (
                    <button key={type} type="button" onClick={() => setForm(f => ({ ...f, type }))}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition text-left ${form.type === type ? `${TYPE_COLORS[type]} border-current` : "border-gray-200 dark:border-white/10 text-gray-400 hover:border-gray-400 dark:hover:border-white/20"}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>{t("noteOptional")}</label>
                <input className={inputClass} placeholder="e.g. Contract renewal"
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>PDF File *</label>
                <div onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${file ? "border-[#c8202f] bg-[#c8202f]/5" : "border-gray-200 dark:border-white/10 hover:border-[#c8202f]/50"}`}>
                  {file ? (
                    <div><FileText size={24} className="mx-auto text-[#c8202f] mb-2" /><p className="text-xs font-bold text-[#c8202f] truncate">{file.name}</p><p className="text-[10px] text-gray-400 mt-0.5">{formatBytes(file.size)}</p></div>
                  ) : (
                    <div><Upload size={24} className="mx-auto text-gray-400 dark:text-gray-600 mb-2" /><p className="text-xs text-gray-400">Click to select a PDF</p><p className="text-[10px] text-gray-400 mt-0.5">Max 10MB</p></div>
                  )}
                  <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={onFileChange} />
                </div>
              </div>
              {uploadError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{uploadError}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-xl text-xs border border-gray-200 dark:border-white/10 text-gray-400 hover:border-gray-400 dark:hover:border-white/20 transition">Cancel</button>
                <button onClick={handleUpload} disabled={uploading}
                  className="flex-1 py-2 rounded-xl text-xs bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {uploading ? <><div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> Uploading…</> : <><Upload size={12} /> Upload</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PDF Preview Modal ── */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
            onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-red-400" />
                <span className="text-sm font-bold text-white truncate">{preview.name}</span>
              </div>
              <button onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}
                className="text-gray-400 hover:text-white transition p-2 rounded-xl hover:bg-white/5"><X size={18} /></button>
            </div>
            <div className="flex-1 p-4" onClick={e => e.stopPropagation()}>
              <iframe src={preview.url} className="w-full h-full rounded-xl border border-white/10" title={preview.name} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </ProtectedRoute>
  );
}