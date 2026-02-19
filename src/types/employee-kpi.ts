// ─── Custom Employee KPI Definitions ───

export interface CustomKPIDefinition {
  id: string;
  name: string;
  description: string;
  formula: string; // e.g. "conversionRate * avgScore / 100"
  unit: string; // e.g. "%", "pts", "min", ""
  higher_is_better: boolean;
  created_at: string;
  updated_at: string;
}

// Available variables in formulas (from EmployeeStats)
export const KPI_VARIABLES: { key: string; label: string; description: string }[] = [
  { key: "avgScore", label: "Puntaje Promedio", description: "Puntaje ECS promedio de los leads del empleado" },
  { key: "responseTime", label: "Tiempo de Respuesta (seg)", description: "Tiempo promedio de primera respuesta en segundos" },
  { key: "conversionRate", label: "Tasa de Conversión (%)", description: "Porcentaje de leads ganados" },
  { key: "activeLeads", label: "Leads Activos", description: "Cantidad de leads asignados activos" },
  { key: "totalInteractions", label: "Total Interacciones", description: "Cantidad total de interacciones" },
];

// Built-in KPIs that are always available
export const BUILTIN_KPIS: CustomKPIDefinition[] = [
  {
    id: "builtin-efficiency",
    name: "Índice de Eficiencia",
    description: "Relación entre conversiones y tiempo de respuesta",
    formula: "conversionRate * 100 / (responseTime / 60 + 1)",
    unit: "pts",
    higher_is_better: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-engagement",
    name: "Índice de Engagement",
    description: "Interacciones por lead activo",
    formula: "activeLeads > 0 ? totalInteractions / activeLeads : 0",
    unit: "",
    higher_is_better: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-productivity",
    name: "Productividad",
    description: "Score promedio ponderado por volumen de leads",
    formula: "avgScore * Math.min(activeLeads / 10, 1)",
    unit: "pts",
    higher_is_better: true,
    created_at: "",
    updated_at: "",
  },
];

// Snapshot of employee KPI values at a point in time
export interface EmployeeKPISnapshot {
  id: string;
  employee_name: string;
  kpi_id: string;
  kpi_name: string;
  value: number;
  snapshot_date: string;
  created_at: string;
}

// Evaluate a formula string against employee stats
export function evaluateKPIFormula(
  formula: string,
  vars: Record<string, number>
): number {
  try {
    const fn = new Function(
      ...Object.keys(vars),
      `"use strict"; return (${formula});`
    );
    const result = fn(...Object.values(vars));
    if (typeof result !== "number" || !isFinite(result)) return 0;
    return Math.round(result * 100) / 100;
  } catch {
    return 0;
  }
}
