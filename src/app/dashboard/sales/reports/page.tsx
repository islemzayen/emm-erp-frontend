"use client";
import React from "react";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Download, BarChart2, ShoppingCart, DollarSign,
  Truck, RotateCcw, Loader2, CheckCircle, Package,
} from "lucide-react";
import { useState, useEffect } from "react";
import { salesService } from "@/services/salesService";

// ── helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function logoBase64(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch { return null; }
}

async function exportToPDF(
  title: string, subtitle: string,
  headers: string[], rows: (string | number)[][], filename: string
) {
  const { default: jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Logo top-left
  const logo = await logoBase64();
  if (logo) {
    const maxW = 30, maxH = 18;
    let lw = maxW, lh = maxH;
    try {
      const props = doc.getImageProperties(logo);
      const ratio = (props.width || 1) / (props.height || 1);
      lw = maxW; lh = lw / ratio;
      if (lh > maxH) { lh = maxH; lw = lh * ratio; }
    } catch { lw = maxW; lh = maxW * 0.66; }
    doc.addImage(logo, "PNG", 8, 6, lw, lh);
  } else {
    doc.setFillColor(40, 8, 12);
    doc.roundedRect(8, 8, 22, 8, 2, 2, "F");
    doc.setTextColor(200, 32, 47); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("EMM ERP", 19, 13.2, { align: "center" });
  }

  // Centered title
  doc.setTextColor(200, 32, 47); doc.setFontSize(15); doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, 13, { align: "center" });

  // Subtitle centered below
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(156, 163, 175);
  doc.text(`${subtitle.toUpperCase()}  ·  GENERATED ${todayStr()}`, pageW / 2, 20, { align: "center" });

  // Red accent line
  doc.setFillColor(200, 32, 47);
  doc.rect(0, 32, pageW, 1.5, "F");

  autoTable(doc, {
    startY: 37, head: [headers], body: rows.map(r => r.map(String)),
    styles: {
      font: "courier", fontSize: 8, cellPadding: 3,
      textColor: [40, 44, 52], fillColor: [255, 255, 255],
      lineColor: [222, 226, 230], lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [200, 32, 47], textColor: [255, 255, 255],
      fontStyle: "bold", fontSize: 7.5, halign: "left",
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    margin: { left: 14, right: 14 }, theme: "grid",
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 140;
  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(55, 65, 81);
  doc.text(
    `Confidential — EMM Hardware ERP · ${new Date().toISOString()}`,
    pageW / 2, finalY + 10, { align: "center" }
  );
  doc.save(filename);
}

async function exportToXlsx(
  title: string,
  headers: string[], rows: (string | number)[][], filename: string
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "EMM Hardware ERP";
  const ws = wb.addWorksheet("Report");

  const colCount = headers.length;

  // Row 1: merged title cell with logo placeholder text
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell("A1");
  titleCell.value = `EMM Hardware ERP — ${title}  |  ${todayStr()}`;
  titleCell.font  = { bold: true, size: 13, color: { argb: "FFC8202F" } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // Logo: embed if available (ExcelJS Image API)
  try {
    const res = await fetch("/logo.png");
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const imgId = wb.addImage({ base64: btoa(binary), extension: "png" });
      let _lw = 60, _lh = 40;
      try { const _dv = new DataView(buf); _lh = 40; _lw = Math.round(_lh * (_dv.getUint32(16) / _dv.getUint32(20))); } catch {}
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: _lw, height: _lh } });
    }
  } catch { /* logo not critical */ }

  // Row 2: colored header row
  const headerRow = ws.addRow(headers);
  headerRow.eachCell(cell => {
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8202F" } };
    cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border    = { bottom: { style: "thin", color: { argb: "FFFFFFFF" } } };
  });
  headerRow.height = 20;

  // Data rows with alternating fill
  rows.forEach((row, i) => {
    const r = ws.addRow(row.map(String));
    const bg = i % 2 === 0 ? "FFF9FAFB" : "FFFFFFFF";
    r.eachCell(cell => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font      = { size: 9 };
      cell.alignment = { vertical: "middle" };
    });
  });

  // Auto-fit columns
  ws.columns.forEach(col => {
    let max = 12;
    col.eachCell?.({ includeEmpty: false }, cell => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 50);
  });

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SalesReports() {
  const { t } = useLanguage();

  const [loading, setLoading]     = useState<string | null>(null);
  const [done, setDone]           = useState<string | null>(null);
  const [exportLog, setExportLog] = useState<{ name: string; size: string; date: string; type: string }[]>([]);
  const [stats, setStats]         = useState<any>(null);

  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl transition-colors duration-300";

  useEffect(() => {
    salesService.getStats().then(s => setStats(s)).catch(() => {});
  }, []);

  function logExport(name: string, sizeKb: number, type: string) {
    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    setExportLog(prev =>
      [{ name, size: sizeKb > 1000 ? `${(sizeKb / 1000).toFixed(1)} MB` : `${sizeKb} KB`, date, type }, ...prev].slice(0, 8)
    );
    setDone(name);
    setTimeout(() => setDone(null), 2500);
  }

  const dateTag = new Date().toISOString().slice(0, 10);

  // ── Orders ────────────────────────────────────────────────────────────────
  async function exportOrders(fmt: "xlsx" | "pdf") {
    setLoading(`orders-${fmt}`);
    try {
      const res    = await salesService.getOrders({ limit: 500 });
      const orders = res.orders ?? [];
      const headers = ["Order No", "Customer", "Email", "Products", "Amount (TND)", "Discount (TND)", "Promo Code", "Status", "Reseller", "Date"];
      const rows = orders.map((o: any) => [
        o.orderNo,
        o.customer?.name || "—",
        o.customer?.email || "—",
        (o.lines || []).map((l: any) => `${l.productName} ×${l.quantity}`).join(" | "),
        (o.totalAmount || 0).toFixed(3),
        o.discountAmount ? o.discountAmount.toFixed(3) : "0.000",
        o.promotionCode || "—",
        o.status,
        o.isResellerOrder ? "Yes" : "No",
        o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-GB") : "—",
      ]);
      const filename = `Orders_${dateTag}.${fmt}`;
      if (fmt === "xlsx") await exportToXlsx("Online Orders Report", headers, rows, filename);
      else await exportToPDF("Online Orders Report", "All orders", headers, rows, filename);
      logExport(filename, Math.round(rows.length * 2) + 40, "orders");
    } finally { setLoading(null); }
  }

  // ── Revenue ───────────────────────────────────────────────────────────────
  async function exportRevenue(fmt: "xlsx" | "pdf") {
    setLoading(`revenue-${fmt}`);
    try {
      const res    = await salesService.getOrders({ status: "completed", limit: 500 });
      const orders = res.orders ?? [];
      const headers = ["Order No", "Customer", "Products", "Subtotal (TND)", "Discount (TND)", "Total (TND)", "Promo Code", "Reseller", "Date"];
      const rows: (string | number)[][] = orders.map((o: any) => [
        o.orderNo,
        o.customer?.name || "—",
        (o.lines || []).map((l: any) => `${l.productName} ×${l.quantity}`).join(" | "),
        (o.subtotal || o.totalAmount || 0).toFixed(3),
        o.discountAmount ? o.discountAmount.toFixed(3) : "0.000",
        (o.totalAmount || 0).toFixed(3),
        o.promotionCode || "—",
        o.isResellerOrder ? "Yes" : "No",
        o.updatedAt ? new Date(o.updatedAt).toLocaleDateString("en-GB") : "—",
      ]);
      const totalRevenue = orders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
      rows.push(["", "", "TOTAL", "", "", totalRevenue.toFixed(3), "", "", ""]);
      const filename = `Revenue_${dateTag}.${fmt}`;
      if (fmt === "xlsx") await exportToXlsx("Revenue Report", headers, rows, filename);
      else await exportToPDF("Revenue Report", "Completed orders only", headers, rows, filename);
      logExport(filename, Math.round(rows.length * 2) + 40, "revenue");
    } finally { setLoading(null); }
  }

  // ── Shipments ─────────────────────────────────────────────────────────────
  async function exportShipments(fmt: "xlsx" | "pdf") {
    setLoading(`shipments-${fmt}`);
    try {
      const res       = await salesService.getShipments({ limit: 500 });
      const shipments = res.shipments ?? [];
      const headers = ["Shipment No", "Order No", "Customer", "Carrier", "Tracking No", "Status", "Shipped Date", "Delivered Date", "ETA"];
      const rows = shipments.map((s: any) => [
        s.shipmentNo,
        s.orderNo,
        s.customer?.name || "—",
        s.carrier || "—",
        s.trackingNumber || "—",
        s.status,
        s.shippedAt    ? new Date(s.shippedAt).toLocaleDateString("en-GB")    : "—",
        s.deliveredAt  ? new Date(s.deliveredAt).toLocaleDateString("en-GB")  : "—",
        s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString("en-GB") : "—",
      ]);
      const filename = `Shipments_${dateTag}.${fmt}`;
      if (fmt === "xlsx") await exportToXlsx("Shipments Report", headers, rows, filename);
      else await exportToPDF("Shipments Report", "All shipments", headers, rows, filename);
      logExport(filename, Math.round(rows.length * 1.5) + 30, "shipments");
    } finally { setLoading(null); }
  }

  // ── Returns ───────────────────────────────────────────────────────────────
  async function exportReturns(fmt: "xlsx" | "pdf") {
    setLoading(`returns-${fmt}`);
    try {
      const res     = await salesService.getReturns({ limit: 500 });
      const returns = res.returns ?? [];
      const headers = ["Return No", "Order No", "Customer", "Reason", "Amount (TND)", "Status", "RMA No", "Date"];
      const rows = returns.map((r: any) => [
        r.returnNo,
        r.orderNo,
        r.customer?.name || "—",
        r.reason || "—",
        (r.returnAmount || 0).toFixed(3),
        r.status,
        r.commercialRmaNo || "—",
        r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "—",
      ]);
      const filename = `Returns_${dateTag}.${fmt}`;
      if (fmt === "xlsx") await exportToXlsx("Returns & Refunds Report", headers, rows, filename);
      else await exportToPDF("Returns & Refunds Report", "All returns", headers, rows, filename);
      logExport(filename, Math.round(rows.length * 1.5) + 30, "returns");
    } finally { setLoading(null); }
  }

  // ── Catalog ───────────────────────────────────────────────────────────────
  async function exportCatalog(fmt: "xlsx" | "pdf") {
    setLoading(`catalog-${fmt}`);
    try {
      const products = await salesService.getProducts();
      const headers  = ["Name", "SKU", "Category", "Online Price (TND)", "Stock", "Min Threshold", "Status", "Visible"];
      const rows = products.map((p: any) => [
        p.name, p.sku, p.category || "—",
        (p.onlinePrice || 0).toFixed(3),
        p.stock ?? 0,
        p.minStockThreshold ?? 0,
        p.stockStatus,
        p.isVisible ? "Yes" : "No",
      ]);
      const filename = `Catalog_${dateTag}.${fmt}`;
      if (fmt === "xlsx") await exportToXlsx("Product Catalog Report", headers, rows, filename);
      else await exportToPDF("Product Catalog Report", "All catalog products", headers, rows, filename);
      logExport(filename, Math.round(rows.length) + 20, "catalog");
    } finally { setLoading(null); }
  }

  async function exportAll() {
    await exportOrders("xlsx");
    await exportRevenue("xlsx");
    await exportShipments("xlsx");
    await exportReturns("xlsx");
    await exportCatalog("xlsx");
  }

  // ── Report card definitions ───────────────────────────────────────────────
  const reports = [
    {
      id: "orders", title: "Orders Report",
      desc: "All online orders with customer details, products, amounts, promo codes, and statuses.",
      icon: <ShoppingCart size={18} />, iconBg: "bg-[#c8202f]/10 text-[#c8202f]",
      badge: "All orders", badgeCls: "bg-[#c8202f]/15 text-[#c8202f]",
      actions: [
        { label: "Export PDF",  fmt: "pdf"  as const, cls: "bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold",                                    fn: () => exportOrders("pdf") },
        { label: "Export XLSX", fmt: "xlsx" as const, cls: "border border-[#c8202f]/50 hover:border-[#c8202f] text-[#c8202f] hover:bg-[#c8202f]/10",  fn: () => exportOrders("xlsx") },
      ],
    },
    {
      id: "revenue", title: "Revenue Report",
      desc: "Completed orders only — subtotals, discounts, totals, and cumulative revenue.",
      icon: <DollarSign size={18} />, iconBg: "bg-emerald-500/10 text-emerald-400",
      badge: "Completed only", badgeCls: "bg-emerald-500/15 text-emerald-400",
      actions: [
        { label: "Export PDF",  fmt: "pdf"  as const, cls: "bg-emerald-500 hover:bg-emerald-400 text-black font-bold",                                      fn: () => exportRevenue("pdf") },
        { label: "Export XLSX", fmt: "xlsx" as const, cls: "border border-emerald-500/50 hover:border-emerald-400 text-emerald-400 hover:bg-emerald-500/10", fn: () => exportRevenue("xlsx") },
      ],
    },
    {
      id: "shipments", title: "Shipments Report",
      desc: "All shipments with carrier, tracking number, dispatch and delivery dates.",
      icon: <Truck size={18} />, iconBg: "bg-blue-500/10 text-blue-400",
      badge: "All shipments", badgeCls: "bg-blue-500/15 text-blue-400",
      actions: [
        { label: "Export PDF",  fmt: "pdf"  as const, cls: "bg-blue-500 hover:bg-blue-400 text-black font-bold",                                 fn: () => exportShipments("pdf") },
        { label: "Export XLSX", fmt: "xlsx" as const, cls: "border border-blue-500/50 hover:border-blue-400 text-blue-400 hover:bg-blue-500/10",  fn: () => exportShipments("xlsx") },
      ],
    },
    {
      id: "returns", title: "Returns & Refunds Report",
      desc: "All return requests with reason, refund amount, RMA number, and current status.",
      icon: <RotateCcw size={18} />, iconBg: "bg-amber-500/10 text-amber-400",
      badge: "All returns", badgeCls: "bg-amber-500/15 text-amber-400",
      actions: [
        { label: "Export PDF",  fmt: "pdf"  as const, cls: "bg-amber-500 hover:bg-amber-400 text-black font-bold",                                    fn: () => exportReturns("pdf") },
        { label: "Export XLSX", fmt: "xlsx" as const, cls: "border border-amber-500/50 hover:border-amber-400 text-amber-400 hover:bg-amber-500/10",   fn: () => exportReturns("xlsx") },
      ],
    },
    {
      id: "catalog", title: "Product Catalog Report",
      desc: "All catalog products with SKU, price, stock level, threshold, and visibility.",
      icon: <Package size={18} />, iconBg: "bg-purple-500/10 text-purple-400",
      badge: "Snapshot", badgeCls: "bg-purple-500/15 text-purple-400",
      actions: [
        { label: "Export PDF",  fmt: "pdf"  as const, cls: "bg-purple-500 hover:bg-purple-400 text-black font-bold",                                     fn: () => exportCatalog("pdf") },
        { label: "Export XLSX", fmt: "xlsx" as const, cls: "border border-purple-500/50 hover:border-purple-400 text-purple-400 hover:bg-purple-500/10",  fn: () => exportCatalog("xlsx") },
      ],
    },
  ];

  const iconMap: Record<string, React.ReactNode> = {
    orders:    <ShoppingCart size={13} />,
    revenue:   <DollarSign size={13} />,
    shipments: <Truck size={13} />,
    returns:   <RotateCcw size={13} />,
    catalog:   <Package size={13} />,
  };
  const colorMap: Record<string, string> = {
    orders: "text-[#c8202f]", revenue: "text-emerald-400",
    shipments: "text-blue-400", returns: "text-amber-400", catalog: "text-purple-400",
  };

  return (
    <ProtectedRoute allowedRoles={["SALES_MANAGER", "ADMIN"]}>

      {/* ── Done toast ── */}
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 right-6 z-[9999] bg-[#c8202f] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
            <CheckCircle size={15} /> {done} ready
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              Online Sales <span className="text-[#c8202f]">Reports</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP · Online Sales</p>
          </div>
          <button onClick={exportAll} disabled={!!loading}
            className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-white font-bold disabled:opacity-50">
            <Download size={13} /> Export All XLSX
          </button>
        </div>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Total Reports",   value: "5",                                                          sub: "Available",         icon: <FileText size={14} />,     iconBg: "bg-[#c8202f]/10 text-[#c8202f]"      },
            { label: "Generated",       value: String(exportLog.length),                                     sub: "This session",      icon: <Download size={14} />,     iconBg: "bg-blue-500/10 text-blue-400"         },
            { label: "Total Orders",    value: stats?.totalOrders    != null ? String(stats.totalOrders)    : "—", sub: "All statuses",      icon: <ShoppingCart size={14} />, iconBg: "bg-purple-500/10 text-purple-400"    },
            { label: "Total Revenue",   value: stats?.totalRevenue   != null ? `${stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND` : "—", sub: "Completed orders", icon: <DollarSign size={14} />,    iconBg: "bg-emerald-500/10 text-emerald-400"  },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`${card} px-5 py-4 flex items-center gap-4`}>
              <div className={`p-2 rounded-xl ${s.iconBg}`}>{s.icon}</div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Report cards + sidebar ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Cards grid */}
          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className={`${card} p-6 flex flex-col gap-4`}>
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-xl ${r.iconBg}`}>{r.icon}</div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${r.badgeCls}`}>{r.badge}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{r.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.desc}</p>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest">
                  {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
                <div className="flex gap-2 mt-auto">
                  {r.actions.map((a, j) => {
                    const k = `${r.id}-${a.fmt}`;
                    return (
                      <button key={j} onClick={a.fn} disabled={!!loading}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 disabled:cursor-wait ${a.cls}`}>
                        {loading === k ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Sidebar */}
          <div className={`${card} p-6 flex flex-col`}>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Export Log</h2>
            <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-widest">This session</p>

            {exportLog.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center">
                  <FileText size={20} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">No exports yet</p>
                <p className="text-[10px] text-gray-600">Files appear here after download</p>
              </div>
            ) : (
              <div className="space-y-2 flex-1">
                <AnimatePresence>
                  {exportLog.map((f, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                      className="bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg bg-[#c8202f]/10 flex items-center justify-center flex-shrink-0 ${colorMap[f.type] || "text-gray-400"}`}>
                        {iconMap[f.type] || <FileText size={13} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{f.name}</p>
                        <p className="text-[10px] text-gray-400">{f.date} · {f.size}</p>
                      </div>
                      <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Available reports list */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/[0.06] space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Available reports</p>
              {reports.map(r => (
                <div key={r.id} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${r.iconBg}`}>
                    <span className="scale-75 origin-center">{r.icon}</span>
                  </div>
                  <p className="text-xs text-gray-500 flex-1">{r.title}</p>
                  <div className="flex gap-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#c8202f]/10 text-[#c8202f] font-bold">PDF</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/5 text-gray-500 font-bold">XLSX</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}