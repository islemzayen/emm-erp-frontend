"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Plus,
  Download,
  TrendingUp,
  Pencil,
  Trash2,
  X,
  Loader2,
  Copy,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { financeService } from "@/services/admin/financeService";
import { financeDocumentService } from "@/services/finance/financeDocumentService";
import CalendarPicker from "@/components/CalendarPicker";

interface Employee {
  _id: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  salary: number;
  joinedDate: string;
}

interface FormState {
  name: string;
  position: string;
  phone: string;
  email: string;
  salary: string;
  joinedDate: string;
}

interface Credentials {
  email: string;
  password: string;
}

const AVATAR_COLORS = [
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
  "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  "bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300",
];

const POSITIONS = ["Employee", "Finance Manager"];

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function AdminFinancePage() {
  const { t } = useLanguage();

  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, onLeave: 0, avgTenure: 0 });

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<Credentials | null>(null);

  const emptyForm: FormState = {
    name: "",
    position: "",
    phone: "",
    email: "",
    salary: "",
    joinedDate: new Date().toISOString().split("T")[0],
  };

  const [form, setForm] = useState<FormState>(emptyForm);

  const [otp, setOtp]               = useState<{ code: string; expiresAt: string } | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCopied, setOtpCopied]   = useState(false);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);

  const generateOtp = useCallback(async () => {
    setOtpLoading(true);
    try {
      const result = await financeDocumentService.generateOtp();
      setOtp(result);
      setOtpSecondsLeft(Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000));
    } catch { /* ignore */ }
    finally { setOtpLoading(false); }
  }, []);

  useEffect(() => {
    if (!otp) return;
    const timer = setInterval(() => {
      const s = Math.max(0, Math.floor((new Date(otp.expiresAt).getTime() - Date.now()) / 1000));
      setOtpSecondsLeft(s);
      if (s === 0) { setOtp(null); clearInterval(timer); }
    }, 1000);
    return () => clearInterval(timer);
  }, [otp]);

  const surface =
    "rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900";

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";

  const labelClass =
    "mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [emps, st] = await Promise.all([
        financeService.getAllEmployees(),
        financeService.getStats(),
      ]);
      setEmployees(emps);
      setStats(st);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.position) {
      setFormError("Name and position are required");
      return;
    }

    if (form.phone && form.phone.replace(/\s/g, "").length !== 8) {
      setFormError("Phone number must be 8 digits");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");
      const result = await financeService.createEmployee({
        ...form,
        salary: Number(form.salary) || 0,
      });
      await fetchAll();
      setShowCreate(false);
      setForm(emptyForm);
      setCreatedCredentials({
        email: result.email,
        password: result.plainPassword,
      });
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to create employee");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (emp: Employee) => {
    setSelected(emp);
    setForm({
      name: emp.name,
      position: emp.position,
      phone: emp.phone || "",
      email: emp.email || "",
      salary: emp.salary ? String(emp.salary) : "",
      joinedDate: emp.joinedDate
        ? new Date(emp.joinedDate).toISOString().split("T")[0]
        : "",
    });
    setFormError("");
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!form.name || !form.position) {
      setFormError("Name and position are required");
      return;
    }

    if (form.phone && form.phone.replace(/\s/g, "").length !== 8) {
      setFormError("Phone number must be 8 digits");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");
      await financeService.updateEmployee(selected!._id, {
        ...form,
        salary: Number(form.salary) || 0,
      });
      await fetchAll();
      setShowEdit(false);
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to update employee");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSubmitting(true);
      await financeService.deleteEmployee(selected!._id);
      await fetchAll();
      setShowDelete(false);
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
  };

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("financeDept")}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("financeModuleName")} <span className="text-slate-400 dark:text-slate-500">{t("employees")}</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              <Download size={15} />
              {t("export")}
            </button>

            <button
              onClick={() => {
                setForm(emptyForm);
                setFormError("");
                setShowCreate(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              <Plus size={15} />
              {t("addEmployee")}
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            {
              label: t("totalFinanceStaff"),
              value: String(stats.total),
              sub: t("inDepartment"),
              icon: <Users size={16} />,
              iconBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
            },
            {
              label: t("avgTenure"),
              value: `${stats.avgTenure}yr`,
              sub: t("avgPerEmployee"),
              icon: <TrendingUp size={16} />,
              iconBg: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
            },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`${surface} flex items-center gap-4 px-5 py-5`}
            >
              <div className={`rounded-2xl p-3 ${s.iconBg}`}>{s.icon}</div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {s.label}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {s.value}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Document deletion OTP */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-950 dark:text-white">Code OTP — Suppression de documents Finance</p>
                <p className="text-xs text-slate-400">Générez un code à usage unique valable 10 minutes</p>
              </div>
            </div>
            <button
              onClick={generateOtp}
              disabled={otpLoading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {otpLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {otp ? "Regénérer" : "Générer un code"}
            </button>
          </div>

          {otp && (
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="font-mono text-3xl font-bold tracking-[0.25em] text-slate-950 dark:text-white">{otp.code}</p>
              <button
                onClick={() => { void navigator.clipboard.writeText(otp.code); setOtpCopied(true); setTimeout(() => setOtpCopied(false), 1500); }}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Copy size={14} />
              </button>
              {otpCopied && <span className="text-xs text-teal-500">Copié !</span>}
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-400">Expire dans</p>
                <p className={`font-mono text-sm font-bold ${otpSecondsLeft < 60 ? "text-rose-500" : "text-slate-700 dark:text-slate-200"}`}>
                  {String(Math.floor(otpSecondsLeft / 60)).padStart(2, "0")}:{String(otpSecondsLeft % 60).padStart(2, "0")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Finance Team</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} {t("ofText")} {employees.length} {t("employees")}
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800"
                placeholder={t("searchEmployee")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("noEmployeesMatch")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-3 font-medium">{t("employee")}</th>
                    <th className="px-6 py-3 font-medium">{t("position")}</th>
                    <th className="px-6 py-3 font-medium">{t("phone")}</th>
                    <th className="px-6 py-3 font-medium">{t("joined")}</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((emp, i) => (
                    <motion.tr
                      key={emp._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                          >
                            {emp.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <p className="font-medium text-slate-950 dark:text-white">{emp.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{emp.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {emp.position}
                      </td>

                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {emp.phone || "—"}
                      </td>

                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {formatDate(emp.joinedDate)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(emp)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/20"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            onClick={() => {
                              setSelected(emp);
                              setShowDelete(true);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <Modal title="Add Employee" onClose={() => setShowCreate(false)}>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  className={inputClass}
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className={labelClass}>Position</label>
                <select
                  className={inputClass}
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                >
                  <option value="">— Select Position —</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    className={inputClass}
                    placeholder="12345678"
                    maxLength={8}
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>Salary (TND)</label>
                  <input
                    className={inputClass}
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={form.salary}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, salary: e.target.value.replace(/\D/g, "") }))
                    }
                  />
                </div>
              </div>

              <CalendarPicker
                value={form.joinedDate}
                onChange={(date) => setForm((f) => ({ ...f, joinedDate: date }))}
                inputClass={inputClass}
                labelClass={labelClass}
              />

              {formError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                  {formError}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>

                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add Employee
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showEdit && selected && (
          <Modal title="Edit Employee" onClose={() => setShowEdit(false)}>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className={labelClass}>Position</label>
                <select
                  className={inputClass}
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                >
                  <option value="">— Select Position —</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    className={inputClass}
                    maxLength={8}
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>Salary (TND)</label>
                  <input
                    className={inputClass}
                    type="text"
                    inputMode="numeric"
                    value={form.salary}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, salary: e.target.value.replace(/\D/g, "") }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <input
                  className={inputClass}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              <CalendarPicker
                value={form.joinedDate}
                onChange={(date) => setForm((f) => ({ ...f, joinedDate: date }))}
                inputClass={inputClass}
                labelClass={labelClass}
              />

              {formError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                  {formError}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEdit(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>

                <button
                  onClick={handleEdit}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                  Save Changes
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showDelete && selected && (
          <Modal title="Delete Employee" onClose={() => setShowDelete(false)}>
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-950 dark:text-white">
                  {selected.name}
                </span>
                ? This cannot be undone.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDelete(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>

                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60 dark:hover:bg-rose-500"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete
                </button>
              </div>
            </div>
          </Modal>
        )}

        {createdCredentials && (
          <Modal title="Account Created" onClose={() => setCreatedCredentials(null)}>
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Share these credentials with the employee. This password will not be shown again.
              </p>

              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Email</label>
                  <div className="flex items-center gap-2">
                    <input readOnly className={inputClass} value={createdCredentials.email} />
                    <button
                      onClick={() => navigator.clipboard.writeText(createdCredentials.email)}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-3 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Password</label>
                  <div className="flex items-center gap-2">
                    <input readOnly className={inputClass} value={createdCredentials.password} />
                    <button
                      onClick={() => navigator.clipboard.writeText(createdCredentials.password)}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-3 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setCreatedCredentials(null)}
                  className="w-full rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  Done
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </ProtectedRoute>
  );
}