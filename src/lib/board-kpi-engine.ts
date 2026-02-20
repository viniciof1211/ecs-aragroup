/**
 * Board KPI Engine — Computes the 8 mandatory KPIs defined by the Commercial Manager.
 *
 * Each KPI is segmented by UDN (Unidad de Negocio): "Euromobilia 1 a 1" and "Nouvell".
 * Thresholds use a 4-color system: azul (exceeds), verde (on target), amarillo (warning), rojo (critical).
 * Baselines are computed from the U3M (últimos 3 meses) rolling average.
 */

import type { ECSLead, ECSInteraction } from "@/types/ecs";
import { subMonths, isAfter, parseISO, startOfMonth, format } from "date-fns";

// ─── UDN (Unidad de Negocio) ───

export type UDN = "euromobilia" | "nouvell";

export const UDN_LABELS: Record<UDN, string> = {
  euromobilia: "Euromobilia 1 a 1",
  nouvell: "Nouvell",
};

export const UDN_BRANDS: Record<UDN, string[]> = {
  euromobilia: ["Euromobilia", "Euromobilia Studio"],
  nouvell: ["Nouvell"],
};

export function resolveUDN(lead: ECSLead): UDN | null {
  const brand = (lead.brand ?? lead.division ?? "").trim();
  if (!brand) return null;
  for (const [udn, brands] of Object.entries(UDN_BRANDS) as [UDN, string[]][]) {
    if (brands.some((b) => brand.toLowerCase() === b.toLowerCase())) return udn;
  }
  return null;
}

// ─── Color Thresholds ───

export type KPIColor = "azul" | "verde" | "amarillo" | "rojo";

export const KPI_COLOR_HEX: Record<KPIColor, string> = {
  azul: "#3B82F6",
  verde: "#22C55E",
  amarillo: "#EAB308",
  rojo: "#EF4444",
};

export const KPI_COLOR_BG: Record<KPIColor, string> = {
  azul: "bg-blue-500/15",
  verde: "bg-green-500/15",
  amarillo: "bg-yellow-500/15",
  rojo: "bg-red-500/15",
};

export const KPI_COLOR_TEXT: Record<KPIColor, string> = {
  azul: "text-blue-600 dark:text-blue-400",
  verde: "text-green-600 dark:text-green-400",
  amarillo: "text-yellow-600 dark:text-yellow-400",
  rojo: "text-red-600 dark:text-red-400",
};

export const KPI_COLOR_LABELS: Record<KPIColor, string> = {
  azul: "Excelente",
  verde: "En meta",
  amarillo: "Alerta",
  rojo: "Crítico",
};

// ─── Mandatory KPI Definitions ───

export type MandatoryKPIId =
  | "lead_growth"
  | "response_time"
  | "appointment_growth"
  | "conversion_rate";

export interface MandatoryKPIDefinition {
  id: MandatoryKPIId;
  name: string;
  department: string;
  responsible: string;
  methodology: string;
  unit: string;
  higher_is_better: boolean;
  // Thresholds per UDN — the % change or absolute value for each color
  thresholds: Record<UDN, {
    azul: { min: number };
    verde: { min: number; max: number };
    amarillo: { min: number; max: number };
    rojo: { max: number };
  }>;
}

export const MANDATORY_KPIS: MandatoryKPIDefinition[] = [
  {
    id: "lead_growth",
    name: "Incremento en Leads Generados",
    department: "Mercadeo",
    responsible: "Ariana",
    methodology: "Sobre el promedio de leads generados en los U3M, debe incrementar la cantidad de leads.",
    unit: "%",
    higher_is_better: true,
    thresholds: {
      euromobilia: {
        azul: { min: 30 },
        verde: { min: 20, max: 30 },
        amarillo: { min: 10, max: 20 },
        rojo: { max: 10 },
      },
      nouvell: {
        azul: { min: 20 },
        verde: { min: 15, max: 20 },
        amarillo: { min: 10, max: 15 },
        rojo: { max: 10 },
      },
    },
  },
  {
    id: "response_time",
    name: "Tiempo de Respuesta",
    department: "Contact Center / Ventas",
    responsible: "Ejecutiva de primer contacto (Pronto Agent IA)",
    methodology: "Desde el contacto del cliente al botón de WhatsApp hasta el primer contacto con el ejecutivo no debe haber transcurrido más de 5 minutos.",
    unit: "min",
    higher_is_better: false,
    thresholds: {
      euromobilia: {
        azul: { min: 0 },    // ≤5 min
        verde: { min: 5, max: 7 },
        amarillo: { min: 7, max: 10 },
        rojo: { max: 999 },  // >10 min
      },
      nouvell: {
        azul: { min: 0 },    // ≤4 min
        verde: { min: 4, max: 5 },
        amarillo: { min: 5, max: 7.5 },
        rojo: { max: 999 },  // >7.5 min
      },
    },
  },
  {
    id: "appointment_growth",
    name: "Incremento en Citas Generadas",
    department: "Contact Center / Ventas",
    responsible: "Ejecutiva de primer contacto (Pronto Agent IA)",
    methodology: "Sobre el promedio de citas generadas en los U3M, debe incrementarlo.",
    unit: "%",
    higher_is_better: true,
    thresholds: {
      euromobilia: {
        azul: { min: 50 },
        verde: { min: 40, max: 50 },
        amarillo: { min: 30, max: 40 },
        rojo: { max: 30 },
      },
      nouvell: {
        azul: { min: 40 },
        verde: { min: 30, max: 40 },
        amarillo: { min: 20, max: 30 },
        rojo: { max: 20 },   // Note: Excel says -30% rojo but context implies <20%
      },
    },
  },
  {
    id: "conversion_rate",
    name: "Conversión Citas → Contratos con Depósito",
    department: "Ejecutivo de Ventas",
    responsible: "Ejecutivo de ventas",
    methodology: "Sobre el promedio de conversión de los U3M se debe aumentar 20%.",
    unit: "%",
    higher_is_better: true,
    thresholds: {
      euromobilia: {
        azul: { min: 20 },
        verde: { min: 15, max: 20 },
        amarillo: { min: 10, max: 15 },
        rojo: { max: 10 },
      },
      nouvell: {
        azul: { min: 20 },
        verde: { min: 15, max: 20 },
        amarillo: { min: 10, max: 15 },
        rojo: { max: 10 },
      },
    },
  },
];

// ─── Monthly Snapshot Types ───

export interface MonthlyUDNMetrics {
  month: string; // "YYYY-MM"
  udn: UDN;
  leadsGenerated: number;
  appointmentsGenerated: number;
  contractsWithDeposit: number;
  avgResponseTimeMinutes: number;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
}

export interface BoardKPIResult {
  kpiId: MandatoryKPIId;
  kpiName: string;
  udn: UDN;
  udnLabel: string;
  department: string;
  responsible: string;
  currentValue: number;
  baselineU3M: number;
  changePercent: number;
  color: KPIColor;
  unit: string;
  displayValue: string;
  targetDescription: string;
}

// ─── Computation Functions ───

/**
 * Classify leads and interactions into monthly UDN metrics.
 */
export function computeMonthlyUDNMetrics(
  leads: ECSLead[],
  interactions: ECSInteraction[],
  monthsBack = 6,
): MonthlyUDNMetrics[] {
  const now = new Date();
  const cutoff = subMonths(startOfMonth(now), monthsBack);
  const results: MonthlyUDNMetrics[] = [];

  // Build lead lookup by id for UDN resolution
  const leadMap = new Map<string, ECSLead>();
  for (const l of leads) leadMap.set(l.id, l);

  // Group leads by UDN
  const udns: UDN[] = ["euromobilia", "nouvell"];

  for (const udn of udns) {
    const udnLeads = leads.filter((l) => resolveUDN(l) === udn);
    const udnLeadIds = new Set(udnLeads.map((l) => l.id));
    const udnInteractions = interactions.filter((i) => udnLeadIds.has(i.lead_id));

    // Generate monthly buckets
    for (let m = 0; m < monthsBack; m++) {
      const monthStart = subMonths(startOfMonth(now), m);
      if (!isAfter(monthStart, cutoff) && m > 0) continue;
      const monthStr = format(monthStart, "yyyy-MM");
      const monthEnd = m === 0 ? now : subMonths(startOfMonth(now), m - 1);

      // Leads generated this month (by created_at)
      const leadsThisMonth = udnLeads.filter((l) => {
        const d = parseISO(l.created_at);
        return isAfter(d, monthStart) && !isAfter(d, monthEnd);
      });

      // Appointments: showroom_visit + meeting interactions this month
      const appointmentsThisMonth = udnInteractions.filter((i) => {
        if (i.type !== "showroom_visit" && i.type !== "meeting") return false;
        const d = parseISO(i.timestamp);
        return isAfter(d, monthStart) && !isAfter(d, monthEnd);
      });

      // Contracts with deposit: deal_won interactions this month where lead has total_amount > 0
      const contractsThisMonth = udnInteractions.filter((i) => {
        if (i.type !== "deal_won") return false;
        const d = parseISO(i.timestamp);
        if (!isAfter(d, monthStart) || isAfter(d, monthEnd)) return false;
        const lead = leadMap.get(i.lead_id);
        return lead && (lead.total_amount ?? 0) > 0;
      });

      // Average response time (first_response_seconds) for inbound interactions this month
      const responseTimes: number[] = [];
      for (const i of udnInteractions) {
        if (!i.first_response_seconds || i.first_response_seconds <= 0) continue;
        const d = parseISO(i.timestamp);
        if (!isAfter(d, monthStart) || isAfter(d, monthEnd)) continue;
        responseTimes.push(i.first_response_seconds);
      }

      // Also compute from inbound→outbound pairs for leads without first_response_seconds
      const monthInts = udnInteractions
        .filter((i) => {
          const d = parseISO(i.timestamp);
          return isAfter(d, monthStart) && !isAfter(d, monthEnd);
        })
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      const byLead = new Map<string, typeof monthInts>();
      for (const i of monthInts) {
        if (!byLead.has(i.lead_id)) byLead.set(i.lead_id, []);
        byLead.get(i.lead_id)!.push(i);
      }
      for (const [, ints] of byLead) {
        for (let j = 0; j < ints.length; j++) {
          if (ints[j].direction !== "entrante") continue;
          for (let k = j + 1; k < ints.length; k++) {
            if (ints[k].direction === "saliente") {
              const diff = (new Date(ints[k].timestamp).getTime() - new Date(ints[j].timestamp).getTime()) / 1000;
              if (diff > 0 && diff < 86400) { // < 24h
                responseTimes.push(diff);
              }
              break;
            }
          }
        }
      }

      const avgRespSec = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

      // Won/lost this month
      const wonThisMonth = udnLeads.filter((l) => {
        if (l.status !== "won") return false;
        // Use last_interaction_at or updated_at as proxy for win date
        const d = parseISO(l.last_interaction_at ?? l.updated_at);
        return isAfter(d, monthStart) && !isAfter(d, monthEnd);
      });

      const lostThisMonth = udnLeads.filter((l) => {
        if (l.status !== "lost") return false;
        const d = parseISO(l.last_interaction_at ?? l.updated_at);
        return isAfter(d, monthStart) && !isAfter(d, monthEnd);
      });

      results.push({
        month: monthStr,
        udn,
        leadsGenerated: leadsThisMonth.length,
        appointmentsGenerated: appointmentsThisMonth.length,
        contractsWithDeposit: contractsThisMonth.length,
        avgResponseTimeMinutes: avgRespSec > 0 ? Math.round(avgRespSec / 60 * 100) / 100 : 0,
        totalLeads: udnLeads.filter((l) => {
          const d = parseISO(l.created_at);
          return isAfter(d, monthStart) && !isAfter(d, monthEnd);
        }).length,
        wonLeads: wonThisMonth.length,
        lostLeads: lostThisMonth.length,
      });
    }
  }

  return results.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Compute the U3M (últimos 3 meses) baseline average for a given metric.
 */
function computeU3MBaseline(
  monthlyMetrics: MonthlyUDNMetrics[],
  udn: UDN,
  metricKey: keyof MonthlyUDNMetrics,
): number {
  const now = new Date();
  const currentMonth = format(startOfMonth(now), "yyyy-MM");

  // Get the 3 months before the current month
  const u3mMonths: string[] = [];
  for (let i = 1; i <= 3; i++) {
    u3mMonths.push(format(subMonths(startOfMonth(now), i), "yyyy-MM"));
  }

  const u3mData = monthlyMetrics.filter(
    (m) => m.udn === udn && u3mMonths.includes(m.month)
  );

  if (u3mData.length === 0) {
    // Fallback: use all available months except current
    const fallback = monthlyMetrics.filter(
      (m) => m.udn === udn && m.month !== currentMonth
    );
    if (fallback.length === 0) return 0;
    return fallback.reduce((sum, m) => sum + (m[metricKey] as number), 0) / fallback.length;
  }

  return u3mData.reduce((sum, m) => sum + (m[metricKey] as number), 0) / u3mData.length;
}

/**
 * Determine the color for a response-time KPI (lower is better, absolute thresholds).
 */
function getResponseTimeColor(
  value: number,
  udn: UDN,
): KPIColor {
  if (udn === "euromobilia") {
    if (value <= 5) return "azul";
    if (value <= 7) return "verde";
    if (value <= 10) return "amarillo";
    return "rojo";
  }
  // nouvell
  if (value <= 4) return "azul";
  if (value <= 5) return "verde";
  if (value <= 7.5) return "amarillo";
  return "rojo";
}

/**
 * Determine the color for a growth KPI (higher % change is better).
 */
function getGrowthColor(
  changePercent: number,
  thresholds: MandatoryKPIDefinition["thresholds"][UDN],
): KPIColor {
  if (changePercent >= thresholds.azul.min) return "azul";
  if (changePercent >= thresholds.verde.min) return "verde";
  if (changePercent >= thresholds.amarillo.min) return "amarillo";
  return "rojo";
}

/**
 * Compute all 8 mandatory Board KPI results (4 per UDN × 2 UDNs).
 */
export function computeBoardKPIs(
  leads: ECSLead[],
  interactions: ECSInteraction[],
): { results: BoardKPIResult[]; monthlyMetrics: MonthlyUDNMetrics[] } {
  const monthlyMetrics = computeMonthlyUDNMetrics(leads, interactions, 6);
  const now = new Date();
  const currentMonth = format(startOfMonth(now), "yyyy-MM");
  const results: BoardKPIResult[] = [];

  const udns: UDN[] = ["euromobilia", "nouvell"];

  for (const udn of udns) {
    const currentData = monthlyMetrics.find((m) => m.udn === udn && m.month === currentMonth);

    for (const kpiDef of MANDATORY_KPIS) {
      const thresholds = kpiDef.thresholds[udn];
      let currentValue = 0;
      let baselineU3M = 0;
      let changePercent = 0;
      let color: KPIColor = "rojo";
      let displayValue = "";
      let targetDescription = "";

      switch (kpiDef.id) {
        case "lead_growth": {
          currentValue = currentData?.leadsGenerated ?? 0;
          baselineU3M = computeU3MBaseline(monthlyMetrics, udn, "leadsGenerated");
          changePercent = baselineU3M > 0 ? ((currentValue - baselineU3M) / baselineU3M) * 100 : 0;
          color = getGrowthColor(changePercent, thresholds);
          displayValue = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`;
          targetDescription = `Meta: +${thresholds.azul.min}% vs U3M (${Math.round(baselineU3M)} leads/mes)`;
          break;
        }
        case "response_time": {
          currentValue = currentData?.avgResponseTimeMinutes ?? 0;
          baselineU3M = computeU3MBaseline(monthlyMetrics, udn, "avgResponseTimeMinutes");
          color = getResponseTimeColor(currentValue, udn);
          changePercent = baselineU3M > 0 ? ((currentValue - baselineU3M) / baselineU3M) * 100 : 0;
          displayValue = `${currentValue.toFixed(1)} min`;
          const maxBlue = udn === "euromobilia" ? 5 : 4;
          targetDescription = `Meta: ≤${maxBlue} min (U3M: ${baselineU3M.toFixed(1)} min)`;
          break;
        }
        case "appointment_growth": {
          currentValue = currentData?.appointmentsGenerated ?? 0;
          baselineU3M = computeU3MBaseline(monthlyMetrics, udn, "appointmentsGenerated");
          changePercent = baselineU3M > 0 ? ((currentValue - baselineU3M) / baselineU3M) * 100 : 0;
          color = getGrowthColor(changePercent, thresholds);
          displayValue = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`;
          targetDescription = `Meta: +${thresholds.azul.min}% vs U3M (${Math.round(baselineU3M)} citas/mes)`;
          break;
        }
        case "conversion_rate": {
          // Conversion = contracts with deposit / appointments
          const appointments = currentData?.appointmentsGenerated ?? 0;
          const contracts = currentData?.contractsWithDeposit ?? 0;
          currentValue = appointments > 0 ? (contracts / appointments) * 100 : 0;
          // Baseline conversion rate
          const baseAppointments = computeU3MBaseline(monthlyMetrics, udn, "appointmentsGenerated");
          const baseContracts = computeU3MBaseline(monthlyMetrics, udn, "contractsWithDeposit");
          baselineU3M = baseAppointments > 0 ? (baseContracts / baseAppointments) * 100 : 0;
          changePercent = baselineU3M > 0 ? ((currentValue - baselineU3M) / baselineU3M) * 100 : 0;
          color = getGrowthColor(changePercent, thresholds);
          displayValue = `${currentValue.toFixed(1)}%`;
          targetDescription = `Meta: +${thresholds.azul.min}% vs U3M (${baselineU3M.toFixed(1)}% base)`;
          break;
        }
      }

      results.push({
        kpiId: kpiDef.id,
        kpiName: kpiDef.name,
        udn,
        udnLabel: UDN_LABELS[udn],
        department: kpiDef.department,
        responsible: kpiDef.responsible,
        currentValue,
        baselineU3M,
        changePercent,
        color,
        unit: kpiDef.unit,
        displayValue,
        targetDescription,
      });
    }
  }

  return { results, monthlyMetrics };
}

// ─── Per-Employee Mandatory KPI Semaphore ───

export interface EmployeeMandatoryKPI {
  kpiId: MandatoryKPIId;
  kpiName: string;
  value: number;
  displayValue: string;
  color: KPIColor;
  description: string;
}

/**
 * Compute the 4 mandatory KPIs scoped to a specific employee's leads and interactions.
 * Uses simplified thresholds (average of both UDN thresholds) since employee may span UDNs.
 */
export function computeEmployeeMandatoryKPIs(
  employeeName: string,
  allLeads: ECSLead[],
  allInteractions: ECSInteraction[],
): EmployeeMandatoryKPI[] {
  const empLeads = allLeads.filter((l) => l.employees?.includes(employeeName));
  const empLeadIds = new Set(empLeads.map((l) => l.id));
  const empInteractions = allInteractions.filter((i) => empLeadIds.has(i.lead_id) || i.employee === employeeName);

  const now = new Date();
  const currentMonth = format(startOfMonth(now), "yyyy-MM");

  // ── 1. Leads generated this month ──
  const leadsThisMonth = empLeads.filter((l) => {
    try { return format(startOfMonth(parseISO(l.created_at)), "yyyy-MM") === currentMonth; } catch { return false; }
  }).length;

  // Leads in previous 3 months (U3M baseline)
  const u3mMonths: string[] = [];
  for (let i = 1; i <= 3; i++) u3mMonths.push(format(subMonths(startOfMonth(now), i), "yyyy-MM"));
  const leadsU3M = empLeads.filter((l) => {
    try { return u3mMonths.includes(format(startOfMonth(parseISO(l.created_at)), "yyyy-MM")); } catch { return false; }
  }).length;
  const avgLeadsU3M = leadsU3M / 3;
  const leadGrowthPct = avgLeadsU3M > 0 ? ((leadsThisMonth - avgLeadsU3M) / avgLeadsU3M) * 100 : 0;

  // ── 2. Response time (minutes) ──
  const responseTimes: number[] = [];
  for (const i of empInteractions) {
    if (i.first_response_seconds && i.first_response_seconds > 0 && i.first_response_seconds < 86400) {
      responseTimes.push(i.first_response_seconds);
    }
  }
  // Also compute from inbound→outbound pairs
  const byLead = new Map<string, typeof empInteractions>();
  for (const i of empInteractions) {
    if (!i.lead_id || !i.timestamp) continue;
    if (!byLead.has(i.lead_id)) byLead.set(i.lead_id, []);
    byLead.get(i.lead_id)!.push(i);
  }
  for (const [, ints] of byLead) {
    ints.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (let j = 0; j < ints.length; j++) {
      if (ints[j].direction !== "entrante") continue;
      for (let k = j + 1; k < ints.length; k++) {
        if (ints[k].direction === "saliente") {
          const diff = (new Date(ints[k].timestamp).getTime() - new Date(ints[j].timestamp).getTime()) / 1000;
          if (diff > 0 && diff < 86400) responseTimes.push(diff);
          break;
        }
      }
    }
  }
  const avgRespMin = responseTimes.length > 0
    ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) / 60
    : 0;

  // ── 3. Appointments generated this month ──
  const appointmentsThisMonth = empInteractions.filter((i) => {
    if (i.type !== "showroom_visit" && i.type !== "meeting") return false;
    try { return format(startOfMonth(parseISO(i.timestamp)), "yyyy-MM") === currentMonth; } catch { return false; }
  }).length;
  const appointmentsU3M = empInteractions.filter((i) => {
    if (i.type !== "showroom_visit" && i.type !== "meeting") return false;
    try { return u3mMonths.includes(format(startOfMonth(parseISO(i.timestamp)), "yyyy-MM")); } catch { return false; }
  }).length;
  const avgApptsU3M = appointmentsU3M / 3;
  const apptGrowthPct = avgApptsU3M > 0 ? ((appointmentsThisMonth - avgApptsU3M) / avgApptsU3M) * 100 : 0;

  // ── 4. Conversion: appointments → contracts with deposit ──
  const contractsThisMonth = empInteractions.filter((i) => {
    if (i.type !== "deal_won") return false;
    try { return format(startOfMonth(parseISO(i.timestamp)), "yyyy-MM") === currentMonth; } catch { return false; }
  }).length;
  const conversionPct = appointmentsThisMonth > 0 ? (contractsThisMonth / appointmentsThisMonth) * 100 : 0;
  const contractsU3M = empInteractions.filter((i) => {
    if (i.type !== "deal_won") return false;
    try { return u3mMonths.includes(format(startOfMonth(parseISO(i.timestamp)), "yyyy-MM")); } catch { return false; }
  }).length;
  const baseConvPct = avgApptsU3M > 0 ? ((contractsU3M / 3) / avgApptsU3M) * 100 : 0;
  const convGrowthPct = baseConvPct > 0 ? ((conversionPct - baseConvPct) / baseConvPct) * 100 : 0;

  // ── Color assignment (averaged thresholds across UDNs) ──
  function growthColor(pct: number, azulMin: number, verdeMin: number, amarilloMin: number): KPIColor {
    if (pct >= azulMin) return "azul";
    if (pct >= verdeMin) return "verde";
    if (pct >= amarilloMin) return "amarillo";
    return "rojo";
  }

  function respTimeColor(min: number): KPIColor {
    if (min <= 0) return "verde"; // no data
    if (min <= 4.5) return "azul";
    if (min <= 6) return "verde";
    if (min <= 8.75) return "amarillo";
    return "rojo";
  }

  return [
    {
      kpiId: "lead_growth",
      kpiName: "Incremento Leads",
      value: leadsThisMonth,
      displayValue: avgLeadsU3M > 0 ? `${leadGrowthPct >= 0 ? "+" : ""}${leadGrowthPct.toFixed(0)}%` : `${leadsThisMonth}`,
      color: growthColor(leadGrowthPct, 25, 17.5, 10),
      description: `${leadsThisMonth} leads este mes vs ${avgLeadsU3M.toFixed(0)} prom. U3M`,
    },
    {
      kpiId: "response_time",
      kpiName: "Tiempo Respuesta",
      value: avgRespMin,
      displayValue: avgRespMin > 0 ? `${avgRespMin.toFixed(1)} min` : "—",
      color: respTimeColor(avgRespMin),
      description: avgRespMin > 0 ? `Promedio ${avgRespMin.toFixed(1)} min (meta ≤5 min)` : "Sin datos de respuesta",
    },
    {
      kpiId: "appointment_growth",
      kpiName: "Incremento Citas",
      value: appointmentsThisMonth,
      displayValue: avgApptsU3M > 0 ? `${apptGrowthPct >= 0 ? "+" : ""}${apptGrowthPct.toFixed(0)}%` : `${appointmentsThisMonth}`,
      color: growthColor(apptGrowthPct, 45, 35, 25),
      description: `${appointmentsThisMonth} citas este mes vs ${avgApptsU3M.toFixed(0)} prom. U3M`,
    },
    {
      kpiId: "conversion_rate",
      kpiName: "Conversión Citas→Contratos",
      value: conversionPct,
      displayValue: `${conversionPct.toFixed(1)}%`,
      color: growthColor(convGrowthPct, 20, 15, 10),
      description: `${contractsThisMonth} contratos / ${appointmentsThisMonth} citas (${conversionPct.toFixed(1)}%)`,
    },
  ];
}

// ─── Persistence for monthly snapshots ───

const BOARD_SNAPSHOTS_KEY = "ecs-board-kpi-snapshots";

export interface BoardKPISnapshot {
  id: string;
  month: string;
  udn: UDN;
  kpiId: MandatoryKPIId;
  value: number;
  baselineU3M: number;
  changePercent: number;
  color: KPIColor;
  savedAt: string;
}

export function loadBoardSnapshots(): BoardKPISnapshot[] {
  try {
    const raw = localStorage.getItem(BOARD_SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBoardSnapshots(snapshots: BoardKPISnapshot[]): void {
  localStorage.setItem(BOARD_SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

export function saveBoardKPIResults(results: BoardKPIResult[]): void {
  const existing = loadBoardSnapshots();
  const now = new Date().toISOString();
  const currentMonth = format(startOfMonth(new Date()), "yyyy-MM");

  const newSnapshots: BoardKPISnapshot[] = results.map((r) => ({
    id: `bkpi-${r.udn}-${r.kpiId}-${currentMonth}`,
    month: currentMonth,
    udn: r.udn,
    kpiId: r.kpiId,
    value: r.currentValue,
    baselineU3M: r.baselineU3M,
    changePercent: r.changePercent,
    color: r.color,
    savedAt: now,
  }));

  // Merge: replace existing snapshots for same month+udn+kpi, keep historical
  const merged = [...existing];
  for (const snap of newSnapshots) {
    const idx = merged.findIndex(
      (s) => s.month === snap.month && s.udn === snap.udn && s.kpiId === snap.kpiId
    );
    if (idx >= 0) {
      merged[idx] = snap;
    } else {
      merged.push(snap);
    }
  }

  saveBoardSnapshots(merged);
}
