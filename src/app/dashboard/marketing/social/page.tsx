"use client";
import React, { useState, useEffect } from "react";

import ProtectedRoute from "@/components/ProtectedRoute";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Share2, Eye, Users, TrendingUp,
  RefreshCw, MapPin, Image as ImageIcon, ThumbsUp, Wifi,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import api from "@/services/api";

// ── types ─────────────────────────────────────────────────────────────────────
interface Post {
  id: string;
  platform: "facebook";
  message: string;
  image: string | null;
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
}

interface LocationEntry { country: string; fans: number; }

interface SocialData {
  facebook: {
    fans: number; newFans: number; reach: number;
    impressions: number; engagement: number;
    dailyReach: { date: string; value: number }[];
    posts: Post[]; location: LocationEntry[];
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// ── tooltip ───────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111c35] border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-bold">{fmtNum(p.value)}</span></p>
      ))}
    </div>
  );
};

// ── empty state ───────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-36 gap-2">
      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center">
        <Wifi size={18} className="text-gray-400" />
      </div>
      <p className="text-xs text-gray-500 text-center max-w-[200px] leading-relaxed">{message}</p>
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────
export default function SocialMediaAnalytics() {
  const [data,       setData]       = useState<SocialData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const card = "bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";

  async function load(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await api.get("/social/summary");
      setData((res.data as any)?.data ?? res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load social media data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── location ──────────────────────────────────────────────────────────────
  const locationData = (data?.facebook.location ?? [])
    .slice()
    .sort((a, b) => b.fans - a.fans)
    .slice(0, 8);
  const totalAudience = locationData.reduce((s, l) => s + l.fans, 0) || 1;

  const fbEmpty = data && data.facebook.fans === 0 && data.facebook.posts.length === 0;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <ProtectedRoute allowedRoles={["MARKETING_MANAGER"]}>
      <div className="min-h-screen bg-gray-100 dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              Social Media <span className="text-[#c8202f]">Analytics</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP · Meta Business Suite · Facebook</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#1877f2] border border-[#1877f2]/30 bg-[#1877f2]/10 px-3 py-1.5 rounded-xl">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1877f2] animate-pulse" />
              Live · Meta Graph API
            </div>
            <button onClick={() => load(true)} disabled={refreshing}
              className="flex items-center gap-2 border border-gray-200 dark:border-white/10 hover:border-[#c8202f]/40 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-50">
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${card} px-5 py-4 h-24 animate-pulse bg-gray-200 dark:bg-white/[0.04]`} />
            ))}
          </div>
        )}

        {data && (
          <>
            {/* ── New page notice ── */}
            {fbEmpty && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400 flex items-center gap-2">
                ⏳ API connected successfully. Data will populate as the page gains followers and engagement.
              </motion.div>
            )}

            {/* ── KPI cards ── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: "Page Fans",   value: fmtNum(data.facebook.fans),        sub: `+${fmtNum(data.facebook.newFans)} this month`, icon: <Users size={14} />,      color: "bg-blue-500/10 text-blue-400" },
                { label: "Followers",   value: fmtNum(data.facebook.reach),        sub: "total followers",                              icon: <Eye size={14} />,        color: "bg-[#c8202f]/10 text-[#c8202f]" },
                { label: "Impressions", value: fmtNum(data.facebook.impressions),  sub: "total impressions",                            icon: <TrendingUp size={14} />, color: "bg-purple-500/10 text-purple-400" },
                { label: "Engagement",  value: fmtNum(data.facebook.engagement),   sub: "likes + comments + shares",                    icon: <Heart size={14} />,      color: "bg-rose-500/10 text-rose-400" },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className={`${card} px-5 py-4 flex items-center gap-4`}>
                  <div className={`p-2 rounded-xl ${s.color}`}>{s.icon}</div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                    <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* Daily Reach chart */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`${card} p-6`}>
                <p className="text-sm font-bold mb-1">Daily Reach (Last 14 days)</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Unique people reached per day</p>
                {data.facebook.dailyReach.length === 0 ? (
                  <EmptyState message="Daily reach data will appear once your page has activity" />
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data.facebook.dailyReach.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={d => d?.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={fmtNum} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="value" name="Reach" stroke="#1877f2" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </motion.div>

              {/* Audience Location */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${card} p-6`}>
                <p className="text-sm font-bold mb-1">Audience Location</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Top countries · Facebook</p>
                {locationData.length === 0 ? (
                  <EmptyState message="Location data available after reaching 100+ followers" />
                ) : (
                  <div className="space-y-2.5">
                    {locationData.map((l, i) => {
                      const pct = Math.round((l.fans / totalAudience) * 100);
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                              <MapPin size={11} className="text-[#c8202f]" /> {l.country}
                            </span>
                            <span className="text-gray-500">{fmtNum(l.fans)} <span className="text-gray-600">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ delay: i * 0.05, duration: 0.5 }}
                              className="h-full bg-[#1877f2] rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── Best performing posts ── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${card} p-6`}>
              <p className="text-sm font-bold mb-1">Best Performing Posts</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Sorted by total engagement · Facebook</p>

              {data.facebook.posts.length === 0 ? (
                <EmptyState message="Posts will appear here once you publish content on Facebook" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...data.facebook.posts]
                    .sort((a, b) => b.engagement - a.engagement)
                    .slice(0, 6)
                    .map((post, i) => (
                    <motion.div key={post.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-[#1b2a6b]/20 rounded-xl overflow-hidden">

                      {post.image ? (
                        <img src={post.image} alt="" className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center bg-gray-100 dark:bg-white/[0.04]">
                          <ImageIcon size={24} className="text-gray-400" />
                        </div>
                      )}

                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#1877f2]/15 text-[#1877f2]">
                            🟦 Facebook
                          </span>
                          <span className="text-[10px] text-gray-400">{fmtDate(post.createdAt)}</span>
                        </div>

                        {post.message && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                            {post.message}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <ThumbsUp size={11} className="text-blue-400" /> {fmtNum(post.likes)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle size={11} className="text-[#c8202f]" /> {fmtNum(post.comments)}
                          </span>
                          {post.shares > 0 && (
                            <span className="flex items-center gap-1">
                              <Share2 size={11} className="text-purple-400" /> {fmtNum(post.shares)}
                            </span>
                          )}
                          <span className="ml-auto font-bold text-[#1877f2]">{fmtNum(post.engagement)} eng.</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}