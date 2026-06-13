import api from "./api";

export interface AttendanceRecord {
  _id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  type: "Annual Leave" | "Sick Leave" | "Remote Work" | "Unpaid Leave" | "Unauthorized";
  hours: string;
  status: "Approved" | "Pending" | "Rejected";
  approvedBy: string;
  note: string;
  createdAt: string;
}

// response.js sends raw data (not wrapped in { data }), so we unwrap Array or .data array
const unwrap = (r: any): AttendanceRecord[] =>
  Array.isArray(r.data) ? r.data : (r.data?.data ?? []);

const attendanceService = {
  list: (filters?: { status?: string; department?: string; type?: string; employeeId?: string }) =>
    api.get("/attendance", { params: filters }).then(unwrap),

  create: (payload: { employeeId: string; date: string; type: string; hours?: string; note?: string }) =>
    api.post("/attendance", payload).then((r: any) => r.data?.data ?? r.data),

  updateStatus: (id: string, status: "Approved" | "Rejected" | "Pending") =>
    api.patch(`/attendance/${id}`, { status }).then((r: any) => r.data?.data ?? r.data),

  approveAll: () =>
    api.post("/attendance/approve-all").then((r: any) => r.data),

  delete: (id: string) =>
    api.delete(`/attendance/${id}`).then((r: any) => r.data),
};

export default attendanceService;