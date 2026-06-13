import api from "./api";

export interface DailyRecord {
  _id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: "Present" | "Absent" | "Late";
  hoursWorked: number;
  extraHours: number;
  note: string;
  recordedBy: string;
}

export interface DailySummary {
  employeeId: string;
  employeeName: string;
  department: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalExtraHours: number;
  totalHoursWorked: number;
}

const dailyAttendanceService = {
  list: (filters?: { date?: string; month?: string; department?: string; employeeId?: string }) =>
    api.get<DailyRecord[]>("/daily-attendance", { params: filters }).then(r => Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? []),

  summary: (month: string, department?: string) =>
    api.get<DailySummary[]>("/daily-attendance/summary", { params: { month, department } }).then(r => Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? []),

  upsert: (payload: {
    employeeId: string;
    date: string;
    checkIn?: string;
    checkOut?: string;
    isAbsent?: boolean;
    note?: string;
  }) =>
    api.post<DailyRecord>("/daily-attendance", payload).then(r => (r.data as any)?.data ?? r.data),

  delete: (id: string) =>
    api.delete(`/daily-attendance/${id}`).then(r => r.data),
};

export default dailyAttendanceService;