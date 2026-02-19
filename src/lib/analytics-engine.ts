import { differenceInDays, format, subDays } from "date-fns";
import { linearRegression } from "./ecs-engine";
import type {
  ECSInteraction,
  ECSLead,
  ChannelStats,
  EmployeeStats,
  ChurnRisk,
  PriorityAction,
  Segment,
} from "@/types/ecs";
import { getSegmentFromScore } from "@/types/ecs";

// ─── Diagnostic Analytics ───

export function scoreDistribution(leads: ECSLead[]): { bucket: string; count: number }[] {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    bucket: `${i * 10}-${i * 10 + 10}`,
    count: 0,
  }));
  for (const lead of leads) {
    const idx = Math.min(Math.floor(lead.current_score / 10), 9);
    buckets[idx].count++;
  }
  return buckets;
}

export function channelStats(
  leads: ECSLead[],
  interactions: ECSInteraction[]
): ChannelStats[] {
  const channelMap = new Map<string, { count: number; scores: number[]; responseTimes: number[]; wonCount: number; totalLeads: number }>();

  for (const i of interactions) {
    const ch = i.channel || "unknown";
    if (!channelMap.has(ch)) {
      channelMap.set(ch, { count: 0, scores: [], responseTimes: [], wonCount: 0, totalLeads: 0 });
    }
    const entry = channelMap.get(ch)!;
    entry.count++;
    if (i.first_response_seconds) entry.responseTimes.push(i.first_response_seconds);
  }

  const leadChannels = new Map<string, Set<string>>();
  for (const lead of leads) {
    for (const ch of lead.channels ?? []) {
      if (!leadChannels.has(ch)) leadChannels.set(ch, new Set());
      leadChannels.get(ch)!.add(lead.id);
      const entry = channelMap.get(ch);
      if (entry) {
        entry.scores.push(lead.current_score);
        if (lead.status === "won") entry.wonCount++;
        entry.totalLeads++;
      }
    }
  }

  return Array.from(channelMap.entries()).map(([channel, data]) => ({
    channel,
    count: data.count,
    avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0,
    avgResponseTime: data.responseTimes.length > 0 ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length) : 0,
    conversionRate: data.totalLeads > 0 ? Math.round((data.wonCount / data.totalLeads) * 100) : 0,
  }));
}

export function employeeStats(
  leads: ECSLead[],
  interactions: ECSInteraction[]
): EmployeeStats[] {
  const empMap = new Map<string, { scores: number[]; responseTimes: number[]; wonCount: number; totalLeads: number; interactionCount: number }>();

  for (const i of interactions) {
    const emp = i.employee || "Sin asignar";
    if (!empMap.has(emp)) {
      empMap.set(emp, { scores: [], responseTimes: [], wonCount: 0, totalLeads: 0, interactionCount: 0 });
    }
    const entry = empMap.get(emp)!;
    entry.interactionCount++;
    if (i.first_response_seconds) entry.responseTimes.push(i.first_response_seconds);
  }

  for (const lead of leads) {
    for (const emp of lead.employees ?? []) {
      const name = emp || "Sin asignar";
      if (!empMap.has(name)) {
        empMap.set(name, { scores: [], responseTimes: [], wonCount: 0, totalLeads: 0, interactionCount: 0 });
      }
      const entry = empMap.get(name)!;
      entry.scores.push(lead.current_score);
      entry.totalLeads++;
      if (lead.status === "won") entry.wonCount++;
    }
  }

  return Array.from(empMap.entries())
    .map(([employee, data]) => ({
      employee,
      avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0,
      responseTime: data.responseTimes.length > 0 ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length) : 0,
      conversionRate: data.totalLeads > 0 ? Math.round((data.wonCount / data.totalLeads) * 100) : 0,
      activeLeads: data.totalLeads,
      totalInteractions: data.interactionCount,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

export function interactionHeatmap(
  interactions: ECSInteraction[]
): { day: string; hour: number; count: number }[] {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const heatmap: { day: string; hour: number; count: number }[] = [];

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      heatmap.push({ day: days[d], hour: h, count: 0 });
    }
  }

  for (const i of interactions) {
    const date = new Date(i.timestamp);
    const dayIdx = (date.getDay() + 6) % 7; // Monday = 0
    const hour = date.getHours();
    const idx = dayIdx * 24 + hour;
    if (heatmap[idx]) heatmap[idx].count++;
  }

  return heatmap;
}

export function funnelAnalysis(leads: ECSLead[]): { stage: string; count: number; rate: number }[] {
  const stages: Array<{ key: string; label: string }> = [
    { key: "new", label: "Nuevo" },
    { key: "contacted", label: "Contactado" },
    { key: "qualified", label: "Calificado" },
    { key: "proposal", label: "Propuesta" },
    { key: "negotiation", label: "Negociación" },
    { key: "won", label: "Ganado" },
  ];

  const counts = new Map<string, number>();
  for (const lead of leads) {
    counts.set(lead.status, (counts.get(lead.status) ?? 0) + 1);
  }

  let prevCount = leads.length;
  return stages.map(({ key, label }) => {
    const count = counts.get(key) ?? 0;
    const rate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
    prevCount = count || prevCount;
    return { stage: label, count, rate };
  });
}

export function segmentDistribution(leads: ECSLead[]): { segment: string; count: number; percentage: number }[] {
  const segments: Segment[] = ["hot", "warm", "cool", "cold", "dormant", "lost"];
  const labels: Record<Segment, string> = {
    hot: "Caliente",
    warm: "Tibio",
    cool: "Fresco",
    cold: "Frío",
    dormant: "Inactivo",
    lost: "Perdido",
  };

  const counts = new Map<string, number>();
  for (const lead of leads) {
    const seg = lead.segment || getSegmentFromScore(lead.current_score);
    counts.set(seg, (counts.get(seg) ?? 0) + 1);
  }

  const total = leads.length || 1;
  return segments.map((seg) => ({
    segment: labels[seg],
    count: counts.get(seg) ?? 0,
    percentage: Math.round(((counts.get(seg) ?? 0) / total) * 100),
  }));
}

// ─── Predictive Analytics ───

export function scoreForecasts(
  leads: ECSLead[],
  _interactions: ECSInteraction[],
  daysAhead = 30
): { date: string; actual?: number; forecast?: number }[] {
  const now = new Date();
  const result: { date: string; actual?: number; forecast?: number }[] = [];

  // Build historical avg scores per day (last 60 days)
  const dailyScores = new Map<string, number[]>();
  for (const lead of leads) {
    if (lead.last_interaction_at) {
      const d = format(new Date(lead.last_interaction_at), "yyyy-MM-dd");
      if (!dailyScores.has(d)) dailyScores.set(d, []);
      dailyScores.get(d)!.push(lead.current_score);
    }
  }

  const points: { x: number; y: number }[] = [];
  for (let i = 60; i >= 0; i--) {
    const d = format(subDays(now, i), "yyyy-MM-dd");
    const scores = dailyScores.get(d);
    if (scores && scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      points.push({ x: 60 - i, y: avg });
      result.push({ date: d, actual: Math.round(avg) });
    }
  }

  if (points.length >= 2) {
    const reg = linearRegression(points);
    for (let i = 1; i <= daysAhead; i++) {
      const x = 60 + i;
      const forecast = Math.max(0, Math.min(100, Math.round(reg.slope * x + reg.intercept)));
      const d = format(subDays(now, -i), "yyyy-MM-dd");
      result.push({ date: d, forecast });
    }
  }

  return result;
}

export function churnRiskAnalysis(
  leads: ECSLead[],
  interactions: ECSInteraction[]
): ChurnRisk[] {
  const now = new Date();
  const interactionsByLead = new Map<string, ECSInteraction[]>();
  for (const i of interactions) {
    if (!interactionsByLead.has(i.lead_id)) interactionsByLead.set(i.lead_id, []);
    interactionsByLead.get(i.lead_id)!.push(i);
  }

  return leads
    .map((lead) => {
      const leadInteractions = interactionsByLead.get(lead.id) ?? [];
      const daysSinceLast = lead.last_interaction_at
        ? differenceInDays(now, new Date(lead.last_interaction_at))
        : 999;

      const scoreTrend: "up" | "down" | "stable" =
        lead.current_score > lead.previous_score + 2
          ? "up"
          : lead.current_score < lead.previous_score - 2
            ? "down"
            : "stable";

      const riskFactors: string[] = [];
      let riskScore = 0;

      if (daysSinceLast > 30) { riskFactors.push("Sin interacción en 30+ días"); riskScore += 35; }
      else if (daysSinceLast > 14) { riskFactors.push("Sin interacción en 14+ días"); riskScore += 20; }
      else if (daysSinceLast > 7) { riskFactors.push("Sin interacción en 7+ días"); riskScore += 10; }

      if (scoreTrend === "down") { riskFactors.push("Puntaje en descenso"); riskScore += 25; }
      if (lead.current_score < 20) { riskFactors.push("Puntaje muy bajo"); riskScore += 20; }
      if (leadInteractions.length < 3) { riskFactors.push("Pocas interacciones"); riskScore += 15; }

      const uniqueChannels = new Set(leadInteractions.map((i) => i.channel));
      if (uniqueChannels.size <= 1) { riskFactors.push("Un solo canal"); riskScore += 10; }

      let intervention = "Monitorear";
      if (riskScore >= 60) intervention = "Llamada urgente de seguimiento";
      else if (riskScore >= 40) intervention = "Enviar email de reactivación";
      else if (riskScore >= 20) intervention = "Enviar WhatsApp de contacto";

      return {
        leadId: lead.id,
        leadName: lead.name,
        currentScore: lead.current_score,
        riskProbability: Math.min(riskScore, 100),
        riskFactors,
        recommendedIntervention: intervention,
        daysSinceLastInteraction: daysSinceLast,
        scoreTrend,
      };
    })
    .filter((r) => r.riskProbability > 15)
    .sort((a, b) => b.riskProbability - a.riskProbability);
}

// ─── Prescriptive Analytics ───

export function priorityActionQueue(
  leads: ECSLead[],
  interactions: ECSInteraction[]
): PriorityAction[] {
  const now = new Date();
  const interactionsByLead = new Map<string, ECSInteraction[]>();
  for (const i of interactions) {
    if (!interactionsByLead.has(i.lead_id)) interactionsByLead.set(i.lead_id, []);
    interactionsByLead.get(i.lead_id)!.push(i);
  }

  return leads
    .map((lead) => {
      const leadInteractions = interactionsByLead.get(lead.id) ?? [];
      const daysSinceLast = lead.last_interaction_at
        ? differenceInDays(now, new Date(lead.last_interaction_at))
        : 999;

      const segment = lead.segment || getSegmentFromScore(lead.current_score);

      // Determine best channel from history
      const channelCounts = new Map<string, number>();
      for (const i of leadInteractions) {
        channelCounts.set(i.channel, (channelCounts.get(i.channel) ?? 0) + 1);
      }
      const bestChannel = [...channelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "phone";

      let action = "";
      let urgency: "high" | "medium" | "low" = "low";
      let expectedImpact = 0;
      let reasoning = "";

      if (segment === "hot" && daysSinceLast > 3) {
        action = "Llamar inmediatamente";
        urgency = "high";
        expectedImpact = 15;
        reasoning = "Lead caliente sin contacto reciente — alto riesgo de perder oportunidad";
      } else if (segment === "warm" && daysSinceLast > 7) {
        action = "Enviar seguimiento por " + (bestChannel === "whatsapp" ? "WhatsApp" : "email");
        urgency = "medium";
        expectedImpact = 10;
        reasoning = "Lead tibio necesita nurturing activo para mantener engagement";
      } else if (segment === "cool") {
        action = "Campaña de reactivación";
        urgency = "medium";
        expectedImpact = 8;
        reasoning = "Lead fresco — necesita estímulo para avanzar en el funnel";
      } else if (segment === "cold" || segment === "dormant") {
        action = "Evaluar para campaña masiva";
        urgency = "low";
        expectedImpact = 5;
        reasoning = "Lead frío/inactivo — considerar campaña de reenganche";
      } else {
        action = "Mantener seguimiento regular";
        urgency = "low";
        expectedImpact = 3;
        reasoning = "Lead en buen estado — continuar con cadencia actual";
      }

      return {
        leadId: lead.id,
        leadName: lead.name,
        currentScore: lead.current_score,
        segment,
        recommendedAction: action,
        channel: bestChannel,
        urgency,
        expectedImpact,
        reasoning,
      };
    })
    .filter((a) => a.urgency !== "low" || a.currentScore > 10)
    .sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || b.currentScore - a.currentScore;
    })
    .slice(0, 50);
}

export function channelMixData(interactions: ECSInteraction[]): { name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const i of interactions) {
    const ch = i.channel || "unknown";
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function responseTimeDistribution(
  interactions: ECSInteraction[]
): { bucket: string; count: number }[] {
  const buckets = [
    { label: "< 5 min", max: 300 },
    { label: "5-15 min", max: 900 },
    { label: "15-30 min", max: 1800 },
    { label: "30-60 min", max: 3600 },
    { label: "1-4 hrs", max: 14400 },
    { label: "4-24 hrs", max: 86400 },
    { label: "> 24 hrs", max: Infinity },
  ];

  const result = buckets.map((b) => ({ bucket: b.label, count: 0 }));

  // If pre-computed first_response_seconds exists, use it
  let hasPrecomputed = false;
  for (const i of interactions) {
    if (i.first_response_seconds && i.first_response_seconds > 0) {
      hasPrecomputed = true;
      const idx = buckets.findIndex((b) => i.first_response_seconds! <= b.max);
      if (idx >= 0) result[idx].count++;
    }
  }
  if (hasPrecomputed) return result;

  // Fallback: derive response times from inbound→outbound pairs per lead
  const byLead = new Map<string, ECSInteraction[]>();
  for (const i of interactions) {
    if (!i.lead_id || !i.timestamp) continue;
    if (!byLead.has(i.lead_id)) byLead.set(i.lead_id, []);
    byLead.get(i.lead_id)!.push(i);
  }

  for (const [, leadInts] of byLead) {
    leadInts.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (let j = 0; j < leadInts.length; j++) {
      const curr = leadInts[j];
      // Look for inbound interactions that got a subsequent outbound reply
      if (curr.direction !== "entrante") continue;
      for (let k = j + 1; k < leadInts.length; k++) {
        const next = leadInts[k];
        if (next.direction === "saliente") {
          const diffSec =
            (new Date(next.timestamp).getTime() - new Date(curr.timestamp).getTime()) / 1000;
          if (diffSec > 0 && diffSec < 604800) {
            const idx = buckets.findIndex((b) => diffSec <= b.max);
            if (idx >= 0) result[idx].count++;
          }
          break;
        }
      }
    }
  }

  return result;
}

// Avg response time trend over time (weekly buckets)
export function responseTimeTrend(
  interactions: ECSInteraction[]
): { week: string; avgMinutes: number; count: number }[] {
  // Build inbound→outbound response time pairs
  const byLead = new Map<string, ECSInteraction[]>();
  for (const i of interactions) {
    if (!i.lead_id || !i.timestamp) continue;
    if (!byLead.has(i.lead_id)) byLead.set(i.lead_id, []);
    byLead.get(i.lead_id)!.push(i);
  }

  const pairs: { ts: number; diffSec: number }[] = [];
  for (const [, ints] of byLead) {
    ints.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (let j = 0; j < ints.length; j++) {
      if (ints[j].direction !== "entrante") continue;
      for (let k = j + 1; k < ints.length; k++) {
        if (ints[k].direction === "saliente") {
          const diff = (new Date(ints[k].timestamp).getTime() - new Date(ints[j].timestamp).getTime()) / 1000;
          if (diff > 0 && diff < 604800) {
            pairs.push({ ts: new Date(ints[j].timestamp).getTime(), diffSec: diff });
          }
          break;
        }
      }
    }
  }

  if (pairs.length === 0) return [];

  pairs.sort((a, b) => a.ts - b.ts);

  // Group into weekly buckets
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const minTs = pairs[0].ts;
  const maxTs = pairs[pairs.length - 1].ts;
  const buckets: { start: number; total: number; count: number }[] = [];

  for (let t = minTs; t <= maxTs; t += weekMs) {
    buckets.push({ start: t, total: 0, count: 0 });
  }

  for (const p of pairs) {
    const idx = Math.min(Math.floor((p.ts - minTs) / weekMs), buckets.length - 1);
    if (idx >= 0 && idx < buckets.length) {
      buckets[idx].total += p.diffSec;
      buckets[idx].count++;
    }
  }

  return buckets
    .filter((b) => b.count > 0)
    .map((b) => ({
      week: new Date(b.start).toLocaleDateString("es-CR", { day: "2-digit", month: "short" }),
      avgMinutes: Math.round(b.total / b.count / 60),
      count: b.count,
    }));
}

export function brandComparison(leads: ECSLead[]): { brand: string; avgScore: number; count: number; conversionRate: number }[] {
  const brandMap = new Map<string, { scores: number[]; wonCount: number }>();

  for (const lead of leads) {
    const brand = lead.brand || "Sin marca";
    if (!brandMap.has(brand)) brandMap.set(brand, { scores: [], wonCount: 0 });
    const entry = brandMap.get(brand)!;
    entry.scores.push(lead.current_score);
    if (lead.status === "won") entry.wonCount++;
  }

  return Array.from(brandMap.entries())
    .map(([brand, data]) => ({
      brand,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
      count: data.scores.length,
      conversionRate: Math.round((data.wonCount / data.scores.length) * 100),
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}
