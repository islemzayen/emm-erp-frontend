"use client";
import { exportBrandedXlsx } from "@/lib/reportExport";


import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Plus, Download,RefreshCw,
  UserCheck, Clock, FileText, Pencil, Trash2, X, Loader2, Wallet, CheckCircle, Receipt, CalendarOff, MoreVertical,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { hrService } from "@/services/hrservice";
import { adminService } from "@/services/adminService";
import { avanceService } from "@/services/avanceService";
import dailyAttendanceService from "@/services/DailyattendanceService";
import attendanceService from "@/services/attendanceService";
import { documentService } from "@/services/documentService";
import CalendarPicker from "@/components/CalendarPicker";

interface Employee {
  _id: string; name: string; position: string; phone: string;
  email: string; salary: number; joinedDate: string; status: string; department: string;
  accountStatus?: "pending" | "approved" | "none"; role?: string;
  cin?: string;
  matricule?: string; cnssNumber?: string; address?: string; qualification?: string;
  category?: string; echelon?: string; situation?: string; familyStatus?: string;
  numChildren?: number; hourlyRate?: number;
}
interface FormState {
  name: string; position: string; phone: string; salary: string; joinedDate: string; department: string;
  matricule: string; cnssNumber: string; address: string; qualification: string;
  category: string; echelon: string; situation: string; familyStatus: string;
  numChildren: string; hourlyRate: string; cin: string;
}
interface Credentials { email: string; password: string; }

const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]","bg-blue-500/20 text-blue-400","bg-purple-500/20 text-purple-400",
  "bg-amber-500/20 text-amber-400","bg-pink-500/20 text-pink-400","bg-teal-500/20 text-teal-400",
  "bg-red-500/20 text-red-400","bg-indigo-500/20 text-indigo-400",
];
const POSITIONS_BY_DEPT: Record<string, string[]> = {
  HR:             ["HR Manager", "HR Coordinator", "Recruiter", "Payroll Officer", "Employee", "Intern"],
  Marketing:      ["Marketing Manager", "Marketing Specialist", "Content Creator", "SEO Analyst", "Social Media Manager", "Employee", "Intern"],
  Finance:        ["Finance Manager", "Accountant", "Financial Analyst", "Auditor", "Employee", "Intern"],
  "Online Sales": ["Sales Manager", "Sales Representative", "Account Manager", "Customer Support", "Logistics Coordinator", "Employee", "Intern"],
  Commercial:     ["Commercial Manager", "Sales Engineer", "Account Manager", "Business Developer", "Employee", "Intern"],
  Stock:          ["Stock Manager", "Depot Manager" , "Warehouse Operator", "Inventory Analyst", "Logistics Officer", "Employee", "Intern"],
  Purchase:       ["Purchase Manager", "Buyer", "Procurement Officer", "Supplier Relations", "Employee", "Intern"],
  Production:     ["Production Manager", "Production Engineer", "Quality Control", "Technician", "Employee", "Intern"],
  Maintenance:    ["Maintenance Manager", "Maintenance Technician", "Electrician", "Mechanic", "Employee", "Intern"],
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function HREmployees() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const [search, setSearch]       = useState("");
  const [filterStatus, setFilter] = useState("all");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [showDelete, setShowDelete]   = useState(false);
  const [showAvance, setShowAvance]     = useState(false);
  const [avanceEmp, setAvanceEmp]       = useState<Employee | null>(null);
  const [avanceForm, setAvanceForm]     = useState({ amount: "", reason: "" });
  const [avanceError, setAvanceError]   = useState("");
  const [avanceLoading, setAvanceLoading] = useState(false);
  const [avanceSuccess, setAvanceSuccess] = useState("");
  const [showPayslip, setShowPayslip]   = useState(false);
  const [payslipEmp, setPayslipEmp]     = useState<Employee | null>(null);
  const [payslipAvances, setPayslipAvances] = useState<any[]>([]);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [payslipAtt, setPayslipAtt] = useState<{
    presentDays: number; absentDays: number; lateDays: number; totalExtraHours: number;
  } | null>(null);
  // Leave state
  const [showLeave, setShowLeave]           = useState(false);
  const [leaveEmp, setLeaveEmp]             = useState<Employee | null>(null);
  const [leaveUsedDays, setLeaveUsedDays]   = useState(0);
  const [leaveLoading, setLeaveLoading]     = useState(false);
  const [leaveForm, setLeaveForm]           = useState({ startDate: "", endDate: "", type: "Annual Leave", note: "" });
  const [leaveError, setLeaveError]         = useState("");
  const [leaveSuccess, setLeaveSuccess]     = useState("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveFile, setLeaveFile]             = useState<File | null>(null);
  const leaveFileRef                          = useRef<HTMLInputElement>(null);

  const [selected, setSelected]       = useState<Employee | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<Credentials | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [menuOpenUpward, setMenuOpenUpward] = useState<Record<string, boolean>>({});

  const emptyForm: FormState = {
    name: "", position: "", phone: "", salary: "", joinedDate: new Date().toISOString().split("T")[0], department: "HR",
    matricule: "", cnssNumber: "", address: "", qualification: "",
    category: "", echelon: "", situation: "", familyStatus: "", numChildren: "", hourlyRate: "", cin: "",
  };
  const [form, setForm] = useState<FormState>(emptyForm);
  const [cinFile, setCinFile] = useState<File | null>(null);
  const cinFileRef = useRef<HTMLInputElement>(null);

  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl transition-colors duration-300";
  const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition";
  const labelClass = "text-xs text-gray-500 uppercase tracking-widest mb-1 block";

  // Shared modal input styles (theme-aware)
  const modalInput = "w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#c8202f] transition";
  const modalLabel = "text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1 block";
  const hintClass  = "text-[10px] text-gray-400 dark:text-gray-600 mt-0.5";

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const emps = await hrService.getAllEmployees(true);
      setEmployees(emps?.data ?? emps ?? []);
    } catch {} finally { setLoading(false); }
  };

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
    if (form.cnssNumber && form.cnssNumber.length !== 8) { setFormError("N° CNSS must be exactly 8 digits"); return; }
    try {
      setSubmitting(true); setFormError("");
      const created = await hrService.createEmployee({ name: form.name, position: form.position, phone: form.phone, salary: Number(form.salary) || 0, joinedDate: form.joinedDate, department: form.department, ...buildPayrollPayload() });
      const newEmp = (created as any)?.data ?? created;
      // Auto-save the CIN card copy into Documents (type: "ID Copy")
      if (cinFile && newEmp?._id) {
        try {
          await documentService.upload({
            employeeId: newEmp._id, employeeName: form.name, department: form.department,
            type: "ID Copy", note: `CIN: ${form.cin}`, file: cinFile,
          });
        } catch {}
      }
      await fetchAll(); setShowCreate(false); setForm(emptyForm); setCinFile(null);
    } catch (err: any) { setFormError(err.response?.data?.message || "Failed to create employee"); }
    finally { setSubmitting(false); }
  };

  const openEdit = (emp: Employee) => {
    setSelected(emp);
    setForm({
      name: emp.name, position: emp.position, phone: emp.phone || "", salary: emp.salary ? String(emp.salary) : "", joinedDate: emp.joinedDate ? new Date(emp.joinedDate).toISOString().split("T")[0] : "", department: emp.department || "HR",
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
    if (form.cnssNumber && form.cnssNumber.length !== 8) { setFormError("N° CNSS must be exactly 8 digits"); return; }
    try {
      setSubmitting(true); setFormError("");
      await hrService.updateEmployee(selected!._id, { name: form.name, position: form.position, phone: form.phone, salary: Number(form.salary) || 0, joinedDate: form.joinedDate, department: form.department, ...buildPayrollPayload() });
      await fetchAll(); setShowEdit(false);
    } catch (err: any) { setFormError(err.response?.data?.message || "Failed to update employee"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    try { setSubmitting(true); await hrService.deleteEmployee(selected!._id); await fetchAll(); setShowDelete(false); }
    catch {} finally { setSubmitting(false); }
  };

  // Returns true if this employee has a manager-level login account
  const isManagerAccount = (emp: Employee) =>
    emp.role !== undefined && emp.role !== "EMPLOYEE" &&
    emp.accountStatus !== undefined && emp.accountStatus !== "none";

  // Only ADMIN can edit or delete manager accounts
  const canEditOrDelete = (emp: Employee) =>
    !isManagerAccount(emp) || currentUser?.role === "ADMIN";

  const formatDate = (d: string) => { if (!d) return "—"; return new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" }); };
  const statusLabel = (s: string) => s === "Active" ? t("active") : s === "On Leave" ? t("onLeave") : t("inactive");
  const statusStyle = (s: string) => s === "Active" ? "bg-[#c8202f]/15 text-[#c8202f]" : s === "On Leave" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400";
  const dotStyle    = (s: string) => s === "Active" ? "bg-[#c8202f]" : s === "On Leave" ? "bg-amber-400" : "bg-red-400";

  const exportXlsx = async () => {
    const headers = ["Name","Email","Department","Position","Phone","Salary (TND)","Status","Joined"];
    const rows = filtered.map(e => [e.name,e.email,e.department,e.position,e.phone||"",e.salary||0,e.status||"Active",e.joinedDate?new Date(e.joinedDate).toLocaleDateString("en-GB"):""]);
    await exportBrandedXlsx("Employees", headers, rows, `employees_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  async function handleAvanceSubmit() {
    if (!avanceEmp) return;
    const amount = Number(avanceForm.amount);
    if (!amount || amount <= 0) { setAvanceError("Please enter a valid amount."); return; }
    if (amount > (avanceEmp.salary || 0)) { setAvanceError(`Amount cannot exceed salary (${avanceEmp.salary?.toLocaleString()} TND).`); return; }
    if (!avanceForm.reason.trim()) { setAvanceError("Please enter a reason."); return; }
    setAvanceLoading(true); setAvanceError("");
    try {
      await avanceService.create({ employeeId: avanceEmp._id, employeeName: avanceEmp.name, department: avanceEmp.department, amount, reason: avanceForm.reason });
      const avances = await avanceService.list({ employeeId: avanceEmp._id, status: "Pending" });
      const list = Array.isArray(avances) ? avances : (avances?.data ?? []);
      if (list.length > 0) await avanceService.approve(list[0]._id);
      const emps = await hrService.getAllEmployees(true);
      setEmployees(Array.isArray(emps) ? emps : (emps?.data ?? []));
      setAvanceSuccess(`✓ Avance of ${amount.toLocaleString()} TND approved and deducted from ${avanceEmp.name}'s salary.`);
      setAvanceForm({ amount: "", reason: "" });
      setTimeout(() => { setShowAvance(false); setAvanceSuccess(""); setAvanceEmp(null); }, 2500);
    } catch (err: any) { setAvanceError(err?.response?.data?.message || "Failed to process avance."); }
    finally { setAvanceLoading(false); }
  }

  const LEAVE_DAYS_PER_YEAR = 25;

  function countDays(start: string, end: string): number {
    if (!start || !end) return 0;
    const s = new Date(start); const e = new Date(end);
    if (e < s) return 0;
    return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  function getDatesInRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const cur = new Date(start); const last = new Date(end);
    while (cur <= last) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6)
        dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  async function openLeave(emp: Employee) {
    setLeaveEmp(emp);
    setLeaveForm({ startDate: "", endDate: "", type: "Annual Leave", note: "" });
    setLeaveError(""); setLeaveSuccess(""); setLeaveFile(null);
    setLeaveLoading(true); setShowLeave(true);
    try {
      const res = await attendanceService.list({ employeeId: emp._id, status: "Approved" });
      const records: any[] = Array.isArray(res) ? res : ((res as any)?.data ?? []);
      const thisYear = new Date().getFullYear().toString();
      const used = records.filter((r: any) =>
        (r.type === "Annual Leave" || r.type === "Sick Leave") &&
        r.date?.startsWith(thisYear)
      ).length;
      setLeaveUsedDays(used);
    } catch { setLeaveUsedDays(0); }
    finally { setLeaveLoading(false); }
  }

  async function handleLeaveSubmit() {
    if (!leaveEmp) return;
    const { startDate, endDate, type, note } = leaveForm;
    if (!startDate || !endDate) { setLeaveError("Please select start and end dates."); return; }
    if (new Date(endDate) < new Date(startDate)) { setLeaveError("End date must be after start date."); return; }

    const requestedDates = getDatesInRange(startDate, endDate);
    const requestedDays  = requestedDates.length;
    const remaining      = LEAVE_DAYS_PER_YEAR - leaveUsedDays;

    if (type === "Annual Leave" && requestedDays > remaining) {
      setLeaveError(`Only ${remaining} leave days remaining (requested ${requestedDays}).`);
      return;
    }

    setLeaveSubmitting(true); setLeaveError("");
    try {
      const approvedDays  = type === "Annual Leave" ? Math.min(requestedDays, remaining) : requestedDays;
      const approvedDates = requestedDates.slice(0, approvedDays);
      const absentDates   = requestedDates.slice(approvedDays);

      await Promise.all(approvedDates.map(date =>
        attendanceService.create({ employeeId: leaveEmp._id, date, type: type as any, hours: "8h", note })
          .then(async (r: any) => {
            const id = r?.data?._id || r?._id;
            if (id) await attendanceService.updateStatus(id, "Approved");
          }).catch(() => {})
      ));

      await Promise.all(absentDates.map(date =>
        dailyAttendanceService.upsert({
          employeeId: leaveEmp._id,
          date,
          isAbsent: true,
          note: "Exceeded leave balance",
        }).catch(() => {})
      ));

      const msg = absentDates.length > 0
        ? `✓ ${approvedDays} day(s) approved as leave. ${absentDates.length} excess day(s) marked absent (leave balance exhausted).`
        : `✓ ${approvedDays} day(s) of ${type} approved for ${leaveEmp.name}.`;

      if (leaveFile) {
        try {
          await documentService.upload({
            employeeId:   leaveEmp._id,
            employeeName: leaveEmp.name,
            department:   leaveEmp.department,
            type:         "Absence Reason",
            note:         `${type} · ${startDate} → ${endDate}${note ? ` · ${note}` : ""}`,
            file:         leaveFile,
          });
        } catch {}
      }

      const today = new Date().toISOString().split("T")[0];
      const newStatus = today <= endDate ? "On Leave" : "Active";
      await hrService.updateStatus(leaveEmp._id, newStatus as "Active" | "On Leave" | "Inactive").catch(() => {});

      setLeaveSuccess(msg);
      setLeaveUsedDays(prev => prev + approvedDays);
      fetchAll();
      setTimeout(() => { setShowLeave(false); setLeaveSuccess(""); setLeaveEmp(null); }, 3000);
    } catch (err: any) {
      setLeaveError(err?.response?.data?.message || "Failed to process leave.");
    } finally { setLeaveSubmitting(false); }
  }

  const leaveDaysRequested = countDays(leaveForm.startDate, leaveForm.endDate);
  const leaveRemaining     = LEAVE_DAYS_PER_YEAR - leaveUsedDays;
  const leaveExcess        = leaveForm.type === "Annual Leave" ? Math.max(0, leaveDaysRequested - leaveRemaining) : 0;

  const filtered = employees.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.position.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || e.status?.toLowerCase().replace(" ","-") === filterStatus;
    return matchSearch && matchStatus;
  });

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
    <ProtectedRoute allowedRoles={["HR_MANAGER"]}>
      
        <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight leading-none">
                {t("employeeManagement").split(" ")[0]} <span className="text-[#c8202f]">{t("employeeManagement").split(" ").slice(1).join(" ")}</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">{t("humanResources")}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={exportXlsx} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
                <Download size={13} /> {t("export")}
              </button>
              <button
    onClick={fetchAll}
    disabled={loading}
    className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-50"
  >
    <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
    {t("refresh")}
  </button>
              <button onClick={() => { setForm(emptyForm); setFormError(""); setShowCreate(true); }}
                className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#c8202f] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-black font-bold">
                <Plus size={13} /> {t("addEmployee")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: t("totalEmployeesKpiShort"), value: String(employees.length),                                      sub: t("allDepartments"),   icon: <Users size={14} />,     iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
              { label: t("active"),                 value: String(employees.filter(e => e.status === "Active").length),   sub: t("currentlyWorking"), icon: <UserCheck size={14} />, iconBg: "bg-blue-500/10 text-blue-400" },
              { label: t("onLeaveKpi"),             value: String(employees.filter(e => e.status === "On Leave").length), sub: t("thisMonth"),        icon: <Clock size={14} />,     iconBg: "bg-amber-500/10 text-amber-400" },
              { label: t("inactive"),               value: String(employees.filter(e => e.status === "Inactive").length), sub: t("permanentStaff"),   icon: <FileText size={14} />,  iconBg: "bg-purple-500/10 text-purple-400" },
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

          <div className={`${card}`}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/[0.05]">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("allEmployees")}</h2>
                <p className="text-xs text-gray-500">{filtered.length} {t("ofText")} {employees.length} {t("records")}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder={t("searchEmployee")} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#c8202f]/40 transition"
                  value={filterStatus} onChange={e => setFilter(e.target.value)}>
                  <option value="all">{t("allStatus")}</option>
                  <option value="active">{t("active")}</option>
                  <option value="on-leave">{t("onLeave")}</option>
                  <option value="inactive">{t("inactive")}</option>
                </select>
              </div>
            </div>

            <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
              style={{ gridTemplateColumns: "2fr 1.5fr 1.5fr 1.5fr 1.2fr 1fr 1fr 48px" }}>
              <span>{t("employee")}</span><span>Department</span><span>{t("position")}</span>
              <span>{t("phone")}</span><span>{t("salary")}</span><span>{t("status")}</span>
              <span>{t("joined")}</span><span></span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">{t("noEmployeesMatch")}</div>
            ) : filtered.map((emp, i) => (
              <motion.div key={emp._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                style={{ gridTemplateColumns: "2fr 1.5fr 1.5fr 1.5fr 1.2fr 1fr 1fr 48px" }}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                    {emp.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{emp.name}</p>
                    {emp.accountStatus === "pending" ? (<span className="text-[10px] text-amber-400 flex items-center gap-1"><Clock size={9} /> Pending approval</span>) : emp.accountStatus === "none" ? (<span className="text-[10px] text-gray-500">No login account</span>) : (<p className="text-[10px] text-gray-400">{emp.email}</p>)}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                  emp.department === "HR"           ? "bg-blue-500/15 text-blue-400" :
                  emp.department === "Marketing"     ? "bg-purple-500/15 text-purple-400" :
                  emp.department === "Online Sales"  ? "bg-amber-500/15 text-amber-400" :
                  emp.department === "Finance"        ? "bg-[#c8202f]/15 text-[#c8202f]" :
                  emp.department === "Commercial"     ? "bg-teal-500/15 text-teal-400" :
                  emp.department === "Stock"          ? "bg-cyan-500/15 text-cyan-400" :
                  emp.department === "Purchase"       ? "bg-indigo-500/15 text-indigo-400" :
                  emp.department === "Production"     ? "bg-orange-500/15 text-orange-400" :
                  emp.department === "Maintenance"    ? "bg-pink-500/15 text-pink-400" :
                  "bg-gray-500/10 text-gray-400"
                }`}>{emp.department || "—"}</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">{emp.position}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{emp.phone || "—"}</p>
                <p className="text-xs text-[#c8202f] font-bold">{emp.salary ? `${emp.salary.toLocaleString()} TND` : "—"}</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${statusStyle(emp.status)}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotStyle(emp.status)}`} />{statusLabel(emp.status)}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(emp.joinedDate)}</p>
                {/* Three-dot menu */}
                <div className="relative flex justify-end">
                  <button
                    onClick={(e) => { const btn = e.currentTarget; const rect = btn.getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom; setMenuOpenUpward(prev => ({ ...prev, [emp._id]: spaceBelow < 180 })); setOpenMenuId(openMenuId === emp._id ? null : emp._id); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
                  >
                    <MoreVertical size={15} />
                  </button>
                  <AnimatePresence>
                    {openMenuId === emp._id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.1 }}
                        className={`absolute right-0 z-50 w-44 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl ${menuOpenUpward[emp._id] ? "bottom-8" : "top-8"}`}
                        onMouseLeave={() => setOpenMenuId(null)}
                      >
                        {canEditOrDelete(emp) && (
                          <button onClick={() => { openEdit(emp); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition">
                            <Pencil size={13} className="text-blue-400" /> Edit Employee
                          </button>
                        )}
                        <button onClick={() => { setAvanceEmp(emp); setAvanceForm({ amount: "", reason: "" }); setAvanceError(""); setAvanceSuccess(""); setShowAvance(true); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition">
                          <Wallet size={13} className="text-amber-400" /> Avance Salariale
                        </button>
                        <button onClick={() => { openLeave(emp); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition">
                          <CalendarOff size={13} className="text-[#c8202f]" /> Add Leave
                        </button>
                        <div className="border-t border-gray-100 dark:border-white/[0.06]" />
                        {canEditOrDelete(emp) && (
                          <button onClick={() => { setSelected(emp); setShowDelete(true); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/[0.06] transition">
                            <Trash2 size={13} /> Delete Employee
                          </button>
                        )}
                        {isManagerAccount(emp) && currentUser?.role !== "ADMIN" && (
                          <div className="px-4 py-2 text-[10px] text-gray-400 italic">
                            Admin only — edit/delete
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Standard modals (Create / Edit / Delete / Credentials) ── */}
        <AnimatePresence>
          {showCreate && (
            <Modal title="Add Employee" onClose={() => setShowCreate(false)}>
              <div className="space-y-4">
                <div><label className={labelClass}>Full Name</label><input className={inputClass} placeholder="Jane Doe" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div>
                  <label className={labelClass}>Department</label>
                  <select className={inputClass} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value, position: "" }))}>
                    <option value="HR">HR</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Online Sales">Online Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Stock">Stock</option>
                    <option value="Purchase">Purchase</option>
                    <option value="Production">Production</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div><label className={labelClass}>Position</label>
                  <select className={inputClass} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
                    <option value="">— Select Position —</option>
                    {(POSITIONS_BY_DEPT[form.department] ?? POSITIONS_BY_DEPT["HR"]).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {["HR Manager","Marketing Manager","Sales Manager","Finance Manager","Commercial Manager","Stock Manager","Purchase Manager","Production Manager","Maintenance Manager","Depot Manager"].includes(form.position) && (
                    <p className="text-[10px] text-amber-400 mt-1.5">⏳ Manager role — Admin must approve to activate login account</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input className={inputClass} placeholder="12345678" maxLength={8} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g,"") }))} />
                    <p className={hintClass}>Exactly 8 digits</p>
                  </div>
                  <div>
                    <label className={labelClass}>Salary (TND)</label>
                    <input className={inputClass} type="text" inputMode="numeric" placeholder="0" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value.replace(/\D/g,"") }))} />
                    <p className={hintClass}>Digits only</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>CIN Number *</label>
                    <input className={inputClass} placeholder="12345678" maxLength={8} value={form.cin} onChange={e => setForm(f => ({ ...f, cin: e.target.value.replace(/\D/g,"") }))} />
                    <p className={hintClass}>Exactly 8 digits · required</p>
                  </div>
                  <div className="flex items-end pb-5">
                    <p className="text-[10px] text-gray-500">National ID number.</p>
                  </div>
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
                  <p className="text-[10px] text-gray-500 mt-1.5">Saved automatically to Documents as an "ID Copy".</p>
                </div>
                <CalendarPicker value={form.joinedDate} onChange={date => setForm(f => ({ ...f, joinedDate: date }))} inputClass={inputClass} labelClass={labelClass} />
                {payrollFields}
                {formError && <p className="text-red-400 text-xs">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                  <button onClick={handleCreate} disabled={submitting} className="flex-1 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#c8202f] text-black font-bold text-xs transition flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add Employee
                  </button>
                </div>
              </div>
            </Modal>
          )}
          {showEdit && selected && (
            <Modal title="Edit Employee" onClose={() => setShowEdit(false)}>
              <div className="space-y-4">
                <div><label className={labelClass}>Full Name</label><input className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div>
                  <label className={labelClass}>Department</label>
                  <select className={inputClass} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value, position: "" }))}>
                    <option value="HR">HR</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Online Sales">Online Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Stock">Stock</option>
                    <option value="Purchase">Purchase</option>
                    <option value="Production">Production</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div><label className={labelClass}>Position</label>
                  <select className={inputClass} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
                    <option value="">— Select Position —</option>
                    {(POSITIONS_BY_DEPT[form.department] ?? POSITIONS_BY_DEPT["HR"]).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input className={inputClass} maxLength={8} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g,"") }))} />
                    <p className={hintClass}>Exactly 8 digits</p>
                  </div>
                  <div>
                    <label className={labelClass}>Salary (TND)</label>
                    <input className={inputClass} type="text" inputMode="numeric" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value.replace(/\D/g,"") }))} />
                    <p className={hintClass}>Digits only</p>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>CIN Number</label>
                  <input className={inputClass} placeholder="12345678" maxLength={8} value={form.cin} onChange={e => setForm(f => ({ ...f, cin: e.target.value.replace(/\D/g,"") }))} />
                  <p className={hintClass}>Exactly 8 digits</p>
                </div>
                <CalendarPicker value={form.joinedDate} onChange={date => setForm(f => ({ ...f, joinedDate: date }))} inputClass={inputClass} labelClass={labelClass} />
                {payrollFields}
                {formError && <p className="text-red-400 text-xs">{formError}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowEdit(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                  <button onClick={handleEdit} disabled={submitting} className="flex-1 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />} Save Changes
                  </button>
                </div>
              </div>
            </Modal>
          )}
          {showDelete && selected && (
            <Modal title="Delete Employee" onClose={() => setShowDelete(false)}>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Are you sure you want to delete <span className="text-gray-900 dark:text-white font-bold">{selected.name}</span>? This cannot be undone.</p>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowDelete(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                  <button onClick={handleDelete} disabled={submitting} className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                  </button>
                </div>
              </div>
            </Modal>
          )}
          {createdCredentials && (
            <Modal title={t("accountCreated")} onClose={() => setCreatedCredentials(null)}>
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Share these credentials with the employee. This password will not be shown again.</p>
                <div className="space-y-3">
                  <div><label className={labelClass}>Email</label>
                    <div className="flex items-center gap-2">
                      <input readOnly className={inputClass} value={createdCredentials.email} />
                      <button onClick={() => navigator.clipboard.writeText(createdCredentials.email)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition whitespace-nowrap">Copy</button>
                    </div>
                  </div>
                  <div><label className={labelClass}>Password</label>
                    <div className="flex items-center gap-2">
                      <input readOnly className={inputClass} value={createdCredentials.password} />
                      <button onClick={() => navigator.clipboard.writeText(createdCredentials.password)} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition whitespace-nowrap">Copy</button>
                    </div>
                  </div>
                </div>
                <button onClick={() => setCreatedCredentials(null)} className="w-full px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#c8202f] text-black font-bold text-xs transition">Done</button>
              </div>
            </Modal>
          )}
        </AnimatePresence>

        {/* ── Avance Modal (theme-aware) ── */}
        <AnimatePresence>
          {showAvance && avanceEmp && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Wallet size={16} className="text-amber-400" /> Avance Salariale
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{avanceEmp.name} · {avanceEmp.department}</p>
                  </div>
                  <button onClick={() => setShowAvance(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"><X size={18} /></button>
                </div>
                <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Current Salary</span>
                  <span className="text-sm font-bold text-[#c8202f]">{(avanceEmp.salary || 0).toLocaleString()} TND</span>
                </div>
                {avanceSuccess ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <CheckCircle size={32} className="text-[#c8202f]" />
                    <p className="text-xs text-[#c8202f] text-center">{avanceSuccess}</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={modalLabel}>Amount (TND) *</label>
                      <input type="text" inputMode="numeric"
                        className={modalInput}
                        placeholder={`e.g. 500 (max ${(avanceEmp.salary || 0).toLocaleString()} TND)`}
                        value={avanceForm.amount} onChange={e => setAvanceForm(f => ({ ...f, amount: e.target.value.replace(/[^0-9.]/g,"") }))} />
                    </div>
                    <div>
                      <label className={modalLabel}>Reason *</label>
                      <textarea rows={3}
                        className={`${modalInput} resize-none`}
                        placeholder="e.g. Medical emergency, rent payment..."
                        value={avanceForm.reason} onChange={e => setAvanceForm(f => ({ ...f, reason: e.target.value }))} />
                    </div>
                    {avanceForm.amount && Number(avanceForm.amount) > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-500 dark:text-amber-400">
                        Next salary will be <span className="font-bold">{Math.max(0,(avanceEmp.salary||0)-Number(avanceForm.amount)).toLocaleString()} TND</span> after deduction of <span className="font-bold">{Number(avanceForm.amount).toLocaleString()} TND</span>
                      </div>
                    )}
                    {avanceError && <p className="text-xs text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{avanceError}</p>}
                    <div className="flex gap-3">
                      <button onClick={() => setShowAvance(false)} className="flex-1 py-2 rounded-xl text-xs border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20 transition">Cancel</button>
                      <button onClick={handleAvanceSubmit} disabled={avanceLoading}
                        className="flex-1 py-2 rounded-xl text-xs bg-[#c8202f] hover:bg-[#c8202f] text-black font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
                        {avanceLoading ? <><div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> Processing…</> : <><Wallet size={12} /> Approve & Deduct</>}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Leave Modal (theme-aware) ── */}
        <AnimatePresence>
          {showLeave && leaveEmp && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <CalendarOff size={16} className="text-[#c8202f]" /> Add Leave
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{leaveEmp.name} · {leaveEmp.department}</p>
                  </div>
                  <button onClick={() => setShowLeave(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"><X size={18} /></button>
                </div>

                {leaveLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-500 dark:text-gray-400 text-xs">
                    <Loader2 size={16} className="animate-spin" /> Loading leave balance…
                  </div>
                ) : leaveSuccess ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <CheckCircle size={32} className="text-[#c8202f]" />
                    <p className="text-xs text-[#c8202f] text-center leading-relaxed">{leaveSuccess}</p>
                  </div>
                ) : (
                  <>
                    {/* Leave balance bar */}
                    <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Annual Leave Balance</span>
                        <span className={`text-sm font-bold ${leaveRemaining <= 5 ? "text-red-500 dark:text-red-400" : "text-[#c8202f]"}`}>
                          {leaveRemaining} / {LEAVE_DAYS_PER_YEAR} days left
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${leaveRemaining <= 5 ? "bg-red-500" : "bg-[#c8202f]"}`}
                          style={{ width: `${Math.max(0, (leaveRemaining / LEAVE_DAYS_PER_YEAR) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{leaveUsedDays} days used this year</p>
                    </div>

                    {/* Leave type */}
                    <div>
                      <label className={modalLabel}>Leave Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {["Annual Leave", "Sick Leave", "Remote Work", "Unpaid Leave"].map(type => (
                          <button key={type} onClick={() => setLeaveForm(f => ({ ...f, type }))}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition text-left ${
                              leaveForm.type === type
                                ? "bg-[#c8202f]/15 border-[#c8202f]/40 text-[#c8202f]"
                                : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20"
                            }`}>
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={modalLabel}>Start Date</label>
                        <input type="date" value={leaveForm.startDate}
                          onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))}
                          className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f] transition" />
                      </div>
                      <div>
                        <label className={modalLabel}>End Date</label>
                        <input type="date" value={leaveForm.endDate}
                          onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))}
                          className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f] transition" />
                      </div>
                    </div>

                    {/* Note */}
                    <div>
                      <label className={modalLabel}>{t("noteOptional")}</label>
                      <input type="text" placeholder="e.g. Family trip, medical appointment…"
                        value={leaveForm.note} onChange={e => setLeaveForm(f => ({ ...f, note: e.target.value }))}
                        className={modalInput} />
                    </div>

                    {/* Leave document upload */}
                    <div>
                      <label className={modalLabel}>
                        Supporting Document <span className="text-gray-400 dark:text-gray-600 normal-case tracking-normal">(optional · auto-saved to Documents)</span>
                      </label>
                      <div
                        onClick={() => leaveFileRef.current?.click()}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                          leaveFile
                            ? "bg-[#c8202f]/10 border-[#c8202f]/30"
                            : "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                        }`}
                      >
                        <FileText size={14} className={leaveFile ? "text-[#c8202f]" : "text-gray-400 dark:text-gray-500"} />
                        {leaveFile ? (
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-[#c8202f] truncate">{leaveFile.name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">{(leaveFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500">Click to attach a PDF…</p>
                        )}
                        {leaveFile && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setLeaveFile(null); if (leaveFileRef.current) leaveFileRef.current.value = ""; }}
                            className="text-gray-400 hover:text-red-400 transition flex-shrink-0"
                          >
                            <X size={13} />
                          </button>
                        )}
                        <input
                          ref={leaveFileRef}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f && f.type === "application/pdf") setLeaveFile(f);
                            else if (f) setLeaveError("Only PDF files are accepted.");
                          }}
                        />
                      </div>
                    </div>

                    {/* Live preview */}
                    {leaveDaysRequested > 0 && (
                      <div className={`rounded-xl px-4 py-3 text-xs space-y-1 border ${
                        leaveExcess > 0
                          ? "bg-red-500/10 border-red-500/20"
                          : "bg-[#c8202f]/10 border-[#c8202f]/20"
                      }`}>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Requested days</span>
                          <span className="font-bold text-gray-900 dark:text-white">{leaveDaysRequested}</span>
                        </div>
                        {leaveForm.type === "Annual Leave" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-[#c8202f]">Approved as leave</span>
                              <span className="font-bold text-[#c8202f]">{Math.min(leaveDaysRequested, leaveRemaining)}</span>
                            </div>
                            {leaveExcess > 0 && (
                              <div className="flex justify-between">
                                <span className="text-red-500 dark:text-red-400">Marked absent (over balance)</span>
                                <span className="font-bold text-red-500 dark:text-red-400">{leaveExcess}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {leaveError && (
                      <p className="text-xs text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{leaveError}</p>
                    )}

                    <div className="flex gap-3">
                      <button onClick={() => setShowLeave(false)} className="flex-1 py-2 rounded-xl text-xs border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/20 transition">Cancel</button>
                      <button onClick={handleLeaveSubmit} disabled={leaveSubmitting || !leaveForm.startDate || !leaveForm.endDate}
                        className="flex-1 py-2 rounded-xl text-xs bg-[#c8202f] hover:bg-[#c8202f] text-black font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
                        {leaveSubmitting
                          ? <><div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> Processing…</>
                          : <><CalendarOff size={12} /> Confirm Leave</>}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      
    </ProtectedRoute>
  );
}