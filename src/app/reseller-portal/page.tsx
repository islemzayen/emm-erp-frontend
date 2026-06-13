"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import api from "@/services/api";

export default function ResellerLoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError("Email and password are required"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post("/online-sales/portal/login", { email, password });
      localStorage.setItem("reseller_token",    res.data.token);
      localStorage.setItem("reseller_profile",  JSON.stringify(res.data.reseller));
      router.push("/reseller-portal/dashboard");
    } catch (e: any) {
      setError(e.response?.data?.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#060d1f] flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#c8202f]/10 border border-[#c8202f]/20 mb-4">
            <ShieldCheck size={24} className="text-[#c8202f]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-mono">EMM Hardware</h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">Reseller Portal</p>
        </div>

        {/* Card */}
        <div className="bg-[#111c35] border border-white/[0.06] rounded-2xl p-6 shadow-2xl space-y-4">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1.5">Email</label>
            <div className="relative">
              <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="your.name@reseller.emm.com"
                className="w-full pl-9 pr-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-[#c8202f]/50 transition"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-1.5">Password</label>
            <div className="relative">
              <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className="w-full pl-9 pr-9 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:border-[#c8202f]/50 transition"
              />
              <button
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition"
              >
                {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-black font-bold text-sm font-mono transition disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6 font-mono">
          Access issues? Contact your EMM Hardware representative.
        </p>
      </motion.div>
    </div>
  );
}
