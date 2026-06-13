"use client";


import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Plus, Download,
  TrendingUp, Pencil, Trash2, X, Loader2, KeyRound, Eye, EyeOff,
  CheckCircle, ShieldCheck, Clock, Building2, FileText,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { adminService } from "@/services/adminService";
import { hrService } from "@/services/hrservice";
import { documentService } from "@/services/documentService";
import api from "@/services/api";
import CalendarPicker from "@/components/CalendarPicker";

interface Employee {
  _id: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  salary: number;
  joinedDate: string;
  accountStatus: "pending" | "approved" | "none";
  role: string;
  department: string;
  matricule?: string; cnssNumber?: string; address?: string; qualification?: string;
  category?: string; echelon?: string; situation?: string; familyStatus?: string;
  numChildren?: number; hourlyRate?: number; cin?: string;
}

interface FormState {
  name: string; position: string; phone: string;
  email: string; salary: string; joinedDate: string;
  matricule: string; cnssNumber: string; address: string; qualification: string;
  category: string; echelon: string; situation: string; familyStatus: string;
  numChildren: string; hourlyRate: string; cin: string;
}

interface Credentials { email: string; password: string; }

const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]",
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400",
];

const POSITIONS = ["Employee", "HR Manager"];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function AdminHRPage() {
  const { t } = useLanguage();
  const [search, setSearch]     = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState({ total: 0, active: 0, onLeave: 0, avgTenure: 0 });

  const [showCreate, setShowCreate]   = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [showDelete, setShowDelete]   = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);

  const [resetPwTarget, setResetPwTarget]       = useState<Employee | null>(null);
  const [generatedPw, setGeneratedPw]           = useState("");
  const [resetPwError, setResetPwError]         = useState("");
  const [resetPwSuccess, setResetPwSuccess]     = useState(false);
  const [resetPwSubmitting, setResetPwSubmitting] = useState(false);
  const [showGenPw, setShowGenPw]               = useState(false);
  const [copied, setCopied]                     = useState(false);

  const [selected, setSelected]         = useState<Employee | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [formError, setFormError]       = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<Credentials | null>(null);

  // Approve flow
  const [approvingId, setApprovingId]   = useState<string | null>(null);

  // Company / payroll settings (bulletin de paie header)
  const [companyCfg, setCompanyCfg] = useState<any>({ companyCnss: "", companyName: "", establishment: "", companyAddress: "", monthlyHours: 208 });
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaved, setCfgSaved]   = useState(false);

  const emptyForm: FormState = {
    name: "", position: "", phone: "", email: "", salary: "",
    joinedDate: new Date().toISOString().split("T")[0],
    matricule: "", cnssNumber: "", address: "", qualification: "",
    category: "", echelon: "", situation: "", familyStatus: "", numChildren: "", hourlyRate: "", cin: "",
  };
  const [form, setForm] = useState<FormState>(emptyForm);
  const [cinFile, setCinFile] = useState<File | null>(null);
  const cinFileRef = useRef<HTMLInputElement>(null);

  const card       = "bg-white dark:bg-[#111c35] border border-gray-200 dark:border-[#1b2a6b]/20 rounded-2xl transition-colors duration-300";
  const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition";
  const labelClass = "text-xs text-gray-500 uppercase tracking-widest mb-1 block";
const hintClass = "text-[10px] text-gray-400 dark:text-gray-600 mt-0.5";
  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { api.get("/company-config").then(r => setCompanyCfg((r.data as any)?.data ?? r.data)).catch(() => {}); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [emps, st] = await Promise.all([hrService.getAllEmployees(), hrService.getStats()]);
      setEmployees(emps);
      setStats(st);
    } catch {} finally { setLoading(false); }
  };

  async function saveCompanyCfg() {
    setCfgSaving(true); setCfgSaved(false);
    try {
      const r = await api.put("/company-config", {
        companyCnss: companyCfg.companyCnss, companyName: companyCfg.companyName,
        establishment: companyCfg.establishment, companyAddress: companyCfg.companyAddress,
        monthlyHours: Number(companyCfg.monthlyHours) || 208,
      });
      setCompanyCfg((r.data as any)?.data ?? r.data); setCfgSaved(true); setTimeout(() => setCfgSaved(false), 2500);
    } finally { setCfgSaving(false); }
  }

  // Pending approval only for manager-level roles — employees never need approval
  const MANAGER_ROLES = ["HR_MANAGER", "MARKETING_MANAGER", "SALES_MANAGER", "ADMIN"];
  const pendingEmployees = employees.filter(e =>
    e.accountStatus === "pending" && MANAGER_ROLES.includes(e.role)
  );
  const normalEmployees = employees.filter(e =>
    !(e.accountStatus === "pending" && MANAGER_ROLES.includes(e.role))
  );
  const filtered         = normalEmployees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.position.toLowerCase().includes(search.toLowerCase())
  );

  const buildPayrollPayload = () => ({
    matricule: form.matricule, cnssNumber: form.cnssNumber, address: form.address,
    qualification: form.qualification, category: form.category, echelon: form.echelon,
    situation: form.situation, familyStatus: form.familyStatus,
    numChildren: Number(form.numChildren) || 0, hourlyRate: Number(form.salary) ? Number((Number(form.salary) / 208).toFixed(3)) : 0,
    cin: form.cin,
  });

  const handleCreate = async () => {
    if (!form.name || !form.position) { setFormError("Name and position are required"); return; }
    if (!form.cin || form.cin.length !== 8) { setFormError("A valid 8-digit CIN number is required"); return; }
    if (!cinFile) { setFormError("Please attach a copy of the CIN card (PDF or image)"); return; }
    if (form.phone && form.phone.replace(/\s/g, "").length !== 8) { setFormError("Phone number must be 8 digits"); return; }
    try {
      setSubmitting(true); setFormError("");
      const created = await hrService.createEmployee({
        name: form.name, position: form.position, phone: form.phone,
        salary: Number(form.salary) || 0, joinedDate: form.joinedDate,
        department: "HR", ...buildPayrollPayload(),
      });
      const newEmp = (created as any)?.data ?? created;
      // Auto-save the CIN card copy into Documents (type: "ID Copy")
      if (cinFile && newEmp?._id) {
        try {
          await documentService.upload({
            employeeId: newEmp._id, employeeName: form.name, department: "HR",
            type: "ID Copy", note: `CIN: ${form.cin}`, file: cinFile,
          });
        } catch {}
      }
      await fetchAll();
      setShowCreate(false);
      setForm(emptyForm);
      setCinFile(null);
    } catch (err: any) { setFormError(err.response?.data?.message || "Failed to create employee"); }
    finally { setSubmitting(false); }
  };

  // ── Approve account ───────────────────────────────────────────────────────
  const handleApprove = async (emp: Employee) => {
    setApprovingId(emp._id);
    try {
      const res   = await api.post(`/hr/employees/${emp._id}/approve`);
      const data  = (res.data as any)?.data ?? res.data;
      await fetchAll();
      setCreatedCredentials({ email: data.email, password: data.plainPassword });
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to approve account");
    } finally { setApprovingId(null); }
  };

  const openEdit = (emp: Employee) => {
    setSelected(emp);
    setForm({
      name: emp.name, position: emp.position,
      phone: emp.phone || "", email: emp.email || "",
      salary: emp.salary ? String(emp.salary) : "",
      joinedDate: emp.joinedDate ? new Date(emp.joinedDate).toISOString().split("T")[0] : "",
      matricule: emp.matricule || "", cnssNumber: emp.cnssNumber || "", address: emp.address || "",
      qualification: emp.qualification || "", category: emp.category || "", echelon: emp.echelon || "",
      situation: emp.situation || "", familyStatus: emp.familyStatus || "",
      numChildren: emp.numChildren != null ? String(emp.numChildren) : "", hourlyRate: emp.hourlyRate ? String(emp.hourlyRate) : "",
      cin: emp.cin || "",
    });
    setFormError(""); setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!form.name || !form.position) { setFormError("Name and position are required"); return; }
    if (form.phone && form.phone.replace(/\s/g, "").length !== 8) { setFormError("Phone number must be 8 digits"); return; }
    try {
      setSubmitting(true); setFormError("");
      await hrService.updateEmployee(selected!._id, {
        name: form.name, position: form.position, phone: form.phone,
        salary: Number(form.salary) || 0, joinedDate: form.joinedDate,
        department: "HR", ...buildPayrollPayload(),
      });
      await fetchAll(); setShowEdit(false);
    } catch (err: any) { setFormError(err.response?.data?.message || "Failed to update employee"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    try {
      setSubmitting(true);
      await hrService.deleteEmployee(selected!._id);
      await fetchAll(); setShowDelete(false);
    } catch {} finally { setSubmitting(false); }
  };

  const genPassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const openResetPw = (emp: Employee) => {
    setResetPwTarget(emp);
    setGeneratedPw(genPassword());
    setResetPwError(""); setResetPwSuccess(false);
    setShowGenPw(false); setCopied(false);
    setShowResetPw(true);
  };

  const handleResetPw = async () => {
    setResetPwSubmitting(true); setResetPwError("");
    try {
      await adminService.resetPassword(resetPwTarget!._id, generatedPw);
      setResetPwSuccess(true);
      setTimeout(() => { setShowResetPw(false); setResetPwSuccess(false); setResetPwTarget(null); }, 3500);
    } catch (err: any) {
      setResetPwError(err?.response?.data?.message || "Failed to reset password.");
    } finally { setResetPwSubmitting(false); }
  };

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  };

  // ── Reusable payroll / bulletin-de-paie fields block (Create + Edit) ──
  const payrollFields = (
  <div className="pt-2 border-t border-gray-200 dark:border-white/10">
    <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">Payroll / Bulletin de paie</p>

    {/* Row 1: Matricule + N° CNSS */}
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelClass}>Matricule</label>
        <input
          className={inputClass}
          placeholder="e.g. MAT001"
          maxLength={10}
          value={form.matricule}
          onChange={e => setForm(f => ({ ...f, matricule: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() }))}
        />
        <p className={hintClass}>Max 10 chars · alphanumeric</p>
      </div>
      <div>
        <label className={labelClass}>N° CNSS</label>
        <input
          className={inputClass}
          placeholder="12345678"
          maxLength={8}
          inputMode="numeric"
          value={form.cnssNumber}
          onChange={e => setForm(f => ({ ...f, cnssNumber: e.target.value.replace(/\D/g, "") }))}
        />
        <p className={hintClass}>Exactly 8 digits</p>
      </div>
    </div>

    {/* Row 2: Adresse */}
    <div className="mt-3">
      <label className={labelClass}>Adresse</label>
      <input
        className={inputClass}
        placeholder="e.g. 12 Rue de la République, Tunis"
        maxLength={100}
        value={form.address}
        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
      />
      <p className={hintClass}>Max 100 chars</p>
    </div>

    {/* Row 3: Qualification + Taux horaire */}
    <div className="grid grid-cols-2 gap-3 mt-3">
      <div>
        <label className={labelClass}>Qualification</label>
        <input
          className={inputClass}
          placeholder="e.g. OUVRIER"
          maxLength={30}
          value={form.qualification}
          onChange={e => setForm(f => ({ ...f, qualification: e.target.value.toUpperCase() }))}
        />
        <p className={hintClass}>Max 30 chars · auto-uppercase</p>
      </div>
      <div>
        <label className={labelClass}>
          Taux horaire <span className="text-gray-400 normal-case tracking-normal">(auto = salaire/208)</span>
        </label>
        <input
          className={`${inputClass} opacity-70 cursor-not-allowed`}
          readOnly
          value={form.salary ? (Number(form.salary) / 208).toFixed(3) : ""}
          placeholder="—"
        />
        <p className={hintClass}>Computed automatically</p>
      </div>
    </div>

    {/* Row 4: Catégorie + Échelon */}
    <div className="grid grid-cols-2 gap-3 mt-3">
      <div>
        <label className={labelClass}>Catégorie</label>
        <input
          className={inputClass}
          placeholder="e.g. A1"
          maxLength={5}
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value.toUpperCase() }))}
        />
        <p className={hintClass}>Max 5 chars · auto-uppercase</p>
      </div>
      <div>
        <label className={labelClass}>Échelon</label>
        <input
          className={inputClass}
          placeholder="e.g. 3"
          maxLength={3}
          inputMode="numeric"
          value={form.echelon}
          onChange={e => setForm(f => ({ ...f, echelon: e.target.value.replace(/\D/g, "") }))}
        />
        <p className={hintClass}>1–3 digits only</p>
      </div>
    </div>

    {/* Row 5: Situation + Sit. familiale + Nb enfants */}
    <div className="grid grid-cols-3 gap-3 mt-3">
      <div>
        <label className={labelClass}>Situation</label>
        <input
          className={inputClass}
          placeholder="e.g. T Titulaire"
          maxLength={20}
          value={form.situation}
          onChange={e => setForm(f => ({ ...f, situation: e.target.value }))}
        />
        <p className={hintClass}>Max 20 chars</p>
      </div>
      <div>
        <label className={labelClass}>Sit. familiale</label>
        <select
          className={inputClass}
          value={form.familyStatus}
          onChange={e => setForm(f => ({ ...f, familyStatus: e.target.value }))}
        >
          <option value="">—</option>
          <option value="C">C – Célibataire</option>
          <option value="M">M – Marié(e)</option>
          <option value="D">D – Divorcé(e)</option>
          <option value="V">V – Veuf/Veuve</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Nb enfants</label>
        <input
          className={inputClass}
          inputMode="numeric"
          placeholder="0"
          maxLength={2}
          value={form.numChildren}
          onChange={e => setForm(f => ({ ...f, numChildren: e.target.value.replace(/\D/g, "") }))}
        />
        <p className={hintClass}>0 – 99</p>
      </div>
    </div>
  </div>
);

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
    
      <div className="min-h-screen bg-gray-100 dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              {t("hr")} <span className="text-[#c8202f]">{t("employees")}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">{t("hrDept")}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
              <Download size={13} /> {t("export")}
            </button>
            <button onClick={() => { setForm(emptyForm); setFormError(""); setShowCreate(true); }}
              className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-black font-bold">
              <Plus size={13} /> {t("addEmployee")}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: t("totalHRStaff"), value: String(stats.total), sub: t("inDepartment"), icon: <Users size={14} />, iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
            { label: t("avgTenure"), value: `${stats.avgTenure}yr`, sub: t("avgPerEmployee"), icon: <TrendingUp size={14} />, iconBg: "bg-purple-500/10 text-purple-400" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`${card} px-5 py-4 flex items-center gap-4`}>
              <div className={`p-2 rounded-xl ${s.iconBg}`}>{s.icon}</div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Company / Payroll settings (Bulletin de paie header) ── */}
        <div className={`${card} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-[#c8202f]" />
              <div>
                <h2 className="text-base font-bold">Company / Payroll Settings</h2>
                <p className="text-xs text-gray-500">Shown on the bulletin de paie header (company CNSS, name, hours)</p>
              </div>
            </div>
            <button onClick={saveCompanyCfg} disabled={cfgSaving}
              className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-black font-bold disabled:opacity-50">
              {cfgSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} {cfgSaved ? "Saved" : "Save"}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>Company CNSS N°</label><input className={inputClass} placeholder="197574-82" value={companyCfg.companyCnss || ""} onChange={e => setCompanyCfg((c: any) => ({ ...c, companyCnss: e.target.value }))} /></div>
            <div><label className={labelClass}>Company Name</label><input className={inputClass} placeholder="EMM Hardware" value={companyCfg.companyName || ""} onChange={e => setCompanyCfg((c: any) => ({ ...c, companyName: e.target.value }))} /></div>
            <div><label className={labelClass}>Establishment</label><input className={inputClass} placeholder="Établissement Mohamed Moalla Plus" value={companyCfg.establishment || ""} onChange={e => setCompanyCfg((c: any) => ({ ...c, establishment: e.target.value }))} /></div>
            <div><label className={labelClass}>Address</label><input className={inputClass} placeholder="Sfax, Tunisia" value={companyCfg.companyAddress || ""} onChange={e => setCompanyCfg((c: any) => ({ ...c, companyAddress: e.target.value }))} /></div>
            <div><label className={labelClass}>Monthly Hours</label><input className={inputClass} inputMode="numeric" placeholder="208" value={companyCfg.monthlyHours ?? ""} onChange={e => setCompanyCfg((c: any) => ({ ...c, monthlyHours: e.target.value.replace(/\D/g,"") }))} /></div>
          </div>
        </div>

        {/* ── Pending Approval Section ── */}
        {pendingEmployees.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={13} className="text-amber-400" />
              <p className="text-xs uppercase tracking-widest text-amber-400 font-bold">
                Pending Account Approval ({pendingEmployees.length})
              </p>
            </div>
            <div className={`${card} border-amber-500/20 divide-y divide-gray-100 dark:divide-white/[0.04]`}>
              {pendingEmployees.map((emp, i) => (
                <motion.div key={emp._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 px-6 py-4">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-amber-500/20 text-amber-400`}>
                    {emp.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.position} · {emp.department || "HR"}</p>
                  </div>
                  {/* Pending badge */}
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20 hidden md:inline-flex items-center gap-1">
                    <Clock size={9} /> Awaiting Approval
                  </span>
                  {/* Approve button */}
                  <button onClick={() => handleApprove(emp)} disabled={approvingId === emp._id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-black text-xs font-bold transition disabled:opacity-50">
                    {approvingId === emp._id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <ShieldCheck size={12} />}
                    Approve
                  </button>
                  {/* Delete */}
                  <button onClick={() => { setSelected(emp); setShowDelete(true); }}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition">
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main Employee Table ── */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/[0.05]">
            <div>
              <h2 className="text-base font-bold">HR Team</h2>
              <p className="text-xs text-gray-500">{filtered.length} {t("ofText")} {normalEmployees.length} {t("employees")}</p>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400"
                placeholder={t("searchEmployee")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
            style={{ gridTemplateColumns: "2fr 2fr 1.5fr 1.2fr 1fr 120px" }}>
            <span>{t("employee")}</span><span>{t("position")}</span>
            <span>{t("phone")}</span><span>{t("salary")}</span><span>{t("joined")}</span><span>Actions</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">{t("noEmployeesMatch")}</div>
          ) : (
            filtered.map((emp, i) => (
              <motion.div key={emp._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                style={{ gridTemplateColumns: "2fr 2fr 1.5fr 1.2fr 1fr 120px" }}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                    {emp.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{emp.name}</p>
                    {(emp.accountStatus === "approved")
                      ? <p className="text-[10px] text-gray-400">{emp.email}</p>
                      : (emp.accountStatus === "pending")
                      ? <span className="text-[10px] text-amber-400">Pending approval</span>
                      : <span className="text-[10px] text-gray-500">No login account</span>
                    }
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{emp.position}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{emp.phone || "—"}</p>
                <p className="text-xs text-[#c8202f] font-bold">{emp.salary ? `${emp.salary.toLocaleString()} TND` : "—"}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(emp.joinedDate)}</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition" title="Edit"><Pencil size={13} /></button>
                  {emp.accountStatus === "approved" && (
                    <button onClick={() => openResetPw(emp)} className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition" title="Reset Password"><KeyRound size={13} /></button>
                  )}
                  <button onClick={() => { setSelected(emp); setShowDelete(true); }} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition" title="Delete"><Trash2 size={13} /></button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>

        {/* Create */}
        {showCreate && (
          <Modal title="Add Employee" onClose={() => setShowCreate(false)}>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input className={inputClass} placeholder="Jane Doe" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Position</label>
                <select className={inputClass} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
                  <option value="">— Select Position —</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Phone</label>
                  <input className={inputClass} placeholder="12345678" maxLength={8} value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
                </div>
                <div>
                  <label className={labelClass}>Salary (TND)</label>
                  <input className={inputClass} type="text" inputMode="numeric" placeholder="0" value={form.salary}
                    onChange={e => setForm(f => ({ ...f, salary: e.target.value.replace(/\D/g, "") }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelClass}>CIN Number *</label><input className={inputClass} placeholder="12345678" maxLength={8} value={form.cin} onChange={e => setForm(f => ({ ...f, cin: e.target.value.replace(/\D/g,"") }))} /></div>
                <div className="flex items-end"><p className="text-[10px] text-gray-500 pb-2">National ID — 8 digits, required.</p></div>
              </div>
              <div>
                <label className={labelClass}>CIN Card Copy *</label>
                <div onClick={() => cinFileRef.current?.click()}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${cinFile ? "bg-[#c8202f]/10 border-[#c8202f]/30" : "bg-gray-100 dark:bg-black/30 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"}`}>
                  <FileText size={14} className={cinFile ? "text-[#c8202f]" : "text-gray-400 dark:text-gray-500"} />
                  {cinFile ? (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#c8202f] truncate">{cinFile.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{(cinFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (<p className="text-xs text-gray-400 dark:text-gray-500">Click to attach the CIN card (PDF or image)…</p>)}
                  {cinFile && (
                    <button type="button" onClick={e => { e.stopPropagation(); setCinFile(null); if (cinFileRef.current) cinFileRef.current.value = ""; }} className="text-gray-400 hover:text-red-400 transition flex-shrink-0"><X size={13} /></button>
                  )}
                  <input ref={cinFileRef} type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setCinFile(f); }} />
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5">Saved automatically to Documents as an “ID Copy”.</p>
              </div>
              <CalendarPicker value={form.joinedDate} onChange={(date) => setForm(f => ({ ...f, joinedDate: date }))}
                inputClass={inputClass} labelClass={labelClass} />
              {payrollFields}
              {formError && <p className="text-red-400 text-xs">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                <button onClick={handleCreate} disabled={submitting}
                  className="flex-1 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-black font-bold text-xs transition flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add Employee
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Edit */}
        {showEdit && selected && (
          <Modal title="Edit Employee" onClose={() => setShowEdit(false)}>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Position</label>
                <select className={inputClass} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
                  <option value="">— Select Position —</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Phone</label>
                  <input className={inputClass} maxLength={8} value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
                </div>
                <div>
                  <label className={labelClass}>Salary (TND)</label>
                  <input className={inputClass} type="text" inputMode="numeric" value={form.salary}
                    onChange={e => setForm(f => ({ ...f, salary: e.target.value.replace(/\D/g, "") }))} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input className={inputClass} type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div><label className={labelClass}>CIN Number</label><input className={inputClass} placeholder="12345678" maxLength={8} value={form.cin} onChange={e => setForm(f => ({ ...f, cin: e.target.value.replace(/\D/g,"") }))} /></div>
              <CalendarPicker value={form.joinedDate} onChange={(date) => setForm(f => ({ ...f, joinedDate: date }))}
                inputClass={inputClass} labelClass={labelClass} />
              {payrollFields}
              {formError && <p className="text-red-400 text-xs">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowEdit(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                <button onClick={handleEdit} disabled={submitting}
                  className="flex-1 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />} Save Changes
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Delete */}
        {showDelete && selected && (
          <Modal title="Delete Employee" onClose={() => setShowDelete(false)}>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Are you sure you want to delete <span className="text-white font-bold">{selected.name}</span>? This cannot be undone.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowDelete(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                <button onClick={handleDelete} disabled={submitting}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Credentials after approval */}
        {createdCredentials && (
          <Modal title="Account Created" onClose={() => setCreatedCredentials(null)}>
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-[#c8202f]/5 border border-[#c8202f]/20 rounded-xl">
                <CheckCircle size={20} className="text-[#c8202f] flex-shrink-0" />
                <p className="text-xs text-gray-400">Account approved successfully. Share these credentials with the employee — the password will not be shown again.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Email</label>
                  <div className="flex items-center gap-2">
                    <input readOnly className={inputClass} value={createdCredentials.email} />
                    <button onClick={() => navigator.clipboard.writeText(createdCredentials.email)}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition whitespace-nowrap">Copy</button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <div className="flex items-center gap-2">
                    <input readOnly className={inputClass} value={createdCredentials.password} />
                    <button onClick={() => navigator.clipboard.writeText(createdCredentials.password)}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition whitespace-nowrap">Copy</button>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <button onClick={() => setCreatedCredentials(null)}
                  className="w-full px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-black font-bold text-xs transition">Done</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Reset Password */}
        {showResetPw && resetPwTarget && (
          <Modal title="Reset Password" onClose={() => setShowResetPw(false)}>
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <KeyRound size={14} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{resetPwTarget.name}</p>
                  <p className="text-[10px] text-gray-400">{resetPwTarget.email}</p>
                </div>
              </div>
              {resetPwSuccess ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <CheckCircle size={32} className="text-[#c8202f]" />
                  <p className="text-sm font-bold text-white">Password Reset Successfully</p>
                  <p className="text-xs text-gray-400 text-center">Make sure to share the password with {resetPwTarget.name}.</p>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelClass}>Generated Password</label>
                      <button type="button" onClick={() => { setGeneratedPw(genPassword()); setCopied(false); }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 transition uppercase tracking-wide font-bold">
                        ↺ Regenerate
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input readOnly type={showGenPw ? "text" : "password"} value={generatedPw}
                          className={inputClass + " font-mono pr-10"} />
                        <button type="button" onClick={() => setShowGenPw(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition">
                          {showGenPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <button type="button"
                        onClick={() => { navigator.clipboard.writeText(generatedPw); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap ${copied ? "bg-[#c8202f]/15 border-[#c8202f]/40 text-[#c8202f]" : "border-gray-200 dark:border-white/10 text-gray-500 hover:text-white"}`}>
                        {copied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1.5">Copy this password and share it with the user before confirming.</p>
                  </div>
                  {resetPwError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{resetPwError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowResetPw(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                    <button onClick={handleResetPw} disabled={resetPwSubmitting}
                      className="flex-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition flex items-center justify-center gap-2">
                      {resetPwSubmitting ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} Confirm Reset
                    </button>
                  </div>
                </>
              )}
            </div>
          </Modal>
        )}

      </AnimatePresence>
    
    </ProtectedRoute>
  );
}