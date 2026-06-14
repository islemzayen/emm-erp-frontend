// src/lib/payrollCalc.ts
// Tunisian payroll — "earned salary" model.
// The stored salary is the AGREED monthly rate. Hourly rate = salary / 208.
// Earned salary = hourly × actual hours worked (pro-rated for absences and join date).
// CNSS is computed from the earned salary via gross-up: brut = earned / (1 - 9.67%).
// IRPP and CSS are NOT applied (always 0).
// Net = earned − avances.

export const PAYROLL_CONSTANTS = {
  monthlyHours:          208,     // 26 working days × 8h (hourly rate = salary / 208)
  workingDaysPerMonth:   26,      // Mon–Sat; Sunday is the default weekend
  hoursPerDay:           8,
  cnssEmployeeRate:      0.0967,  // 9.67% — employee CNSS (grossed up from earned)
  cnssEmployerRate:      0.2000,  // 20.00% — employer CNSS (informational)
};

export interface PayrollInput {
  salary?: number;               // agreed monthly salary (base rate)
  hourlyRate: number;            // = salary / 208
  monthlyHours?: number;
  familyStatus?: string;         // kept for display — not used in tax calc
  numChildren?: number;          // kept for display — not used in tax calc
  avancesTotal?: number;         // advances — deducted from net
  absenceHours?: number;         // absent hours — deducted from earned
  overtimeHours?: number;        // extra hours — added to earned
}

export interface PayrollResult {
  hours: number;
  hourlyRate: number;
  agreedSalary: number;   // the agreed monthly rate
  base: number;           // alias of agreedSalary (for table display)
  earnedSalary: number;   // hourly × actual hours worked
  brut: number;           // grossed-up earned = earned / (1 - 9.67%)
  cnssEmployee: number;   // 9.67% of brut
  cnssTotal: number;      // 29.67% of brut — DISPLAY ONLY
  imposable: number;      // 0 — not calculated
  irpp: number;           // 0 — not applied
  css: number;            // 0 — not applied
  net: number;            // = earned salary
  overtimeHours: number;
  overtimePay: number;
  absenceHours: number;
  absenceDeduction: number;
  avances: number;
  netToPay: number;       // earned + overtime − absence − avances
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function computePayroll(input: PayrollInput): PayrollResult {
  const C = PAYROLL_CONSTANTS;
  const hours        = input.monthlyHours ?? C.monthlyHours;
  const hourlyRate   = input.hourlyRate || 0;
  const agreedSalary = round3(input.salary ?? hourlyRate * hours);
  const avances      = input.avancesTotal || 0;

  const absenceHours     = input.absenceHours || 0;
  const overtimeHours    = input.overtimeHours || 0;
  const absenceDeduction = round3(absenceHours * hourlyRate);
  const overtimePay      = round3(overtimeHours * hourlyRate);

  // Earned salary = hourly × actual hours (from attendance records)
  // When called with default 208h it equals the full agreed salary
  const earnedSalary = round3(hourlyRate * hours);

  // CNSS gross-up from the EARNED salary (not from agreed salary)
  const brut         = round3(earnedSalary / (1 - C.cnssEmployeeRate));
  const cnssEmployee = round3(brut - earnedSalary);                              // = brut × 9.67%
  const cnssTotal    = round3(brut * (C.cnssEmployeeRate + C.cnssEmployerRate)); // 29.67% — info only

  // IRPP and CSS are NOT applied — always 0
  const imposable = 0;
  const irpp      = 0;
  const css       = 0;

  // Net = earned salary (no IRPP/CSS deduction)
  const net      = earnedSalary;
  const netToPay = round3(net + overtimePay - absenceDeduction - avances);

  return {
    hours, hourlyRate, agreedSalary, base: agreedSalary,
    earnedSalary, brut, cnssEmployee, cnssTotal,
    imposable, irpp, css, net,
    overtimeHours, overtimePay, absenceHours, absenceDeduction,
    avances, netToPay,
  };
}

// Hourly rate from the agreed monthly salary: salary / (26 × 8) = salary / 208.
export function deriveHourlyRate(monthlySalary: number, monthlyHours = PAYROLL_CONSTANTS.monthlyHours): number {
  if (!monthlySalary) return 0;
  return round3(monthlySalary / monthlyHours);
}

// Check if a date string (YYYY-MM-DD) falls on a Sunday (default weekend).
// Used by attendance pages to exclude Sundays from absent-day counts.
export function isSunday(dateStr: string): boolean {
  const d = new Date(dateStr);
  return d.getDay() === 0;
}