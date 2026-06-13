// src/lib/payrollCalc.ts
// Tunisian payroll — "agreed salary" model.
// The stored salary is the AGREED take-home. The 9.67% employee CNSS is neutralised
// by grossing the salary up, so the agreed amount is untouched by CNSS:
//   brut = agreedSalary / (1 - 9.67%)   →   brut - 9.67%·brut = agreedSalary
// The 29.67% total CNSS (9.67% employee + 20% employer) is computed for DISPLAY ONLY.
// Only IRPP, CSS, Absence and Avances actually reduce the take-home.

export const PAYROLL_CONSTANTS = {
  monthlyHours:          208,     // 26 working days × 8h (hourly rate = agreedSalary / 208)
  cnssEmployeeRate:      0.0967,  // 9.67% — employee CNSS (neutralised via gross-up)
  cnssEmployerRate:      0.2000,  // 20.00% — employer CNSS (informational)
  cssRate:               0.005,   // Contribution Sociale de Solidarité — 0.5% of taxable
  headOfFamilyDeduction: 300,     // annual chef-de-famille abatement (DT)
  perChildDeduction:     100,     // annual per-child abatement (DT)
  maxChildren:           4,
  // IRPP barème (Loi de finances 2025) — ANNUAL brackets, progressive
  irppBrackets: [
    { upTo: 5000,     rate: 0.00 },
    { upTo: 10000,    rate: 0.15 },
    { upTo: 20000,    rate: 0.25 },
    { upTo: 30000,    rate: 0.30 },
    { upTo: 40000,    rate: 0.33 },
    { upTo: 50000,    rate: 0.36 },
    { upTo: 70000,    rate: 0.38 },
    { upTo: Infinity, rate: 0.40 },
  ],
};

export interface PayrollInput {
  salary?: number;               // agreed monthly take-home (preferred)
  hourlyRate: number;            // used for absence / overtime (= salary / 208)
  monthlyHours?: number;
  familyStatus?: string;         // "C" | "M" | "D" | "V"
  numChildren?: number;
  avancesTotal?: number;         // advances — deducted from net
  absenceHours?: number;         // absent hours — deducted from net
  overtimeHours?: number;        // extra hours — added to net
}

export interface PayrollResult {
  hours: number;
  hourlyRate: number;
  agreedSalary: number;   // the agreed take-home (untouched by CNSS)
  base: number;           // alias of agreedSalary (for table display)
  brut: number;           // grossed-up salary = agreedSalary / (1 - cnssEmployeeRate)
  cnssEmployee: number;   // 9.67% — neutralised (brut - agreedSalary)
  cnssTotal: number;      // 29.67% — DISPLAY ONLY, never deducted
  imposable: number;      // taxable = agreedSalary
  irpp: number;
  css: number;
  net: number;            // salaire net = imposable - irpp - css
  overtimeHours: number;
  overtimePay: number;
  absenceHours: number;
  absenceDeduction: number;
  avances: number;
  netToPay: number;       // net + overtime - absence - avances
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Annual IRPP from annual taxable income using the progressive bracket table.
function computeAnnualIRPP(annualTaxable: number): number {
  let tax = 0;
  let lower = 0;
  for (const b of PAYROLL_CONSTANTS.irppBrackets) {
    if (annualTaxable <= lower) break;
    const slice = Math.min(annualTaxable, b.upTo) - lower;
    tax += slice * b.rate;
    lower = b.upTo;
  }
  return tax;
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

  // CNSS gross-up — the agreed salary is preserved after the 9.67% deduction
  const brut         = round3(agreedSalary / (1 - C.cnssEmployeeRate));
  const cnssEmployee = round3(brut - agreedSalary);                              // = brut × 9.67%
  const cnssTotal    = round3(brut * (C.cnssEmployeeRate + C.cnssEmployerRate)); // 29.67% — info only

  const imposable = agreedSalary;   // = brut − cnssEmployee

  // IRPP — annualise the taxable salary, subtract family abatements, apply barème, back to monthly
  let annualTaxable = imposable * 12;
  const headOfFamily = input.familyStatus === "M" || (input.numChildren || 0) > 0;
  if (headOfFamily) annualTaxable -= C.headOfFamilyDeduction;
  annualTaxable -= Math.min(input.numChildren || 0, C.maxChildren) * C.perChildDeduction;
  annualTaxable = Math.max(0, annualTaxable);
  const irpp = round3(computeAnnualIRPP(annualTaxable) / 12);

  const css = round3(imposable * C.cssRate);

  const net      = round3(imposable - irpp - css);
  const netToPay = round3(net + overtimePay - absenceDeduction - avances);

  return {
    hours, hourlyRate, agreedSalary, base: agreedSalary, brut, cnssEmployee, cnssTotal,
    imposable, irpp, css, net, overtimeHours, overtimePay, absenceHours, absenceDeduction,
    avances, netToPay,
  };
}

// Hourly rate from the agreed monthly salary: salaire / (26 × 8) = salary / 208.
export function deriveHourlyRate(monthlySalary: number, monthlyHours = PAYROLL_CONSTANTS.monthlyHours): number {
  if (!monthlySalary) return 0;
  return round3(monthlySalary / monthlyHours);
}