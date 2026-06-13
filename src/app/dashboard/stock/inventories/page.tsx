"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, Loader2, Plus, Search, Send, X, CheckCircle2,
  XCircle, ChevronDown, Download, Trash2, AlertTriangle,
  PackageCheck, RotateCcw, Clock, FileSpreadsheet,
} from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { stockInventoryService } from "@/services/stock/stockInventoryService";
import { stockProductService } from "@/services/stock/stockProductService";
import { stockDepotService, Depot } from "@/services/stock/stockDepotService";
import { documentService } from "@/services/stock/documentService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product { _id: string; sku: string; name: string; status: "ACTIVE" | "INACTIVE" }

interface RejectionEntry {
  rejectedBy?: { name: string; role: string } | null;
  createdAt: string;
}

interface DepotResponseEntry {
  response: string;
  respondedBy?: { name: string; role: string } | null;
  createdAt: string;
}

interface InventorySession {
  _id: string;
  code: string;
  type: "PERIODIC" | "PERMANENT";
  status: "IN_PROGRESS" | "SENT_TO_DEPOT" | "PENDING_APPROVAL" | "CLOSED";
  notes?: string;
  startedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  depotId?: { _id: string; name: string } | null;
  startedBy?: { _id: string; name: string; role: string } | null;
  approvedBy?: { _id: string; name: string; role: string } | null;
  rejectionHistory?: RejectionEntry[];
  depotResponse?: string;
  depotResponseHistory?: DepotResponseEntry[];
}

interface InventoryLine {
  _id: string;
  productId: { _id: string; name: string; sku: string };
  systemQuantity: number;
  countedQuantity: number;
  varianceQuantity: number;
  status: "PENDING" | "COUNTED";
  notes?: string;
  countedBy?: { name: string } | null;
  countedAt?: string | null;
}

interface JournalRow {
  invCode: string;
  depot: string;
  product: string;
  sku: string;
  systemQuantity: number;
  countedQuantity: number;
  variance: number;
  closedAt: string | null;
}

// ─── Styling ──────────────────────────────────────────────────────────────────

const surface = "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
const inputCls = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";
const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400";

const statusBadge = (status: string) => {
  const m: Record<string, string> = {
    IN_PROGRESS:      "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    SENT_TO_DEPOT:    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    PENDING_APPROVAL: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    CLOSED:           "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  };
  return m[status] ?? "bg-slate-100 text-slate-600";
};

const formatDate = (v?: string | null) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
            <X size={15} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

// ─── Variance pill ────────────────────────────────────────────────────────────

function VariancePill({ v }: { v: number }) {
  if (v === 0) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">0</span>;
  if (v > 0)   return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">+{v}</span>;
  return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{v}</span>;
}

// ─── Inventory PDF builder ────────────────────────────────────────────────────

async function buildInventoryPdf(session: InventorySession, lines: InventoryLine[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, MARGIN = 14, PAGE_H = 297;

  // Logo
  let logoDataUrl: string | null = null;
  try {
    const res = await fetch("/EMMlogo.png");
    const blob = await res.blob();
    logoDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { /* optional */ }
  if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", MARGIN, 8, 28, 18);

  // Company / Title
  doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(100, 116, 139);
  doc.text("Route de Gabès Km 6, Sfax, Tunisie", MARGIN, 30);
  doc.text("Tél : +(216) 98 241 790  ·  info@emmtn.com", MARGIN, 34);

  doc.setFontSize(20).setFont("helvetica", "bold").setTextColor(15, 23, 42);
  doc.text("RAPPORT D'INVENTAIRE", W - MARGIN, 14, { align: "right" });
  doc.setFontSize(11).setFont("helvetica", "normal").setTextColor(51, 65, 85);
  doc.text(session.code, W - MARGIN, 21, { align: "right" });

  doc.setFontSize(8).setTextColor(100, 116, 139);
  doc.text(`Type : ${session.type}`, W - MARGIN, 27, { align: "right" });
  doc.text(`Dépôt : ${session.depotId?.name || "—"}`, W - MARGIN, 32, { align: "right" });
  doc.text(`Clôturé le : ${session.closedAt ? new Date(session.closedAt).toLocaleDateString("fr-FR") : "—"}`, W - MARGIN, 37, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, 42, W - MARGIN, 42);

  // Info box
  const boxY = 46, boxH = 22;
  doc.setFillColor(248, 250, 252).setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN, boxY, W - MARGIN * 2, boxH, 2, 2, "FD");

  doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(100, 116, 139);
  doc.text("INFORMATIONS DE LA SESSION", MARGIN + 3, boxY + 5);

  doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(15, 23, 42);
  doc.text(`Démarré par : ${session.startedBy?.name || "—"}`, MARGIN + 3, boxY + 11);
  doc.text(`Approuvé par : ${session.approvedBy?.name || "—"}`, MARGIN + 3, boxY + 17);
  doc.text(`Statut : ${session.status}`, W / 2 + 3, boxY + 11);
  doc.text(`Lignes : ${lines.length}`, W / 2 + 3, boxY + 17);

  // Stats
  const totals = lines.reduce(
    (acc, l) => {
      acc.sys += l.systemQuantity;
      acc.cnt += l.countedQuantity;
      if (l.varianceQuantity > 0) acc.pos += l.varianceQuantity;
      if (l.varianceQuantity < 0) acc.neg += Math.abs(l.varianceQuantity);
      return acc;
    },
    { sys: 0, cnt: 0, pos: 0, neg: 0 }
  );

  // Lines table
  const tableRows = lines.map((l, i) => [
    String(i + 1),
    l.productId?.sku || "—",
    l.productId?.name || "—",
    String(l.systemQuantity),
    String(l.countedQuantity),
    l.varianceQuantity > 0 ? `+${l.varianceQuantity}` : String(l.varianceQuantity),
  ]);

  autoTable(doc, {
    startY: boxY + boxH + 6,
    margin: { left: MARGIN, right: MARGIN },
    head: [["N°", "Réf.", "Désignation", "Qté Système", "Qté Comptée", "Variance"]],
    body: tableRows,
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 30 },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 25, halign: "center" },
      5: { cellWidth: 22, halign: "center", fontStyle: "bold" },
    },
  });

  const afterTable = (doc as any).lastAutoTable.finalY + 6;

  // Totals summary
  const sumX = W - MARGIN - 78;
  doc.setFillColor(248, 250, 252).setDrawColor(226, 232, 240);
  doc.roundedRect(sumX, afterTable, 78, 32, 2, 2, "FD");
  doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(100, 116, 139);
  doc.text("RÉSUMÉ", sumX + 3, afterTable + 5);
  doc.setFontSize(8.5).setFont("helvetica", "normal").setTextColor(15, 23, 42);
  doc.text(`Total système : ${totals.sys}`, sumX + 3, afterTable + 11);
  doc.text(`Total compté : ${totals.cnt}`, sumX + 3, afterTable + 17);
  doc.setTextColor(22, 163, 74);
  doc.text(`Surplus : +${totals.pos}`, sumX + 3, afterTable + 23);
  doc.setTextColor(220, 38, 38);
  doc.text(`Manquant : -${totals.neg}`, sumX + 3, afterTable + 29);

  // Footer
  doc.setDrawColor(226, 232, 240).setLineWidth(0.2);
  doc.line(MARGIN, PAGE_H - 10, W - MARGIN, PAGE_H - 10);
  doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(148, 163, 184);
  doc.text("EMM TN · Route de Gabès Km 6, Sfax · +(216) 98 241 790 · info@emmtn.com",
    W / 2, PAGE_H - 6, { align: "center" });

  return doc.output("blob");
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StockInventoriesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const isStock = user?.role === "STOCK_MANAGER";
  const isDepot = user?.role === "DEPOT_MANAGER";
  const isAdmin = user?.role === "ADMIN";
  const canCreate  = isStock || isAdmin;
  const canApprove = isStock || isAdmin;
  const canCount   = isDepot || isAdmin;

  // Data
  const [sessions, setSessions]   = useState<InventorySession[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [depots,   setDepots]     = useState<Depot[]>([]);
  const [selected, setSelected]   = useState<InventorySession | null>(null);
  const [lines,    setLines]      = useState<InventoryLine[]>([]);

  // UI
  const [tab,         setTab]         = useState<"active" | "log">("active");
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(true);
  const [lineLoading, setLineLoading] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");
  const [formError,   setFormError]   = useState("");
  const [successMsg,  setSuccessMsg]  = useState("");

  // Modals
  const [showCreate,  setShowCreate]  = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [showReject,  setShowReject]  = useState(false);

  // Forms
  const [sessionForm, setSessionForm] = useState({
    type: "PERIODIC" as "PERIODIC" | "PERMANENT",
    notes: "",
    depotId: "",
    dateDebut: "",
    dateFin: "",
    year: new Date().getFullYear(),
  });
  const [lineForm,    setLineForm]    = useState({ productIds: [] as string[], notes: "" });
  const [lineSearch,  setLineSearch]  = useState("");

  // Depot count: lineId → typed quantity string
  const [countValues, setCountValues] = useState<Record<string, string>>({});

  // Depot response to rejection
  const [depotResponseText, setDepotResponseText] = useState("");

  // Journal flat table rows (log tab)
  const [journalRows,    setJournalRows]    = useState<JournalRow[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true); setError("");
      const [sess, ...rest] = await Promise.all([
        stockInventoryService.getAll(),
        ...(canCreate ? [stockDepotService.getAll(), stockProductService.getAll()] : []),
      ]);
      setSessions(sess);
      if (canCreate) {
        setDepots(rest[0]);
        setProducts((rest[1] as Product[]).filter((p) => p.status === "ACTIVE"));
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load inventories.");
    } finally {
      setLoading(false);
    }
  }, [canCreate, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchLines = useCallback(async (id: string) => {
    try {
      setLineLoading(true);
      const data: InventoryLine[] = await stockInventoryService.getLines(id);
      setLines(data);
      const vals: Record<string, string> = {};
      data.forEach((l) => { vals[l._id] = ""; });
      setCountValues(vals);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load lines.");
    } finally {
      setLineLoading(false);
    }
  }, []);

  const openSession = async (s: InventorySession) => {
    setSelected(s);
    setFormError(""); setSuccessMsg("");
    await fetchLines(s._id);
  };

  const refreshSelected = async () => {
    const all: InventorySession[] = await stockInventoryService.getAll();
    setSessions(all);
    if (selected) {
      const updated = all.find((s) => s._id === selected._id);
      if (updated) {
        setSelected(updated);
        const freshLines: InventoryLine[] = await stockInventoryService.getLines(updated._id);
        setLines(freshLines);
        const vals: Record<string, string> = {};
        freshLines.forEach((l) => { vals[l._id] = ""; });
        setCountValues(vals);
      }
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const active = useMemo(() => sessions.filter((s) => s.status !== "CLOSED"), [sessions]);
  const closed = useMemo(() => sessions.filter((s) => s.status === "CLOSED"),  [sessions]);

  const filteredActive = useMemo(() => {
    const q = search.toLowerCase();
    return active.filter((s) =>
      s.code.toLowerCase().includes(q) ||
      (s.depotId?.name ?? "").toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    );
  }, [active, search]);

  const filteredClosed = useMemo(() => {
    const q = search.toLowerCase();
    return closed.filter((s) =>
      s.code.toLowerCase().includes(q) || (s.depotId?.name ?? "").toLowerCase().includes(q)
    );
  }, [closed, search]);

  const usedProductIds = useMemo(() => new Set(lines.map((l) => l.productId._id)), [lines]);

  const allCountFilled = useMemo(
    () => lines.length > 0 && lines.every((l) => (countValues[l._id] ?? "").trim() !== ""),
    [lines, countValues]
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  const flash = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCreateSession = async () => {
    if (!sessionForm.depotId) { setFormError(t("selectDepot")); return; }
    if (sessionForm.type === "PERIODIC") {
      if (!sessionForm.dateDebut || !sessionForm.dateFin) { setFormError("Date début and date fin are required."); return; }
      if (new Date(sessionForm.dateFin) < new Date(sessionForm.dateDebut)) { setFormError("Date fin must be after date début."); return; }
    }
    if (sessionForm.type === "PERMANENT") {
      const cutoff = new Date(sessionForm.year, 6, 31);
      if (new Date() < cutoff) { setFormError(`Permanent inventory for ${sessionForm.year} requires the date to be at least July 31, ${sessionForm.year}.`); return; }
    }
    try {
      setSubmitting(true); setFormError("");
      await stockInventoryService.create(sessionForm);
      setShowCreate(false);
      setSessionForm({ type: "PERIODIC", notes: "", depotId: "", dateDebut: "", dateFin: "", year: new Date().getFullYear() });
      await fetchAll();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || "Failed to create session.");
    } finally { setSubmitting(false); }
  };

  const handleAddLine = async () => {
    if (lineForm.productIds.length === 0) { setFormError(t("selectProduct")); return; }
    if (!selected) return;
    try {
      setSubmitting(true); setFormError("");
      await Promise.all(
        lineForm.productIds.map((pid) =>
          stockInventoryService.addLine(selected._id, { productId: pid, notes: lineForm.notes })
        )
      );
      setShowAddLine(false);
      setLineForm({ productIds: [], notes: "" });
      setLineSearch("");
      await fetchLines(selected._id);
    } catch (e: any) {
      setFormError(e?.response?.data?.message || "Failed to add lines.");
    } finally { setSubmitting(false); }
  };

  const handleRemoveLine = async (lineId: string) => {
    if (!selected) return;
    try {
      await stockInventoryService.removeLine(selected._id, lineId);
      await fetchLines(selected._id);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to remove line.");
    }
  };

  const handleSendToDepot = async () => {
    if (!selected) return;
    try {
      setSubmitting(true); setError("");
      await stockInventoryService.sendToDepot(selected._id);
      flash(t("sendToDepot") + " ✓");
      await refreshSelected();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send to depot.");
    } finally { setSubmitting(false); }
  };

  const handleSubmitCount = async () => {
    if (!selected || !allCountFilled) { setFormError(t("allCountsFilled")); return; }
    const payload = lines.map((l) => ({ lineId: l._id, countedQuantity: Number(countValues[l._id]) }));
    try {
      setSubmitting(true); setFormError("");
      await stockInventoryService.submitDepotCount(selected._id, payload);
      flash(t("waitingForApproval"));
      await refreshSelected();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || "Failed to submit count.");
    } finally { setSubmitting(false); }
  };

  const handleSubmitDepotResponse = async () => {
    if (!selected) return;
    if (!depotResponseText.trim()) { setFormError(t("depotResponseRequired")); return; }
    try {
      setSubmitting(true); setFormError("");
      await stockInventoryService.submitDepotResponse(selected._id, depotResponseText.trim());
      setDepotResponseText("");
      flash(t("waitingForApproval"));
      await refreshSelected();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || "Failed to submit response.");
    } finally { setSubmitting(false); }
  };

  const handleApprove = async () => {
    if (!selected) return;
    try {
      setSubmitting(true); setError("");
      await stockInventoryService.approveInventory(selected._id);
      flash(t("sessionApprovedMsg"));
      await refreshSelected();

      // Auto-save inventory report as PDF to the documents page
      try {
        const closedSession = await stockInventoryService.getById(selected._id);
        const closedLines   = await stockInventoryService.getLines(selected._id);
        const pdfBlob = await buildInventoryPdf(closedSession, closedLines);
        const date = new Date().toISOString().slice(0, 10);
        const file = new File([pdfBlob], `Inventaire-${closedSession.code}-${date}.pdf`, { type: "application/pdf" });
        await documentService.upload(file, `Rapport d'inventaire ${closedSession.code} — ${closedSession.depotId?.name || ""}`);
      } catch (uploadErr) {
        console.error("Inventory PDF auto-save failed:", uploadErr);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to approve.");
    } finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!selected) return;
    try {
      setSubmitting(true); setFormError("");
      await stockInventoryService.rejectInventory(selected._id);
      setShowReject(false);
      flash(t("sessionRejectedMsg"));
      await refreshSelected();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || "Failed to reject.");
    } finally { setSubmitting(false); }
  };

  const loadJournalData = useCallback(async (closedSessions: InventorySession[]) => {
    if (closedSessions.length === 0) { setJournalRows([]); return; }
    setJournalLoading(true);
    try {
      const allLines = await Promise.all(closedSessions.map((s) => stockInventoryService.getLines(s._id)));
      const rows: JournalRow[] = [];
      closedSessions.forEach((s, i) => {
        (allLines[i] as InventoryLine[]).forEach((l) => {
          rows.push({
            invCode: s.code,
            depot: s.depotId?.name ?? "—",
            product: l.productId.name,
            sku: l.productId.sku,
            systemQuantity: l.systemQuantity,
            countedQuantity: l.countedQuantity,
            variance: l.varianceQuantity,
            closedAt: s.closedAt ?? null,
          });
        });
      });
      setJournalRows(rows);
    } catch { } finally { setJournalLoading(false); }
  }, []);

  // Load journal rows when entering the log tab (placed after loadJournalData is defined)
  useEffect(() => {
    if (tab === "log" && !loading) {
      loadJournalData(sessions.filter((s) => s.status === "CLOSED"));
    }
  }, [tab, loading, sessions, loadJournalData]);

  const exportJournalCSV = () => {
    const header = "Session,Depot,Product,SKU,System Qty,Counted Qty,Écart,Date\n";
    const body = journalRows.map((r) =>
      `${r.invCode},"${r.depot}","${r.product}",${r.sku},${r.systemQuantity},${r.countedQuantity},${r.variance},"${formatDate(r.closedAt)}"`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "inventory-journal.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Session card ───────────────────────────────────────────────────────────

  const SessionCard = ({ s }: { s: InventorySession }) => {
    const isActive = selected?._id === s._id;
    return (
      <button
        onClick={() => openSession(s)}
        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${isActive ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs font-semibold">{s.code}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${isActive ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-900" : statusBadge(s.status)}`}>
            {s.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className={`mt-1 text-xs ${isActive ? "text-slate-300 dark:text-slate-600" : "text-slate-400"}`}>
          {s.depotId?.name ?? "—"} · {s.type}
        </div>
        {s.rejectionHistory && s.rejectionHistory.length > 0 && s.status === "SENT_TO_DEPOT" && (
          <div className={`mt-1.5 flex items-center gap-1 text-[10px] ${isActive ? "text-amber-300" : "text-amber-600 dark:text-amber-400"}`}>
            <AlertTriangle size={9} /> {t("previouslyRejected")}
          </div>
        )}
      </button>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER", "DEPOT_MANAGER"]}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("inventoryControl")} · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <ClipboardList size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {t("inventories")} <span className="text-slate-400 dark:text-slate-500">{t("management")}</span>
              </h1>
            </div>
          </div>
          {canCreate && (
            <button
              onClick={() => { setShowCreate(true); setFormError(""); }}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              <Plus size={15} /> {t("newSession")}
            </button>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
            <XCircle size={14} /> {error}
          </div>
        )}
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
          >
            <CheckCircle2 size={14} /> {successMsg}
          </motion.div>
        )}

        {/* Tabs — stock/admin only */}
        {(canCreate || isAdmin) && (
          <div className="flex gap-1 w-fit rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
            {(["active", "log"] as const).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`rounded-xl px-4 py-1.5 text-sm font-medium transition ${tab === tabKey ? "bg-white shadow text-slate-950 dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
              >
                {tabKey === "active" ? t("activeSessions") : t("logTab")}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> {t("loading")}
          </div>

        ) : tab === "log" && !isDepot ? (

          /* ── Journal full-width table ──────────────────────────────────── */
          <div className={`${surface} overflow-hidden`}>
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-slate-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("logTab")}</span>
                {journalRows.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {journalRows.length} {t("lines")}
                  </span>
                )}
              </div>
              <button
                onClick={exportJournalCSV}
                disabled={journalRows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Download size={14} /> {t("exportJournal")}
              </button>
            </div>

            {journalLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" /> {t("loading")}
              </div>
            ) : journalRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <FileSpreadsheet size={16} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-400">{t("noClosedSessions")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/40">
                    <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      <th className="px-5 py-3 font-medium">{t("session")}</th>
                      <th className="px-5 py-3 font-medium">{t("depots")}</th>
                      <th className="px-5 py-3 font-medium">{t("product")}</th>
                      <th className="px-5 py-3 font-medium">SKU</th>
                      <th className="px-5 py-3 font-medium text-right">{t("systemCol")}</th>
                      <th className="px-5 py-3 font-medium text-right">{t("physicalCountQty")}</th>
                      <th className="px-5 py-3 font-medium text-right">Écart</th>
                      <th className="px-5 py-3 font-medium">CLOSED</th>
                      <th className="px-5 py-3 font-medium">{t("date")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {journalRows.map((row, i) => (
                      <tr key={i} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/20">
                        <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{row.invCode}</td>
                        <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{row.depot}</td>
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{row.product}</td>
                        <td className="px-5 py-3 text-xs text-slate-400">{row.sku}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{row.systemQuantity}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{row.countedQuantity}</td>
                        <td className="px-5 py-3 text-right"><VariancePill v={row.variance} /></td>
                        <td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">CLOSED</span></td>
                        <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(row.closedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">

            {/* ── Session list ───────────────────────────────────────────── */}
            <div className="space-y-2">
              {!isDepot && (
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-slate-600"
                    placeholder={t("searchNotes")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}

              {isDepot ? (
                active.length === 0
                  ? <p className="py-10 text-center text-sm text-slate-400">{t("noSessionsFound")}</p>
                  : active.map((s) => <SessionCard key={s._id} s={s} />)
              ) : (
                filteredActive.length === 0
                  ? <p className="py-10 text-center text-sm text-slate-400">{t("noSessionsFound")}</p>
                  : filteredActive.map((s) => <SessionCard key={s._id} s={s} />)
              )}
            </div>

            {/* ── Session detail ─────────────────────────────────────────── */}
            <div>
              {!selected ? (
                <div className={`${surface} flex flex-col items-center justify-center py-20 text-center`}>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <ClipboardList size={20} className="text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-400">{t("selectSessionPrompt")}</p>
                </div>
              ) : (
                <div className={`${surface} overflow-hidden`}>

                  {/* Session header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold tracking-tight text-slate-950 dark:text-white">{selected.code}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(selected.status)}`}>
                          {selected.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {selected.depotId?.name ?? "—"} · {selected.type}
                        {selected.startedBy && ` · ${t("startedByPrefix")} ${selected.startedBy.name}`}
                      </p>
                      {selected.notes && <p className="mt-1 text-xs text-slate-400">{selected.notes}</p>}
                    </div>

                    {/* Stock Manager: IN_PROGRESS controls */}
                    {canApprove && selected.status === "IN_PROGRESS" && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => { setShowAddLine(true); setFormError(""); setLineForm({ productIds: [], notes: "" }); setLineSearch(""); }}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Plus size={14} /> {t("addLineBtn")}
                        </button>
                        {lines.length > 0 && (
                          <button
                            onClick={handleSendToDepot} disabled={submitting}
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
                          >
                            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            {t("sendToDepot")}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Stock Manager: PENDING_APPROVAL controls */}
                    {canApprove && selected.status === "PENDING_APPROVAL" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setShowReject(true); setFormError(""); }}
                          className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
                        >
                          <XCircle size={14} /> {t("rejectSession")}
                        </button>
                        <button
                          onClick={handleApprove} disabled={submitting}
                          className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {submitting ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
                          {t("approveSession")}
                        </button>
                      </div>
                    )}

                    {/* Depot Manager: SENT_TO_DEPOT — first count (no prior rejection) */}
                    {canCount && selected.status === "SENT_TO_DEPOT" && !(selected.rejectionHistory?.length) && (
                      <button
                        onClick={handleSubmitCount} disabled={submitting || !allCountFilled}
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                      >
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {t("submitDepotCount")}
                      </button>
                    )}
                  </div>

                  {/* Rejection banner — shown to depot after stock manager rejects */}
                  {!!(selected.rejectionHistory?.length) && selected.status === "SENT_TO_DEPOT" && (
                    <div className="mx-6 mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                      <div className="mb-1 flex items-center gap-2">
                        <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">{t("previouslyRejected")}</span>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Your submission was rejected. Please write your explanation below and resubmit.
                      </p>
                    </div>
                  )}

                  {/* Depot manager response form — shown after rejection */}
                  {canCount && selected.status === "SENT_TO_DEPOT" && !!(selected.rejectionHistory?.length) && (
                    <div className="mx-6 mt-4 space-y-3">
                      <label className={labelCls}>{t("depotResponseLabel")}</label>
                      <textarea
                        className={`${inputCls} resize-none`} rows={4}
                        placeholder={t("depotResponsePlaceholder")}
                        value={depotResponseText}
                        onChange={(e) => setDepotResponseText(e.target.value)}
                      />
                      <button
                        onClick={handleSubmitDepotResponse} disabled={submitting || !depotResponseText.trim()}
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                      >
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {t("submitDepotResponse")}
                      </button>
                    </div>
                  )}

                  {/* Depot response banner — visible to stock manager in PENDING_APPROVAL */}
                  {selected.depotResponse && selected.status === "PENDING_APPROVAL" && canApprove && (
                    <div className="mx-6 mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/40 dark:bg-sky-950/20">
                      <div className="mb-1 flex items-center gap-2">
                        <PackageCheck size={13} className="text-sky-600 dark:text-sky-400" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">{t("depotResponseBanner")}</span>
                      </div>
                      <p className="text-sm text-sky-800 dark:text-sky-300">{selected.depotResponse}</p>
                    </div>
                  )}

                  {/* Status banners */}
                  {selected.status === "SENT_TO_DEPOT" && canApprove && (
                    <div className="mx-6 mt-5 flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300">
                      <Clock size={14} />
                      {(selected.rejectionHistory?.length ?? 0) > 0 ? t("waitingForDepotResponse") : t("waitingForDepotCount")}
                    </div>
                  )}
                  {selected.status === "PENDING_APPROVAL" && canCount && (
                    <div className="mx-6 mt-5 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                      <Clock size={14} /> {t("waitingForApproval")}
                    </div>
                  )}
                  {selected.status === "CLOSED" && (
                    <div className="mx-6 mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400">
                      <CheckCircle2 size={14} />
                      {t("sessionApprovedMsg")} · {formatDate(selected.closedAt)}
                      {selected.approvedBy && ` · ${t("byPrefix")} ${selected.approvedBy.name}`}
                    </div>
                  )}

                  {/* Form error */}
                  {formError && (
                    <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
                      <XCircle size={13} /> {formError}
                    </div>
                  )}

                  {/* Lines table */}
                  <div className="p-6">
                    {lineLoading ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                        <Loader2 size={14} className="animate-spin" /> {t("loadingLines")}
                      </div>
                    ) : lines.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                          <ClipboardList size={16} className="text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-400">{t("noLinesYet")}</p>
                        {canApprove && selected.status === "IN_PROGRESS" && (
                          <p className="mt-1 text-xs text-slate-400">{t("addFirstLine")}</p>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800/40">
                            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                              <th className="px-5 py-3 font-medium">{t("product")}</th>
                              <th className="px-5 py-3 font-medium">{t("systemCol")}</th>
                              <th className="px-5 py-3 font-medium">{t("physicalCountQty")}</th>
                              <th className="px-5 py-3 font-medium">{t("varianceCol")}</th>
                              {selected.status === "IN_PROGRESS" && canApprove && <th className="px-5 py-3" />}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {lines.map((line) => {
                              // Live variance preview for depot manager during counting
                              const inputVal = countValues[line._id] ?? "";
                              const liveVariance = inputVal !== "" ? Number(inputVal) - line.systemQuantity : null;

                              return (
                                <tr key={line._id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                  <td className="px-5 py-3.5">
                                    <p className="font-medium text-slate-900 dark:text-white">{line.productId.name}</p>
                                    <p className="text-[11px] text-slate-400">{line.productId.sku}</p>
                                  </td>
                                  <td className="px-5 py-3.5 tabular-nums text-slate-700 dark:text-slate-300">
                                    {line.systemQuantity}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    {/* Depot enters qty — only on first count (no prior rejection) */}
                                    {canCount && selected.status === "SENT_TO_DEPOT" && !(selected.rejectionHistory?.length) ? (
                                      <input
                                        type="number" min="0" step="1"
                                        value={inputVal}
                                        onChange={(e) => setCountValues((p) => ({ ...p, [line._id]: e.target.value }))}
                                        placeholder="0"
                                        className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm tabular-nums outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                      />
                                    ) : (
                                      <span className={`tabular-nums ${line.status === "PENDING" ? "text-slate-400" : "text-slate-700 dark:text-slate-300"}`}>
                                        {line.status === "PENDING" ? "—" : line.countedQuantity}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    {canCount && selected.status === "SENT_TO_DEPOT" && !(selected.rejectionHistory?.length)
                                      ? liveVariance !== null ? <VariancePill v={liveVariance} /> : <span className="text-slate-400 text-xs">—</span>
                                      : line.status === "PENDING"
                                      ? <span className="text-slate-400 text-xs">—</span>
                                      : <VariancePill v={line.varianceQuantity} />
                                    }
                                  </td>
                                  {selected.status === "IN_PROGRESS" && canApprove && (
                                    <td className="px-5 py-3.5">
                                      <button
                                        onClick={() => handleRemoveLine(line._id)}
                                        className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Rejection history */}
                  {selected.rejectionHistory && selected.rejectionHistory.length > 0 && (
                    <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                          <RotateCcw size={12} />
                          {t("rejectionHistory")} ({selected.rejectionHistory.length})
                          <ChevronDown size={12} className="ml-auto transition group-open:rotate-180" />
                        </summary>
                        <div className="mt-3 space-y-2">
                          {selected.rejectionHistory.map((entry, i) => {
                            const depotRes = selected.depotResponseHistory?.[i];
                            return (
                              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                                <div className="mb-0.5 flex items-center gap-2">
                                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">REJECTED</span>
                                  {entry.rejectedBy && <span className="text-[10px] text-slate-400">{entry.rejectedBy.name}</span>}
                                  <span className="ml-auto text-[10px] text-slate-400">{formatDate(entry.createdAt)}</span>
                                </div>
                                {depotRes && (
                                  <div className="mt-1.5 rounded-lg bg-sky-50 px-2 py-1.5 dark:bg-sky-950/30">
                                    <div className="mb-0.5 flex items-center gap-1.5">
                                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-semibold text-sky-600 dark:bg-sky-900 dark:text-sky-300">DEPOT RESPONSE</span>
                                      {depotRes.respondedBy && <span className="text-[10px] text-slate-400">{depotRes.respondedBy.name}</span>}
                                      <span className="ml-auto text-[10px] text-slate-400">{formatDate(depotRes.createdAt)}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300">{depotRes.response}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>

        {showCreate && (
          <Modal title={t("newInventorySession")} onClose={() => setShowCreate(false)}>
            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className={labelCls}>{t("type")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["PERIODIC", "PERMANENT"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSessionForm((p) => ({ ...p, type: opt }))}
                      className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                        sessionForm.type === opt
                          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      {opt === "PERIODIC" ? "Périodique" : "Permanente"}
                    </button>
                  ))}
                </div>
              </div>

              {/* PERIODIC: date range */}
              {sessionForm.type === "PERIODIC" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Date début</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={sessionForm.dateDebut}
                      onChange={(e) => setSessionForm((p) => ({ ...p, dateDebut: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Date fin</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={sessionForm.dateFin}
                      min={sessionForm.dateDebut || undefined}
                      onChange={(e) => setSessionForm((p) => ({ ...p, dateFin: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* PERMANENT: year selector */}
              {sessionForm.type === "PERMANENT" && (() => {
                const today = new Date();
                const currentYear = today.getFullYear();
                const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i).filter(
                  (y) => today >= new Date(y, 6, 31)
                );
                return (
                  <div>
                    <label className={labelCls}>Année fiscale</label>
                    {availableYears.length === 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400">
                        Aucune année disponible — vous devez être au moins le 31 juillet de l&apos;année concernée.
                      </div>
                    ) : (
                      <select
                        className={inputCls}
                        value={sessionForm.year}
                        onChange={(e) => setSessionForm((p) => ({ ...p, year: Number(e.target.value) }))}
                      >
                        {availableYears.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })()}

              {/* Depot */}
              <div>
                <label className={labelCls}>{t("depots")}</label>
                <select className={inputCls} value={sessionForm.depotId} onChange={(e) => setSessionForm((p) => ({ ...p, depotId: e.target.value }))}>
                  <option value="">{t("selectDepot")}</option>
                  {depots.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls}>{t("notesOptional")}</label>
                <textarea className={`${inputCls} resize-none`} rows={2} placeholder={t("sessionNotesPlaceholder")} value={sessionForm.notes} onChange={(e) => setSessionForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>

              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={handleCreateSession} disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950">
                  {submitting && <Loader2 size={13} className="animate-spin" />} {t("createSession")}
                </button>
                <button onClick={() => setShowCreate(false)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t("cancel")}</button>
              </div>
            </div>
          </Modal>
        )}

        {showAddLine && (
          <Modal title={t("addCountLine")} onClose={() => setShowAddLine(false)}>
            <div className="space-y-4">
              {/* Search + select all */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className={labelCls}>{t("product")}</label>
                  {lineForm.productIds.length > 0 && (
                    <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                      {lineForm.productIds.length} sélectionné{lineForm.productIds.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={lineSearch}
                    onChange={(e) => setLineSearch(e.target.value)}
                    placeholder="Rechercher un produit…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                {/* Select all / deselect all */}
                {(() => {
                  const avail = products.filter((p) => !usedProductIds.has(p._id) && (p.name.toLowerCase().includes(lineSearch.toLowerCase()) || p.sku.toLowerCase().includes(lineSearch.toLowerCase())));
                  const allSelected = avail.length > 0 && avail.every((p) => lineForm.productIds.includes(p._id));
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (allSelected) {
                            setLineForm((f) => ({ ...f, productIds: f.productIds.filter((id) => !avail.find((p) => p._id === id)) }));
                          } else {
                            const newIds = [...new Set([...lineForm.productIds, ...avail.map((p) => p._id)])];
                            setLineForm((f) => ({ ...f, productIds: newIds }));
                          }
                        }}
                        className="mb-2 text-[11px] font-medium text-slate-500 underline underline-offset-2 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        {allSelected ? "Désélectionner tout" : "Sélectionner tout"}
                      </button>
                      <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 dark:border-slate-700 dark:divide-slate-800">
                        {avail.length === 0 ? (
                          <p className="py-6 text-center text-xs text-slate-400">Aucun produit disponible</p>
                        ) : avail.map((p) => {
                          const checked = lineForm.productIds.includes(p._id);
                          return (
                            <label key={p._id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition ${checked ? "bg-teal-50 dark:bg-teal-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setLineForm((f) => ({
                                  ...f,
                                  productIds: checked
                                    ? f.productIds.filter((id) => id !== p._id)
                                    : [...f.productIds, p._id],
                                }))}
                                className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{p.name}</p>
                                <p className="text-[10px] text-slate-400">{p.sku}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
                <p className="mt-1.5 text-xs text-slate-400">Les quantités système sont chargées automatiquement.</p>
              </div>
              <div>
                <label className={labelCls}>{t("notesOptional")}</label>
                <input className={inputCls} placeholder={t("optionalNotesPlaceholder")} value={lineForm.notes} onChange={(e) => setLineForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={handleAddLine} disabled={submitting || lineForm.productIds.length === 0} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950">
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  {lineForm.productIds.length > 0 ? `Ajouter ${lineForm.productIds.length} produit${lineForm.productIds.length > 1 ? "s" : ""}` : t("addLineBtn")}
                </button>
                <button onClick={() => setShowAddLine(false)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t("cancel")}</button>
              </div>
            </div>
          </Modal>
        )}

        {showReject && (
          <Modal title={t("rejectSession")} onClose={() => setShowReject(false)}>
            <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                The session will be sent back to the depot manager. They will see the rejection and must write an explanation before resubmitting.
              </p>
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={handleReject} disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50">
                  {submitting && <Loader2 size={13} className="animate-spin" />} {t("rejectSession")}
                </button>
                <button onClick={() => setShowReject(false)} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t("cancel")}</button>
              </div>
            </div>
          </Modal>
        )}

      </AnimatePresence>
    </ProtectedRoute>
  );
}
