"use client";


import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const fields = [
    { label: t("fullName"), value: user?.name },
    { label: t("emailField"), value: user?.email },
    { label: t("roleField"), value: user?.role },
    ...(user?.role === "EMPLOYEE" && user?.department
      ? [{ label: "Department", value: user.department }]
      : []),
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-mono mb-1">
          {t("accountLabel")}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tight">
          {t("myProfile")}
        </h1>
      </div>

      <div className="bg-white dark:bg-[#0a1020] border border-gray-200 dark:border-[#2a2a2a] p-6 rounded-2xl max-w-xl transition-colors duration-300">
        <h2 className="text-xs font-mono tracking-[0.2em] uppercase text-gray-500 mb-6">
          {t("profileInformation")}
        </h2>

        <div className="space-y-5">
          {fields.map((field) => (
            <div key={field.label}>
              <p className="text-[11px] font-mono tracking-widest uppercase text-gray-500 mb-1">
                {field.label}
              </p>
              <div className="w-full p-3 rounded-lg bg-gray-100 dark:bg-[#0d0d0d] border border-gray-200 dark:border-[#2a2a2a] font-mono text-sm text-gray-700 dark:text-gray-300 select-none">
                {field.value || "—"}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-mono text-gray-500 tracking-wide mt-6">
          Contact your administrator to update your profile information.
        </p>
      </div>
    </>
  );
}