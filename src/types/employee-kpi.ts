// ─── KPI Definitions (Employee + Business) ───

export type KPICategory =
  | "employee"
  | "commercial"
  | "marketing"
  | "operations"
  | "financial"
  | "board";

export interface CustomKPIDefinition {
  id: string;
  name: string;
  description: string;
  formula: string;
  unit: string;
  higher_is_better: boolean;
  category: KPICategory;
  created_at: string;
  updated_at: string;
}

// ─── Variable Catalog ───

export interface KPIVariable {
  key: string;
  label: string;
  description: string;
  category: KPICategory;
  source: "employee" | "business" | "marketing" | "calculated";
}

export const KPI_VARIABLES: KPIVariable[] = [
  // Employee-level
  { key: "avgScore", label: "Puntaje Promedio", description: "Puntaje ECS promedio de los leads del empleado", category: "employee", source: "employee" },
  { key: "responseTime", label: "Tiempo de Respuesta (seg)", description: "Tiempo promedio de primera respuesta en segundos", category: "employee", source: "employee" },
  { key: "conversionRate", label: "Tasa de Conversión (%)", description: "Porcentaje de leads ganados", category: "employee", source: "employee" },
  { key: "activeLeads", label: "Leads Activos", description: "Cantidad de leads asignados activos", category: "employee", source: "employee" },
  { key: "totalInteractions", label: "Total Interacciones", description: "Cantidad total de interacciones", category: "employee", source: "employee" },
  // Business-level
  { key: "totalLeads", label: "Total Leads", description: "Cantidad total de leads en el sistema", category: "commercial", source: "business" },
  { key: "newLeads", label: "Leads Nuevos", description: "Leads en estado 'new'", category: "commercial", source: "business" },
  { key: "wonLeads", label: "Leads Ganados", description: "Leads en estado 'won'", category: "commercial", source: "business" },
  { key: "lostLeads", label: "Leads Perdidos", description: "Leads en estado 'lost'", category: "commercial", source: "business" },
  { key: "qualifiedLeads", label: "Leads Calificados", description: "Leads en estado 'qualified'", category: "commercial", source: "business" },
  { key: "proposalLeads", label: "Leads en Propuesta", description: "Leads en estado 'proposal'", category: "commercial", source: "business" },
  { key: "negotiationLeads", label: "Leads en Negociación", description: "Leads en estado 'negotiation'", category: "commercial", source: "business" },
  { key: "contactedLeads", label: "Leads Contactados", description: "Leads en estado 'contacted'", category: "commercial", source: "business" },
  { key: "avgECSScore", label: "ECS Score Promedio", description: "Puntaje ECS promedio global", category: "commercial", source: "business" },
  { key: "hotLeads", label: "Leads Hot", description: "Leads segmento 'hot'", category: "commercial", source: "business" },
  { key: "warmLeads", label: "Leads Warm", description: "Leads segmento 'warm'", category: "commercial", source: "business" },
  { key: "coldLeads", label: "Leads Cold", description: "Leads segmento 'cold'", category: "commercial", source: "business" },
  { key: "dormantLeads", label: "Leads Dormant", description: "Leads segmento 'dormant'", category: "commercial", source: "business" },
  { key: "totalRevenue", label: "Ingreso Total ($)", description: "Suma de total_amount de leads ganados", category: "financial", source: "business" },
  { key: "avgDealSize", label: "Ticket Promedio ($)", description: "Ingreso promedio por deal ganado", category: "financial", source: "business" },
  { key: "pipelineValue", label: "Valor Pipeline ($)", description: "Suma de total_amount de leads en propuesta+negociación", category: "financial", source: "business" },
  { key: "totalInteractionsGlobal", label: "Interacciones Totales", description: "Cantidad total de interacciones en el sistema", category: "operations", source: "business" },
  { key: "avgResponseTimeGlobal", label: "Tiempo Resp. Global (seg)", description: "Tiempo promedio de respuesta global", category: "operations", source: "business" },
  { key: "channelCount", label: "Canales Activos", description: "Cantidad de canales de comunicación usados", category: "operations", source: "business" },
  { key: "employeeCount", label: "Empleados Activos", description: "Cantidad de empleados con leads asignados", category: "operations", source: "business" },
  // Marketing / Meta Ads
  { key: "adSpend", label: "Inversión Publicitaria ($)", description: "Total invertido en pauta Meta Ads", category: "marketing", source: "marketing" },
  { key: "costPerLead", label: "Costo por Lead ($)", description: "Inversión / Total Leads generados", category: "marketing", source: "marketing" },
  { key: "costPerQualifiedLead", label: "Costo por Lead Calificado ($)", description: "Inversión / Leads calificados", category: "marketing", source: "marketing" },
  { key: "costPerConversion", label: "Costo por Conversión ($)", description: "Inversión / Leads ganados", category: "marketing", source: "marketing" },
  { key: "roas", label: "ROAS", description: "Return on Ad Spend = Ingreso / Inversión", category: "marketing", source: "marketing" },
  { key: "facebookLeads", label: "Leads Facebook", description: "Leads originados desde Facebook", category: "marketing", source: "business" },
  // Calculated / derived
  { key: "winRate", label: "Win Rate (%)", description: "wonLeads / (wonLeads + lostLeads) * 100", category: "commercial", source: "calculated" },
  { key: "pipelineVelocity", label: "Velocidad Pipeline", description: "Leads que avanzan de etapa por período", category: "commercial", source: "calculated" },
  { key: "leadToQualifiedRate", label: "Lead→Calificado (%)", description: "qualifiedLeads / totalLeads * 100", category: "commercial", source: "calculated" },
  { key: "qualifiedToWonRate", label: "Calificado→Ganado (%)", description: "wonLeads / qualifiedLeads * 100", category: "commercial", source: "calculated" },
];

// ─── Built-in KPIs ───

export const BUILTIN_KPIS: CustomKPIDefinition[] = [
  // Employee KPIs
  {
    id: "builtin-efficiency",
    name: "Índice de Eficiencia",
    description: "Relación entre conversiones y tiempo de respuesta",
    formula: "conversionRate * 100 / (responseTime / 60 + 1)",
    unit: "pts",
    higher_is_better: true,
    category: "employee",
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
    category: "employee",
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
    category: "employee",
    created_at: "",
    updated_at: "",
  },
  // Commercial KPIs
  {
    id: "builtin-win-rate",
    name: "Win Rate",
    description: "Porcentaje de leads ganados vs cerrados (ganados + perdidos)",
    formula: "(wonLeads + lostLeads) > 0 ? wonLeads / (wonLeads + lostLeads) * 100 : 0",
    unit: "%",
    higher_is_better: true,
    category: "commercial",
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-conversion-funnel",
    name: "Conversión del Embudo",
    description: "Porcentaje de leads nuevos que llegan a ganados",
    formula: "totalLeads > 0 ? wonLeads / totalLeads * 100 : 0",
    unit: "%",
    higher_is_better: true,
    category: "commercial",
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-pipeline-health",
    name: "Salud del Pipeline",
    description: "Ratio de leads activos (propuesta+negociación) vs total",
    formula: "totalLeads > 0 ? (proposalLeads + negotiationLeads) / totalLeads * 100 : 0",
    unit: "%",
    higher_is_better: true,
    category: "commercial",
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-lead-quality",
    name: "Calidad de Leads",
    description: "Porcentaje de leads que se califican del total",
    formula: "totalLeads > 0 ? (qualifiedLeads + proposalLeads + negotiationLeads + wonLeads) / totalLeads * 100 : 0",
    unit: "%",
    higher_is_better: true,
    category: "commercial",
    created_at: "",
    updated_at: "",
  },
  // Financial KPIs
  {
    id: "builtin-avg-deal",
    name: "Ticket Promedio",
    description: "Ingreso promedio por deal ganado",
    formula: "wonLeads > 0 ? totalRevenue / wonLeads : 0",
    unit: "$",
    higher_is_better: true,
    category: "financial",
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-pipeline-value",
    name: "Valor del Pipeline",
    description: "Valor total de oportunidades en propuesta y negociación",
    formula: "pipelineValue",
    unit: "$",
    higher_is_better: true,
    category: "financial",
    created_at: "",
    updated_at: "",
  },
  // Marketing KPIs
  {
    id: "builtin-cpl",
    name: "Costo por Lead",
    description: "Inversión publicitaria dividida entre leads generados",
    formula: "totalLeads > 0 ? adSpend / totalLeads : 0",
    unit: "$",
    higher_is_better: false,
    category: "marketing",
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-roas",
    name: "ROAS",
    description: "Return on Ad Spend — ingreso generado por cada dólar invertido",
    formula: "adSpend > 0 ? totalRevenue / adSpend : 0",
    unit: "x",
    higher_is_better: true,
    category: "marketing",
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-cost-per-conversion",
    name: "Costo por Conversión",
    description: "Inversión publicitaria dividida entre leads ganados",
    formula: "wonLeads > 0 ? adSpend / wonLeads : 0",
    unit: "$",
    higher_is_better: false,
    category: "marketing",
    created_at: "",
    updated_at: "",
  },
  // Operations KPIs
  {
    id: "builtin-response-sla",
    name: "SLA de Respuesta",
    description: "Porcentaje estimado de respuestas dentro de 15 min",
    formula: "avgResponseTimeGlobal > 0 ? Math.min(100, 900 / avgResponseTimeGlobal * 100) : 0",
    unit: "%",
    higher_is_better: true,
    category: "operations",
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-leads-per-employee",
    name: "Leads por Empleado",
    description: "Distribución promedio de leads por empleado activo",
    formula: "employeeCount > 0 ? totalLeads / employeeCount : 0",
    unit: "",
    higher_is_better: false,
    category: "operations",
    created_at: "",
    updated_at: "",
  },
  // Board-level KPIs
  {
    id: "builtin-commercial-index",
    name: "Índice Comercial Global",
    description: "Indicador compuesto: win rate × ECS score × pipeline health",
    formula: "((wonLeads + lostLeads) > 0 ? wonLeads / (wonLeads + lostLeads) : 0) * avgECSScore * (totalLeads > 0 ? (proposalLeads + negotiationLeads) / totalLeads : 0)",
    unit: "pts",
    higher_is_better: true,
    category: "board",
    created_at: "",
    updated_at: "",
  },
  {
    id: "builtin-growth-potential",
    name: "Potencial de Crecimiento",
    description: "Hot + Warm leads como % del total — indica oportunidades activas",
    formula: "totalLeads > 0 ? (hotLeads + warmLeads) / totalLeads * 100 : 0",
    unit: "%",
    higher_is_better: true,
    category: "board",
    created_at: "",
    updated_at: "",
  },
];

// ─── KPI Recommendation Engine ───

export interface KPIRecommendation {
  name: string;
  description: string;
  formula: string;
  unit: string;
  higher_is_better: boolean;
  category: KPICategory;
  rationale: string;
}

export const KPI_RECOMMENDATIONS: KPIRecommendation[] = [
  {
    name: "Velocidad de Cierre",
    description: "Días promedio desde primer contacto hasta cierre (estimado)",
    formula: "wonLeads > 0 ? totalInteractionsGlobal / wonLeads * 2.5 : 0",
    unit: "días",
    higher_is_better: false,
    category: "commercial",
    rationale: "Mide la eficiencia del ciclo de ventas. Menor tiempo = mejor rendimiento comercial.",
  },
  {
    name: "Tasa de Abandono",
    description: "Porcentaje de leads que se pierden o quedan dormidos",
    formula: "totalLeads > 0 ? (lostLeads + dormantLeads) / totalLeads * 100 : 0",
    unit: "%",
    higher_is_better: false,
    category: "commercial",
    rationale: "Identifica fugas en el embudo. Alta tasa indica problemas de seguimiento o calificación.",
  },
  {
    name: "ROI de Marketing",
    description: "Retorno neto sobre inversión publicitaria",
    formula: "adSpend > 0 ? (totalRevenue - adSpend) / adSpend * 100 : 0",
    unit: "%",
    higher_is_better: true,
    category: "marketing",
    rationale: "Mide la rentabilidad real de la inversión en pauta. Esencial para junta directiva.",
  },
  {
    name: "Eficiencia de Calificación",
    description: "Ratio de leads que pasan de contactado a calificado",
    formula: "contactedLeads > 0 ? qualifiedLeads / contactedLeads * 100 : 0",
    unit: "%",
    higher_is_better: true,
    category: "operations",
    rationale: "Mide qué tan bien el equipo identifica oportunidades reales de los leads contactados.",
  },
  {
    name: "Concentración de Ingresos",
    description: "Ingreso promedio por lead en pipeline activo",
    formula: "(proposalLeads + negotiationLeads) > 0 ? pipelineValue / (proposalLeads + negotiationLeads) : 0",
    unit: "$",
    higher_is_better: true,
    category: "financial",
    rationale: "Indica el valor promedio de cada oportunidad activa. Útil para proyecciones financieras.",
  },
  {
    name: "Índice de Actividad Comercial",
    description: "Interacciones por lead — mide intensidad del seguimiento",
    formula: "totalLeads > 0 ? totalInteractionsGlobal / totalLeads : 0",
    unit: "",
    higher_is_better: true,
    category: "operations",
    rationale: "Equipos con mayor actividad por lead tienden a convertir más. Benchmark interno.",
  },
  {
    name: "Cobertura de Canales",
    description: "Diversificación de canales de comunicación",
    formula: "channelCount",
    unit: "canales",
    higher_is_better: true,
    category: "operations",
    rationale: "Más canales = más puntos de contacto con el cliente. Mejora la experiencia omnicanal.",
  },
  {
    name: "Costo por Lead Calificado",
    description: "Inversión necesaria para obtener un lead calificado",
    formula: "qualifiedLeads > 0 ? adSpend / qualifiedLeads : 0",
    unit: "$",
    higher_is_better: false,
    category: "marketing",
    rationale: "Más preciso que CPL genérico. Mide eficiencia real de la pauta para generar oportunidades.",
  },
  {
    name: "Score de Salud del Negocio",
    description: "Indicador compuesto para junta directiva (0-100)",
    formula: "Math.min(100, ((wonLeads + lostLeads) > 0 ? wonLeads / (wonLeads + lostLeads) * 30 : 0) + (totalLeads > 0 ? (hotLeads + warmLeads) / totalLeads * 30 : 0) + Math.min(avgECSScore / 100 * 20, 20) + (adSpend > 0 ? Math.min(totalRevenue / adSpend * 5, 20) : 10))",
    unit: "pts",
    higher_is_better: true,
    category: "board",
    rationale: "Indicador ejecutivo que combina win rate, calidad de pipeline, ECS score y ROAS en un solo número.",
  },
];

// ─── Category Labels ───

export const KPI_CATEGORY_LABELS: Record<KPICategory, string> = {
  employee: "Empleados",
  commercial: "Comercial",
  marketing: "Marketing",
  operations: "Operaciones",
  financial: "Financiero",
  board: "Junta Directiva",
};

export const KPI_CATEGORY_COLORS: Record<KPICategory, string> = {
  employee: "#1A4A28",
  commercial: "#3B82F6",
  marketing: "#F59E0B",
  operations: "#8B5CF6",
  financial: "#06B6D4",
  board: "#EF4444",
};

// ─── Snapshot ───

export interface EmployeeKPISnapshot {
  id: string;
  employee_name: string;
  kpi_id: string;
  kpi_name: string;
  value: number;
  snapshot_date: string;
  created_at: string;
}

// Business-wide snapshot (not per-employee)
export interface BusinessKPISnapshot {
  id: string;
  kpi_id: string;
  kpi_name: string;
  category: KPICategory;
  value: number;
  snapshot_date: string;
  created_at: string;
}

// ─── Formula Evaluator ───

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

// ─── Compute business-level variables from data ───

import type { ECSLead, ECSInteraction } from "@/types/ecs";

export function computeBusinessVars(
  leads: ECSLead[],
  interactions: ECSInteraction[],
  adSpend = 0
): Record<string, number> {
  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === "new").length;
  const contactedLeads = leads.filter((l) => l.status === "contacted").length;
  const qualifiedLeads = leads.filter((l) => l.status === "qualified").length;
  const proposalLeads = leads.filter((l) => l.status === "proposal").length;
  const negotiationLeads = leads.filter((l) => l.status === "negotiation").length;
  const wonLeads = leads.filter((l) => l.status === "won").length;
  const lostLeads = leads.filter((l) => l.status === "lost").length;

  const hotLeads = leads.filter((l) => l.segment === "hot").length;
  const warmLeads = leads.filter((l) => l.segment === "warm").length;
  const coldLeads = leads.filter((l) => l.segment === "cold").length;
  const dormantLeads = leads.filter((l) => l.segment === "dormant").length;

  const totalRevenue = leads
    .filter((l) => l.status === "won" && l.total_amount)
    .reduce((sum, l) => sum + (l.total_amount ?? 0), 0);

  const pipelineValue = leads
    .filter((l) => (l.status === "proposal" || l.status === "negotiation") && l.total_amount)
    .reduce((sum, l) => sum + (l.total_amount ?? 0), 0);

  const avgECSScore =
    totalLeads > 0
      ? Math.round(leads.reduce((s, l) => s + l.current_score, 0) / totalLeads * 100) / 100
      : 0;

  const channels = new Set<string>();
  const employees = new Set<string>();
  for (const i of interactions) {
    if (i.channel) channels.add(i.channel);
    if (i.employee) employees.add(i.employee);
  }

  // Avg response time (from inbound→outbound pairs)
  let totalRespTime = 0;
  let respCount = 0;
  const byLead = new Map<string, ECSInteraction[]>();
  for (const i of interactions) {
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
          if (diff > 0 && diff < 604800) {
            totalRespTime += diff;
            respCount++;
          }
          break;
        }
      }
    }
  }

  const facebookLeads = leads.filter(
    (l) => l.source?.toLowerCase().includes("facebook") || l.utm_source?.toLowerCase().includes("facebook")
  ).length;

  const avgDealSize = wonLeads > 0 ? totalRevenue / wonLeads : 0;
  const winRate = (wonLeads + lostLeads) > 0 ? wonLeads / (wonLeads + lostLeads) * 100 : 0;
  const leadToQualifiedRate = totalLeads > 0 ? (qualifiedLeads + proposalLeads + negotiationLeads + wonLeads) / totalLeads * 100 : 0;
  const qualifiedToWonRate = qualifiedLeads > 0 ? wonLeads / qualifiedLeads * 100 : 0;
  const costPerLead = totalLeads > 0 && adSpend > 0 ? adSpend / totalLeads : 0;
  const costPerQualifiedLead = qualifiedLeads > 0 && adSpend > 0 ? adSpend / qualifiedLeads : 0;
  const costPerConversion = wonLeads > 0 && adSpend > 0 ? adSpend / wonLeads : 0;
  const roas = adSpend > 0 ? totalRevenue / adSpend : 0;

  return {
    totalLeads,
    newLeads,
    contactedLeads,
    qualifiedLeads,
    proposalLeads,
    negotiationLeads,
    wonLeads,
    lostLeads,
    hotLeads,
    warmLeads,
    coldLeads,
    dormantLeads,
    totalRevenue,
    avgDealSize,
    pipelineValue,
    avgECSScore,
    totalInteractionsGlobal: interactions.length,
    avgResponseTimeGlobal: respCount > 0 ? Math.round(totalRespTime / respCount) : 0,
    channelCount: channels.size,
    employeeCount: employees.size,
    adSpend,
    costPerLead,
    costPerQualifiedLead,
    costPerConversion,
    roas,
    facebookLeads,
    winRate,
    pipelineVelocity: proposalLeads + negotiationLeads,
    leadToQualifiedRate,
    qualifiedToWonRate,
    // Employee-level defaults (overridden per employee)
    avgScore: avgECSScore,
    responseTime: respCount > 0 ? Math.round(totalRespTime / respCount) : 0,
    conversionRate: winRate,
    activeLeads: totalLeads - wonLeads - lostLeads,
    totalInteractions: interactions.length,
  };
}
