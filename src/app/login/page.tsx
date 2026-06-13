"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import api from "@/services/api";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3l18 18" />
        <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
        <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8-.36.98-.86 1.89-1.46 2.7" />
        <path d="M6.1 6.1A11.06 11.06 0 0 0 1 12c1.73 4.89 6 8 11 8a10.9 10.9 0 0 0 5.9-1.7" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.46 12C4.2 7.64 7.8 5 12 5s7.8 2.64 9.54 7c-1.74 4.36-5.34 7-9.54 7s-7.8-2.64-9.54-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const roleRoutes = useMemo<Record<string, string>>(
    () => ({
      ADMIN:              "/dashboard/admin",
      HR_MANAGER:         "/dashboard/hr",
      MARKETING_MANAGER:  "/dashboard/marketing",
      SALES_MANAGER:      "/dashboard/sales",
      EMPLOYEE:           "/dashboard/employee",
      COMMERCIAL_MANAGER: "/dashboard/commercial",
      FINANCE_MANAGER:    "/dashboard/finance",
      STOCK_MANAGER:      "/dashboard/stock",
      PURCHASE_MANAGER:   "/dashboard/achat",
      DEPOT_MANAGER:      "/dashboard/depot",
      WAREHOUSE_OPERATOR: "/dashboard/depot",
    }),
    []
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login({
        id:    data.user.id,
        name:  data.user.name,
        email: data.user.email,
        role:  data.user.role,
        token: data.token,
      });
      router.push(roleRoutes[data.user.role] || "/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4ff] dark:bg-[#060d1f] relative overflow-hidden transition-colors duration-300">

      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#1b2a6b 1px, transparent 1px), linear-gradient(90deg, #1b2a6b 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Ambient glow */}
      <div className="absolute w-96 h-96 rounded-full bg-[#c8202f]/5 blur-3xl pointer-events-none" />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm mx-4 px-8 py-10 bg-white dark:bg-[#111c35] border-t-4 border-t-[#c8202f] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 rounded-2xl shadow-2xl transition-colors duration-300">

        {/* Branding */}
        <div className="text-center mb-10">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#1b2a6b] dark:text-white/60 font-mono mb-3">
            {t("erpSubtitle")}
          </p>
          <img
            src="/logo.png"
            alt="EMM Logo"
            className="w-28 h-auto mx-auto object-contain"
          />
        </div>

        {/* Sign in header */}
        <div className="mb-6">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#1b2a6b] font-mono mb-1">
            {t("authLabel")}
          </p>
          <h2 className="text-lg font-bold text-[#1b2a6b] dark:text-white font-mono tracking-tight">
            {t("signInTitle")}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[11px] font-mono tracking-[0.2em] uppercase text-gray-500 dark:text-gray-400 mb-2">
              {t("emailLabel")}
            </label>
            <input
              type="email"
              placeholder={t("emailPlaceholder")}
              className="w-full bg-gray-100 dark:bg-[#0a1020] border border-[#1b2a6b]/20 dark:border-[#1b2a6b]/30 focus:border-[#c8202f]/60 focus:outline-none p-3 rounded-lg transition-colors text-gray-900 dark:text-white font-mono text-sm placeholder-gray-400"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono tracking-[0.2em] uppercase text-gray-500 dark:text-gray-400 mb-2">
              {t("passwordLabel")}
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                className="w-full bg-gray-100 dark:bg-[#0a1020] border border-[#1b2a6b]/20 dark:border-[#1b2a6b]/30 focus:border-[#c8202f]/60 focus:outline-none p-3 pr-11 rounded-lg transition-colors text-gray-900 dark:text-white font-mono text-sm placeholder-gray-400"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1b2a6b] dark:hover:text-white transition-colors p-1"
              >
                <EyeIcon open={showPwd} />
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30 px-3 py-2 text-xs font-mono text-red-500 dark:text-red-400 tracking-wide">
              ✗ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-lg bg-[#c8202f] hover:bg-[#e02d3c] text-white font-mono text-sm tracking-widest uppercase transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("signingIn") : t("signInButton")}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 mt-8 font-mono text-center tracking-widest">
          {t("copyright")}
        </p>
      </div>
    </div>
  );
}