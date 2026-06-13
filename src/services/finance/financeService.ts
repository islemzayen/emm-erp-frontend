import api from "@/services/api";

export type FinanceEntryType =
  | "PAYABLE_RECORDED"
  | "PAYABLE_PAYMENT"
  | "PAYABLE_CREDIT"
  | "INVOICE_ISSUED"
  | "REGLEMENT_RECU"
  | "MANUAL_ENTRY";

export interface FinanceEntry {
  _id: string;
  entryType: FinanceEntryType;
  direction: "INFLOW" | "OUTFLOW" | "NONE";
  sourceModule: "PURCHASE" | "COMMERCIAL" | "FINANCE";
  sourceType: string;
  sourceId: string;
  reference: string;
  counterpartyType: "SUPPLIER" | "CUSTOMER" | "INTERNAL";
  counterpartyId: string;
  counterpartyName: string;
  amount: number;
  currency: string;
  status: "OPEN" | "SETTLED" | "INFO";
  occurredAt: string;
  notes: string;
}

export interface FinanceDashboardResponse {
  totals: {
    totalPayablesOutstanding: number;
    totalPaidOut: number;
    totalReceivables: number;
    totalCollected: number;
    recognizedRevenue: number;
    netExpectedCash: number;
    overduePayables: number;
    totalSalary: number;
    salariedEmployees: number;
  };
  recentEntries: FinanceEntry[];
}

export interface FinanceReceivable {
  _id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  status: "SHIPPED" | "DELIVERED" | "CLOSED";
  amount: number;
  invoiceNo?: string;
  totalTtc?: number;
  amountPaid?: number;
  finalizedAt?: string | null;
  paymentStatus?: "NON_PAYEE" | "PARTIELLEMENT_PAYEE" | "PENDING_CHEQUE" | "PAYEE";
  paymentMethod?: "UNSET" | "ESPECE" | "CHEQUE" | "VIREMENT" | "KUMBIL";
  promisedDate: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  trackingNumber: string;
}

export interface FinancePayable {
  _id: string;
  invoiceNo: string;
  supplierId: string;
  supplierNo: string;
  supplierName: string;
  status: "APPROVED" | "PARTIALLY_PAID" | "PAID";
  totalTtc: number;
  amountPaid: number;
  creditNoteAmount: number;
  outstanding: number;
  legalizationStatus?: "NON_LEGALISEE" | "LEGALISEE";
  dueDate: string | null;
  invoiceDate: string | null;
  matchingStatus: "MATCHED" | "MISMATCH";
  isOverdue: boolean;
}

export interface TreasuryMovement {
  _id: string;
  reference: string;
  direction: "INFLOW" | "OUTFLOW";
  amount: number;
  method: string;
  date: string | null;
  counterparty: string;
}

export interface TreasuryResponse {
  summary: {
    actualOutflows: number;
    expectedInflows: number;
    openPayables: number;
    openReceivables: number;
    next30DaysSupplierDue: number;
  };
  cashMovements: TreasuryMovement[];
  recentEntries: FinanceEntry[];
}

export interface AccountingJournalLine {
  accountCode: string;
  accountName: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
}

export interface AccountingJournalEntry {
  _id: string;
  sourceType: string;
  sourceId: string;
  reference: string;
  entryType: FinanceEntryType;
  sourceModule: "PURCHASE" | "COMMERCIAL" | "FINANCE";
  counterpartyName: string;
  direction: "INFLOW" | "OUTFLOW" | "NONE";
  occurredAt: string;
  notes: string;
  currency: string;
  lines: AccountingJournalLine[];
}

export interface AccountLedgerMovement {
  journalEntryId: string;
  reference: string;
  entryType: FinanceEntryType;
  occurredAt: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
  direction: "INFLOW" | "OUTFLOW" | "NONE";
  counterpartyName: string;
}

export interface AccountingAccount {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  inflow: number;
  outflow: number;
  netFlow: number;
  entries: AccountLedgerMovement[];
}

export interface ManualJournalEntryLine {
  accountCode: string;
  accountName: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
}

export interface ManualJournalEntry {
  _id: string;
  reference: string;
  description: string;
  occurredAt: string;
  lines: ManualJournalEntryLine[];
  createdAt: string;
}

export interface TvaDeclarationResponse {
  period: { year: number; month: number };
  tvaCollectee: number;
  tvaDeductible: number;
  tvaNet: number;
  fodecCollecte: number;
  timbreADecaisser: number;
  rsADecaisser: number;
  salesRevenue: number;
  purchasesHt: number;
}

export interface RsPayment {
  _id: string;
  paymentNo: string;
  supplierName: string;
  supplierNo: string;
  invoiceNo: string;
  amount: number;
  rsRate: number;
  rsAmount: number;
  rsType: string;
  method: string;
  paymentDate: string | null;
}

export interface RsPaymentsResponse {
  payments: RsPayment[];
  totalRs: number;
}

export interface CalendarDay {
  inflows: number;
  outflows: number;
  net: number;
  inflowCount: number;
  outflowCount: number;
  kumbilExpected?: number;
  kumbilCount?: number;
}

export interface CalendarResponse {
  year: number;
  month: number;
  days: Record<string, CalendarDay>;
}

export interface CompanySettings {
  _id?: string;
  companyName: string;
  mf: string;
  rne: string;
  address: string;
  phone: string;
  email: string;
  rib: string;
  iban: string;
  bank: string;
  agence: string;
}

export interface SalesReportMonth {
  month: string;
  count: number;
  totalHt: number;
  totalTtc: number;
}

export interface SalesReportCustomer {
  customerName: string;
  count: number;
  totalTtc: number;
}

export interface SalesReportResponse {
  period: { from: string; to: string };
  summary: {
    totalCount: number;
    totalHt: number;
    totalTtc: number;
    totalPaid: number;
    totalUnpaid: number;
    paidCount: number;
    unpaidCount: number;
  };
  byMonth: SalesReportMonth[];
  topCustomers: SalesReportCustomer[];
}

export interface DepartmentExpenseRow {
  department: string;
  employeeCount: number;
  activeCount: number;
  onLeaveCount: number;
  totalSalary: number;
  avgSalary: number;
}

export interface DepartmentExpensesResponse {
  departments: DepartmentExpenseRow[];
  totalSalary: number;
  totalEmployees: number;
}

export interface FinanceReportsResponse {
  balanceSheet: {
    assets: {
      receivables: number;
      cash: number;
      bank: number;
      total: number;
    };
    liabilities: {
      supplierPayables: number;
      tvaCollectee: number;
      fodecCollecte: number;
      timbreADecaisser: number;
      rsADecaisser: number;
      total: number;
    };
  };
  profitAndLoss: {
    revenue: {
      salesRevenue: number;
      purchaseCredits: number;
      total: number;
    };
    expenses: {
      purchasesExpense: number;
      fodecAchats: number;
      timbreFiscal: number;
      total: number;
    };
    tax: {
      tvaCollectee: number;
      tvaDeductible: number;
      tvaNet: number;
      fodecCollecte: number;
      timbreADecaisser: number;
      rsADecaisser: number;
    };
    netResult: number;
  };
  accounts: AccountingAccount[];
}

export const financeService = {
  async getDashboard() {
    const { data } = await api.get<FinanceDashboardResponse>("/finance/dashboard");
    return data;
  },
  async getReceivables() {
    const { data } = await api.get<FinanceReceivable[]>("/finance/receivables");
    return data;
  },
  async getPayables() {
    const { data } = await api.get<FinancePayable[]>("/finance/payables");
    return data;
  },
  async getTreasury() {
    const { data } = await api.get<TreasuryResponse>("/finance/treasury");
    return data;
  },
  async getEntries() {
    const { data } = await api.get<FinanceEntry[]>("/finance/entries");
    return data;
  },
  async getJournal() {
    const { data } = await api.get<AccountingJournalEntry[]>("/finance/journal");
    return data;
  },
  async getAccounts(filters?: { year?: number; month?: number }) {
    const { data } = await api.get<{ accounts: AccountingAccount[]; totals: { inflow: number; outflow: number; netFlow: number } }>("/finance/accounts", {
      params: filters,
    });
    return data;
  },
  async getAccountLedger(code: string) {
    const { data } = await api.get<AccountingAccount>(`/finance/accounts/${code}`);
    return data;
  },
  async getReports() {
    const { data } = await api.get<FinanceReportsResponse>("/finance/reports");
    return data;
  },
  async updateInvoiceTej(id: string, payload: { tejReference?: string; tejStatus?: string; tejQrData?: string }) {
    const { data } = await api.patch(`/finance/invoices/${id}/tej`, payload);
    return data;
  },
  async getManualEntries() {
    const { data } = await api.get<ManualJournalEntry[]>("/finance/manual-entries");
    return data;
  },
  async createManualEntry(payload: { reference: string; description?: string; occurredAt?: string; lines: ManualJournalEntryLine[] }) {
    const { data } = await api.post<ManualJournalEntry>("/finance/manual-entries", payload);
    return data;
  },
  async deleteManualEntry(id: string) {
    await api.delete(`/finance/manual-entries/${id}`);
  },
  async getTvaDeclaration(year: number, month: number) {
    const { data } = await api.get<TvaDeclarationResponse>(`/finance/tva-declaration?year=${year}&month=${month}`);
    return data;
  },
  async getRsPayments() {
    const { data } = await api.get<RsPaymentsResponse>("/finance/rs");
    return data;
  },
  async getCalendar(year: number, month: number) {
    const { data } = await api.get<CalendarResponse>(`/finance/calendar?year=${year}&month=${month}`);
    return data;
  },
  async getSettings() {
    const { data } = await api.get<CompanySettings>("/finance/settings");
    return data;
  },
  async updateSettings(payload: Partial<CompanySettings>) {
    const { data } = await api.put<CompanySettings>("/finance/settings", payload);
    return data;
  },
  async getDepartmentExpenses() {
    const { data } = await api.get<DepartmentExpensesResponse>("/finance/reports/department-expenses");
    return data;
  },
  async getSalesReport(from: string, to: string) {
    const { data } = await api.get<SalesReportResponse>(`/finance/reports/sales?from=${from}&to=${to}`);
    return data;
  },
  async payPayable(invoiceId: string, payload: { method: string; amount: number; paymentDate: string; notes?: string }) {
    const { data } = await api.post(`/finance/payables/${invoiceId}/pay`, payload);
    return data;
  },
  async resyncFinanceEntries(): Promise<{ totalClientInvoices: number; totalPurchaseInvoices: number }> {
    const { data } = await api.post("/finance/resync");
    return data;
  },
};
