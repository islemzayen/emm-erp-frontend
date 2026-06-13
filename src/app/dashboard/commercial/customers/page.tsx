"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useMemo, useState } from "react";
import { customerService, type Customer } from "@/services/commercial/customerService";
import { CONTINENTS, COUNTRIES_BY_CONTINENT, STATES_BY_COUNTRY, getCustomerRegionLabel } from "@/lib/regionHierarchy";
import {
  Users,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Search,
  X,
  Loader2,
  UserCheck,
  UserX,
} from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  continent: string;
  country: string;
  state: string;
  mf: string;
  notes: string;
};

const emptyForm: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  continent: "Africa",
  country: "Tunisia",
  state: "",
  mf: "",
  notes: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function toForm(customer: Customer): CustomerForm {
  return {
    name: customer.name,
    email: customer.email || "",
    phone: customer.phone || "",
    address: customer.address || "",
    city: customer.city || "",
    continent: customer.continent || "Africa",
    country: customer.country || "Tunisia",
    state: customer.state || "",
    mf: customer.mf || "",
    notes: customer.notes || "",
  };
}

export default function CustomersPage() {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setCustomers(await customerService.getAll());
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load customers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm(toForm(customer));
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Customer name is required");
      return;
    }

    if (!form.continent.trim() || !form.country.trim()) {
      setError("Continent and country are required");
      return;
    }

    if (!form.state.trim()) {
      setError("State is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...form,
        state: form.state,
      };

      if (editing) await customerService.update(editing._id, payload);
      else await customerService.create(payload);

      setShowForm(false);
      await fetchAll();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save customer"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      setTogglingId(id);
      await customerService.toggleActive(id);
      await fetchAll();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update status"));
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = useMemo(
    () =>
      customers.filter((customer) => {
        const query = search.toLowerCase();
        return (
          customer.name.toLowerCase().includes(query) ||
          (customer.email || "").toLowerCase().includes(query) ||
          getCustomerRegionLabel(customer).toLowerCase().includes(query)
        );
      }),
    [customers, search]
  );

  const formatMoney = (value: number) =>
    `${value.toLocaleString("fr-TN", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} TND`;

  const countryOptions = COUNTRIES_BY_CONTINENT[form.continent] || [];
  const stateOptions = STATES_BY_COUNTRY[form.country] || [];
  const total = customers.length;
  const active = customers.filter((customer) => customer.active).length;
  const inactive = total - active;

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("commercialModule") || "Commercial"} · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Users size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {t("customersTitle") || "Customers"}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Manage your customer database with region hierarchy
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus size={15} /> {t("addCustomer") || "Add Customer"}
          </button>
        </div>

        {error && !showForm && (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 shrink-0 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: total, icon: <Users size={16} />, color: "text-slate-900 dark:text-white" },
            { label: t("active") || "Active", value: active, icon: <UserCheck size={16} />, color: "text-emerald-600 dark:text-emerald-400" },
            { label: t("inactive") || "Inactive", value: inactive, icon: <UserX size={16} />, color: "text-rose-500 dark:text-rose-400" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className={`${surface} px-6 py-5`}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{label}</p>
                <span className="text-slate-300 dark:text-slate-600">{icon}</span>
              </div>
              <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className={`${surface} flex items-center gap-3 px-5 py-3.5`}>
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search") || "Search by name, email or region..."}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${surface} py-16 text-center`}>
            <Users size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("noCustomers") || "No customers found"}</p>
          </div>
        ) : (
          <div className={`${surface} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-3 font-medium">{t("customerName") || "Customer"}</th>
                    <th className="px-6 py-3 font-medium">{t("emailLabel2") || "Email"}</th>
                    <th className="px-6 py-3 font-medium">{t("phoneLabel") || "Phone"}</th>
                    <th className="px-6 py-3 font-medium">{t("regionLabel") || "Region"}</th>
                    <th className="px-6 py-3 font-medium">Total Amount</th>
                    <th className="px-6 py-3 font-medium">{t("status") || "Status"}</th>
                    <th className="px-6 py-3 font-medium text-right">{t("actionsCol") || "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((customer) => (
                    <tr key={customer._id} className={!customer.active ? "opacity-60" : ""}>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{customer.name}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{customer.email || "—"}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{customer.phone || "—"}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{getCustomerRegionLabel(customer) || "—"}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {formatMoney(Number(customer.totalOrderAmount || 0))}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${customer.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                          {customer.active ? (t("active") || "Active") : (t("inactive") || "Inactive")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(customer)}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Pencil size={12} /> {t("edit") || "Edit"}
                          </button>
                          <button
                            onClick={() => handleToggle(customer._id)}
                            disabled={togglingId === customer._id}
                            className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
                              customer.active
                                ? "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/20"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
                            }`}
                          >
                            {togglingId === customer._id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : customer.active ? (
                              <ToggleRight size={12} />
                            ) : (
                              <ToggleLeft size={12} />
                            )}
                            {customer.active ? (t("deactivate") || "Deactivate") : (t("activate") || "Activate")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <Users size={16} className="text-slate-600 dark:text-slate-300" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                    {editing ? (t("editCustomer") || "Edit Customer") : (t("addCustomer") || "Add Customer")}
                  </h2>
                </div>
                <button onClick={() => { setShowForm(false); setError(""); }} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className={labelClass}>{t("fullNameLabel")} <span className="text-rose-500 normal-case tracking-normal">*</span></label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="John Doe" />
                </div>

                <div>
                  <label className={labelClass}>{t("phoneLabel") || "Phone"}</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="+216 ..." />
                </div>

                <div>
                  <label className={labelClass}>{t("emailLabel2") || "Email"}</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="contact@example.com" />
                </div>

                <div>
                  <label className={labelClass}>Matricule Fiscal (MF)</label>
                  <input value={form.mf} onChange={(e) => setForm({ ...form, mf: e.target.value })} className={inputClass} placeholder="0000000A/B/M/000" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Continent</label>
                    <select
                      value={form.continent}
                      onChange={(e) => setForm({ ...form, continent: e.target.value, country: "", state: "" })}
                      className={inputClass}
                    >
                      {CONTINENTS.map((continent) => (
                        <option key={continent} value={continent}>{continent}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Country</label>
                    <select
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value, state: "" })}
                      className={inputClass}
                    >
                      <option value="">Select country</option>
                      {countryOptions.map((country) => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>State</label>
                    {stateOptions.length > 0 ? (
                      <select
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Select state</option>
                        {stateOptions.map((state) => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                        className={inputClass}
                        placeholder="State"
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>{t("addressLabel") || "Address"}</label>
                    <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} placeholder="Street, building..." />
                  </div>
                </div>

                {error && (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                <button
                  onClick={() => { setShowForm(false); setError(""); }}
                  className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t("cancel") || "Cancel"}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {t("saveAction")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
