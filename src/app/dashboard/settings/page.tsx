"use client";


import { useLanguage } from "@/context/LanguageContext";

export default function SettingsPage() {
  const { t } = useLanguage();

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-mono mb-1">
          {t("systemLabel")}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tight">
          {t("settingsTitle")}
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Security */}
        <div className="bg-white dark:bg-[#0a1020] border border-gray-200 dark:border-[#2a2a2a] p-6 rounded-2xl transition-colors duration-300">
          <h2 className="text-[11px] font-mono tracking-[0.2em] uppercase text-gray-500 mb-5">
            {t("securitySection")}
          </h2>
          <div className="space-y-3">
            <button className="w-full text-left bg-gray-100 dark:bg-[#0d0d0d] border border-gray-200 dark:border-[#2a2a2a] p-4 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-300 hover:border-[#00ff9d]/30 hover:text-gray-900 dark:hover:text-white transition-all">
              {t("changePassword")}
            </button>
            <button className="w-full text-left bg-gray-100 dark:bg-[#0d0d0d] border border-gray-200 dark:border-[#2a2a2a] p-4 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-300 hover:border-[#00ff9d]/30 hover:text-gray-900 dark:hover:text-white transition-all">
              {t("enableTwoFactor")}
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white dark:bg-[#0a1020] border border-gray-200 dark:border-[#2a2a2a] p-6 rounded-2xl transition-colors duration-300">
          <h2 className="text-[11px] font-mono tracking-[0.2em] uppercase text-gray-500 mb-5">
            {t("preferencesSection")}
          </h2>
          <div className="space-y-3">
            <button className="w-full text-left bg-gray-100 dark:bg-[#0d0d0d] border border-gray-200 dark:border-[#2a2a2a] p-4 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-300 hover:border-[#00ff9d]/30 hover:text-gray-900 dark:hover:text-white transition-all">
              {t("enableNotifications")}
            </button>
            <button className="w-full text-left bg-gray-100 dark:bg-[#0d0d0d] border border-gray-200 dark:border-[#2a2a2a] p-4 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-300 hover:border-[#00ff9d]/30 hover:text-gray-900 dark:hover:text-white transition-all">
              {t("toggleDarkMode")}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-[#0a1020] border border-gray-200 dark:border-[#2a2a2a] p-6 rounded-2xl md:col-span-2 transition-colors duration-300">
          <h2 className="text-[11px] font-mono tracking-[0.2em] uppercase text-red-400/70 mb-5">
            {t("dangerZone")}
          </h2>
          <button className="w-full text-left bg-red-500/10 border border-red-500/30 p-4 rounded-lg text-sm font-mono text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all">
            {t("deleteAccount")}
          </button>
        </div>
      </div>
    </>
  );
}