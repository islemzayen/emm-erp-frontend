"use client";


import ProtectedRoute from "@/components/ProtectedRoute";

export default function EmployeeDashboard() {
  return (
    <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
      
        <h1 className="text-2xl font-bold">Employee Dashboard</h1>
        <p>Limited access view.</p>
      
    </ProtectedRoute>
  );
}
