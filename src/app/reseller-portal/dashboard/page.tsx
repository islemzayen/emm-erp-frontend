"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, ShoppingCart, Clock, CheckCircle, XCircle,
  LogOut, Plus, Minus, Trash2, Send, Loader2, X,
  TrendingUp, Tag, ChevronRight, RefreshCw, AlertCircle,
  Sun, Moon
} from "lucide-react";
import api from "@/services/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ResellerProfile {
  _id: string; name: string; email: string; company: string;
  discountPct: number; paymentTerms: string; totalOrders: number; totalRevenue: number;
}
interface CatalogProduct {
  _id: string; name: string; sku: string; category: string;
  description: string; listPrice: number; resellerPrice: number;
  discountPct: number; stock: number; stockStatus: "in" | "low" | "out" | "pending";
}
interface CartLine { product: CatalogProduct; quantity: number; }
interface MyRequest {
  _id: string; requestNo: string; status: string;
  lines: any[]; totalAmount: number; discountPct: number;
  notes: string; createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTND = (n: number) => {
  const parts = n.toFixed(3).split(".");
  return parseInt(parts[0]).toLocaleString("en-US") + "." + parts[1] + " TND";
};
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// ── Portal API ────────────────────────────────────────────────────────────────
function portalHeaders() {
  const token = localStorage.getItem("reseller_token");
  return { Authorization: `Bearer ${token}` };
}
const portalApi = {
  getCatalog:    () => api.get("/online-sales/portal/catalog",     { headers: portalHeaders() }).then(r => r.data as CatalogProduct[]),
  getMyRequests: () => api.get("/online-sales/portal/my-requests", { headers: portalHeaders() }).then(r => r.data as MyRequest[]),
  submitRequest: (body: any) => api.post("/online-sales/portal/request", body, { headers: portalHeaders() }).then(r => r.data),
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function ResellerDashboard() {
  const router = useRouter();
  const [profile, setProfile]       = useState<ResellerProfile | null>(null);
  const [catalog, setCatalog]       = useState<CatalogProduct[]>([]);
  const [requests, setRequests]     = useState<MyRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"catalog" | "orders">("catalog");
  const [cart, setCart]             = useState<CartLine[]>([]);
  const [showCart, setShowCart]     = useState(false);
  const [notes, setNotes]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState("");
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [catFilter, setCatFilter]   = useState("all");
  const [dark, setDark]             = useState(true);

  // persist theme
  useEffect(() => {
    const saved = localStorage.getItem("reseller_theme");
    if (saved) setDark(saved === "dark");
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("reseller_theme", next ? "dark" : "light");
  };

  // Auth check
  useEffect(() => {
    const token   = localStorage.getItem("reseller_token");
    const profile = localStorage.getItem("reseller_profile");
    if (!token || !profile) { router.push("/reseller-portal"); return; }
    setProfile(JSON.parse(profile));
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, reqs] = await Promise.all([portalApi.getCatalog(), portalApi.getMyRequests()]);
      setCatalog(cat);
      setRequests(reqs);
    } catch (e: any) {
      if (e.response?.status === 401) { router.push("/reseller-portal"); }
      setError("Failed to load data");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { if (profile) load(); }, [profile, load]);

  const logout = () => {
    localStorage.removeItem("reseller_token");
    localStorage.removeItem("reseller_profile");
    router.push("/reseller-portal");
  };

  // ── Cart logic ──────────────────────────────────────────────────────────────
  const addToCart = (product: CatalogProduct) => {
    if (product.stockStatus === "out") return;
    setCart(c => {
      const existing = c.find(l => l.product._id === product._id);
      if (existing) return c.map(l => l.product._id === product._id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...c, { product, quantity: 1 }];
    });
  };
  const updateQty = (id: string, delta: number) => {
    setCart(c => c.map(l => l.product._id === id
      ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l));
  };
  const removeFromCart = (id: string) => setCart(c => c.filter(l => l.product._id !== id));
  const cartTotal   = cart.reduce((s, l) => s + l.product.resellerPrice * l.quantity, 0);
  const cartSavings = cart.reduce((s, l) => s + (l.product.listPrice - l.product.resellerPrice) * l.quantity, 0);

  const submitRequest = async () => {
    if (cart.length === 0) { setError("Add at least one product"); return; }
    setSubmitting(true); setError("");
    try {
      await portalApi.submitRequest({
        lines: cart.map(l => ({ productId: l.product._id, quantity: l.quantity })),
        notes,
      });
      setCart([]);
      setNotes("");
      setShowCart(false);
      setSuccess("Purchase request submitted! EMM Hardware will review and contact you shortly.");
      await load();
      setTimeout(() => setSuccess(""), 5000);
    } catch (e: any) { setError(e.response?.data?.message || "Failed to submit"); }
    finally { setSubmitting(false); }
  };

  // ── Filtered catalog ────────────────────────────────────────────────────────
  const categories = ["all", ...Array.from(new Set(catalog.map(p => p.category).filter(Boolean)))];
  const filtered = catalog.filter(p => {
    const q = search.toLowerCase();
    return (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      && (catFilter === "all" || p.category === catFilter);
  });

  // ── Theme tokens ────────────────────────────────────────────────────────────
  const t = {
    bg:          dark ? "bg-[#060d1f]"              : "bg-gray-100",
    text:        dark ? "text-white"                 : "text-gray-900",
    nav:         dark ? "bg-[#060d1f]/90 border-white/[0.05]" : "bg-white/90 border-gray-200",
    card:        dark ? "bg-[#111c35] border-white/[0.06]"    : "bg-white border-gray-200",
    cardHover:   dark ? "hover:border-[#c8202f]/20"         : "hover:border-emerald-400",
    sub:         dark ? "text-gray-500"              : "text-gray-500",
    subtext:     dark ? "text-gray-400"              : "text-gray-600",
    input:       dark ? "bg-black/30 border-white/10 text-white placeholder-gray-600 focus:border-[#c8202f]/40"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#c8202f]",
    catBtn:      dark ? "text-gray-500 hover:text-gray-300 border-white/[0.06]"
                      : "text-gray-500 hover:text-gray-700 border-gray-300",
    catBtnActive:dark ? "bg-[#c8202f]/20 text-[#c8202f] border-[#c8202f]/30"
                      : "bg-[#c8202f]/15 text-emerald-600 border-emerald-400",
    tabBorder:   dark ? "border-white/[0.05]"        : "border-gray-200",
    tabItem:     dark ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-gray-700",
    rowBorder:   dark ? "border-white/[0.04]"        : "border-gray-100",
    productCard: dark ? "bg-black/20 border-white/[0.05]" : "bg-gray-50 border-gray-200",
    priceLine:   dark ? "border-white/[0.05]"        : "border-gray-100",
    drawer:      dark ? "bg-[#111c35] border-white/[0.06]" : "bg-white border-gray-200",
    drawerLine:  dark ? "bg-white/[0.03] border-white/[0.05]" : "bg-gray-50 border-gray-200",
    drawerBorder:dark ? "border-white/[0.06]"        : "border-gray-200",
    qtyBtn:      dark ? "bg-white/[0.05] hover:bg-white/10 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700",
    textarea:    dark ? "bg-black/30 border-white/10 text-white placeholder-gray-600 focus:border-[#c8202f]/40"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#c8202f]",
    totalBorder: dark ? "border-white/[0.06]"        : "border-gray-200",
    kpiCard:     dark ? "bg-[#111c35] border-white/[0.06]" : "bg-white border-gray-200",
    toggleBtn:   dark ? "text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10"
                      : "text-gray-500 hover:text-indigo-500 hover:bg-indigo-500/10",
  };

  const STOCK_BADGE: Record<string, string> = {
    in:      "bg-[#c8202f]/15 text-[#c8202f]",
    low:     "bg-amber-500/15 text-amber-400",
    out:     "bg-red-500/15 text-red-400",
    pending: "bg-gray-500/15 text-gray-400",
  };
  const STOCK_LABEL: Record<string, string> = {
    in: "In Stock", low: "Low Stock", out: "Out of Stock", pending: "Pending",
  };
  const REQ_BADGE: Record<string, string> = {
    pending:   "bg-amber-500/15 text-amber-400",
    approved:  "bg-blue-500/15 text-blue-400",
    rejected:  "bg-red-500/15 text-red-400",
    fulfilled: "bg-[#c8202f]/15 text-[#c8202f]",
  };

  if (!profile) return (
    <div className={`min-h-screen ${t.bg} flex items-center justify-center`}>
      <Loader2 size={20} className="animate-spin text-[#c8202f]" />
    </div>
  );

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} font-mono transition-colors duration-300`}>
      {/* Background grid — dark only */}
      {dark && (
        <div className="fixed inset-0 bg-[linear-gradient(rgba(16,185,129,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      )}

      {/* ── Navbar ── */}
      <header className={`sticky top-0 z-40 backdrop-blur border-b ${t.nav} px-6 py-3 flex items-center justify-between transition-colors duration-300`}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#c8202f]/15 border border-[#c8202f]/20 flex items-center justify-center">
            <span className="text-[#c8202f] text-xs font-bold">E</span>
          </div>
          <div>
            <p className="text-xs font-bold tracking-wider">EMM Hardware</p>
            <p className={`text-[10px] ${t.sub}`}>Reseller Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold">{profile.name}</p>
            <p className={`text-[10px] text-[#c8202f]`}>{profile.discountPct}% discount · {profile.company || "Reseller"}</p>
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className={`p-1.5 rounded-lg transition ${t.toggleBtn}`}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Cart button */}
          <button onClick={() => setShowCart(true)}
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#c8202f]/10 border border-[#c8202f]/20 text-[#c8202f] hover:bg-[#c8202f]/20 transition text-xs font-bold">
            <ShoppingCart size={13} />
            Cart
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#c8202f] text-black text-[10px] font-bold flex items-center justify-center">
                {cart.reduce((s, l) => s + l.quantity, 0)}
              </span>
            )}
          </button>

          <button onClick={logout}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "My Discount",   value: `${profile.discountPct}%`,    icon: <Tag size={14} />,        color: "text-[#c8202f]" },
            { label: "Total Orders",  value: String(profile.totalOrders),  icon: <Package size={14} />,    color: "text-blue-400"    },
            { label: "Total Revenue", value: fmtTND(profile.totalRevenue), icon: <TrendingUp size={14} />, color: "text-purple-400"  },
          ].map((k, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={`${t.kpiCard} border rounded-2xl px-4 py-3 flex items-center gap-3 transition-colors duration-300`}>
              <span className={`${k.color} opacity-70`}>{k.icon}</span>
              <div>
                <p className={`text-[10px] ${t.sub} uppercase tracking-widest`}>{k.label}</p>
                <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Alerts */}
        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#c8202f]/10 border border-[#c8202f]/20 text-sm text-[#c8202f]">
            <CheckCircle size={16} className="mt-0.5 flex-shrink-0" /> {success}
          </motion.div>
        )}
        {error && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <span className="flex items-center gap-2"><AlertCircle size={14} /> {error}</span>
            <button onClick={() => setError("")}><X size={14} /></button>
          </div>
        )}

        {/* Tabs */}
        <div className={`${t.card} border rounded-2xl overflow-hidden transition-colors duration-300`}>
          <div className={`flex border-b ${t.tabBorder}`}>
            {([["catalog", "Product Catalog", <Package size={13} />], ["orders", `My Requests (${requests.length})`, <Clock size={13} />]] as const).map(([key, label, icon]) => (
              <button key={key} onClick={() => setTab(key as any)}
                className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-widest transition ${tab === key ? "text-[#c8202f] border-b-2 border-emerald-400" : `${t.tabItem}`}`}>
                {icon} {label}
              </button>
            ))}
          </div>

          {/* ── CATALOG TAB ── */}
          {tab === "catalog" && (
            <>
              <div className={`flex flex-wrap items-center gap-3 px-5 py-4 border-b ${t.rowBorder}`}>
                <input className={`flex-1 min-w-48 px-3 py-1.5 border rounded-lg text-xs focus:outline-none transition ${t.input}`}
                  placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
                <div className="flex gap-2 flex-wrap">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setCatFilter(cat)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition border ${catFilter === cat ? t.catBtnActive : t.catBtn}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className={`flex items-center justify-center py-12 gap-2 ${t.sub}`}><Loader2 size={16} className="animate-spin" /> Loading…</div>
              ) : filtered.length === 0 ? (
                <div className={`py-12 text-center text-sm ${t.sub}`}>No products found</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                  {filtered.map((p, i) => (
                    <motion.div key={p._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className={`${t.productCard} border rounded-xl p-4 flex flex-col gap-3 ${t.cardHover} transition group`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold group-hover:text-[#c8202f] transition">{p.name}</p>
                          <p className={`text-[10px] ${t.sub} font-mono mt-0.5`}>{p.sku}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${STOCK_BADGE[p.stockStatus]}`}>
                          {STOCK_LABEL[p.stockStatus]}
                        </span>
                      </div>

                      {p.description && (
                        <p className={`text-[11px] ${t.subtext} leading-relaxed line-clamp-2`}>{p.description}</p>
                      )}

                      <div className={`flex items-end justify-between mt-auto pt-2 border-t ${t.priceLine}`}>
                        <div>
                          <p className={`text-[10px] ${t.sub} line-through`}>{fmtTND(p.listPrice)}</p>
                          <p className="text-base font-bold text-[#c8202f]">{fmtTND(p.resellerPrice)}</p>
                          <p className="text-[10px] text-[#c8202f]/70">−{p.discountPct}% your price</p>
                        </div>
                        <button
                          onClick={() => addToCart(p)}
                          disabled={p.stockStatus === "out"}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-black text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus size={12} /> Add
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── MY REQUESTS TAB ── */}
          {tab === "orders" && (
            <>
              {loading ? (
                <div className={`flex items-center justify-center py-12 gap-2 ${t.sub}`}><Loader2 size={16} className="animate-spin" /> Loading…</div>
              ) : requests.length === 0 ? (
                <div className="py-12 text-center">
                  <ShoppingCart size={28} className={`mx-auto ${t.sub} mb-3`} />
                  <p className={`text-sm ${t.sub}`}>No purchase requests yet</p>
                  <button onClick={() => setTab("catalog")} className="mt-3 text-xs text-[#c8202f] hover:underline flex items-center gap-1 mx-auto">
                    Browse catalog <ChevronRight size={12} />
                  </button>
                </div>
              ) : (
                requests.map((req, i) => (
                  <div key={req._id} className={`px-5 py-4 ${i < requests.length - 1 ? `border-b ${t.rowBorder}` : ""}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold text-[#c8202f] font-mono">{req.requestNo}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${REQ_BADGE[req.status]}`}>{req.status}</span>
                      </div>
                      <p className={`text-xs ${t.sub}`}>{fmtDate(req.createdAt)}</p>
                    </div>
                    <p className={`text-xs ${t.subtext} mb-2`}>
                      {req.lines.map((l: any) => `${l.productName} ×${l.quantity}`).join(" · ")}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] ${t.sub}`}>Discount: <span className="text-[#c8202f] font-bold">{req.discountPct}%</span></span>
                        {req.status === "pending"   && <span className="text-[10px] text-amber-400 flex items-center gap-1"><Clock size={10} /> Awaiting review</span>}
                        {req.status === "approved"  && <span className="text-[10px] text-blue-400 flex items-center gap-1"><CheckCircle size={10} /> Being prepared</span>}
                        {req.status === "fulfilled" && <span className="text-[10px] text-[#c8202f] flex items-center gap-1"><CheckCircle size={10} /> Order placed</span>}
                        {req.status === "rejected"  && <span className="text-[10px] text-red-400 flex items-center gap-1"><XCircle size={10} /> Rejected</span>}
                      </div>
                      <p className="text-sm font-bold">{fmtTND(req.totalAmount)}</p>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* ── CART DRAWER ── */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowCart(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className={`fixed right-0 top-0 h-full w-full max-w-sm ${t.drawer} border-l z-50 flex flex-col shadow-2xl transition-colors duration-300`}>

              <div className={`flex items-center justify-between px-5 py-4 border-b ${t.drawerBorder}`}>
                <div className="flex items-center gap-2">
                  <ShoppingCart size={15} className="text-[#c8202f]" />
                  <p className="text-sm font-bold">Purchase Request</p>
                </div>
                <button onClick={() => setShowCart(false)} className={`${t.sub} hover:text-red-400 transition`}><X size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {cart.length === 0 ? (
                  <p className={`text-center text-sm ${t.sub} py-8`}>Cart is empty</p>
                ) : cart.map(line => (
                  <div key={line.product._id} className={`flex items-center gap-3 p-3 rounded-xl ${t.drawerLine} border`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{line.product.name}</p>
                      <p className="text-[10px] text-[#c8202f]">{fmtTND(line.product.resellerPrice)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(line.product._id, -1)}
                        className={`w-6 h-6 rounded-lg ${t.qtyBtn} flex items-center justify-center transition`}>
                        <Minus size={10} />
                      </button>
                      <span className="text-sm font-bold w-5 text-center">{line.quantity}</span>
                      <button onClick={() => updateQty(line.product._id, 1)}
                        className={`w-6 h-6 rounded-lg ${t.qtyBtn} flex items-center justify-center transition`}>
                        <Plus size={10} />
                      </button>
                      <button onClick={() => removeFromCart(line.product._id)}
                        className="w-6 h-6 rounded-lg text-red-400 hover:bg-red-500/10 flex items-center justify-center transition ml-1">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}

                {cart.length > 0 && (
                  <div>
                    <label className={`text-[10px] ${t.sub} uppercase tracking-widest block mb-1.5`}>Notes (optional)</label>
                    <textarea rows={3} className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none transition resize-none ${t.textarea}`}
                      placeholder="Delivery instructions, special requirements…"
                      value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className={`px-5 py-4 border-t ${t.drawerBorder} space-y-3`}>
                  <div className="space-y-1.5">
                    <div className={`flex justify-between text-xs ${t.sub}`}>
                      <span>List price</span>
                      <span>{fmtTND(cart.reduce((s, l) => s + l.product.listPrice * l.quantity, 0))}</span>
                    </div>
                    <div className="flex justify-between text-xs text-[#c8202f]">
                      <span>Your discount ({profile.discountPct}%)</span>
                      <span>−{fmtTND(cartSavings)}</span>
                    </div>
                    <div className={`flex justify-between text-sm font-bold pt-1.5 border-t ${t.totalBorder}`}>
                      <span>Total</span>
                      <span className="text-[#c8202f]">{fmtTND(cartTotal)}</span>
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-400">{error}</p>}

                  <button onClick={submitRequest} disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-black font-bold text-sm transition disabled:opacity-60">
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {submitting ? "Submitting…" : "Submit Request"}
                  </button>
                  <p className={`text-[10px] ${t.sub} text-center`}>
                    EMM Hardware will review and confirm your order
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}