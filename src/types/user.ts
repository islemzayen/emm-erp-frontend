export type Role =
  | "ADMIN"
  | "HR_MANAGER"
  | "MARKETING_MANAGER"
  | "SALES_MANAGER"
  | "EMPLOYEE"
  | "COMMERCIAL_MANAGER"
  | "FINANCE_MANAGER"
  | "STOCK_MANAGER"
  | "PURCHASE_MANAGER"
  | "DEPOT_MANAGER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  token: string;
  department?: string;
}