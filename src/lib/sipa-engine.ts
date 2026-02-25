/**
 * S.I.P.A. Engine — Sentiment Interaction Proactive Alerting
 *
 * Analyzes ALL interactions for each lead and generates:
 *   - Actionable appointments, reminders, follow-ups
 *   - Risk alerts with severity levels
 *   - Timeline events for Gantt visualization
 *
 * Uses OpenRouter free models (same fallback chain as sentiment).
 */

import type { ECSLead, ECSInteraction } from "@/types/ecs";
import type {
  SIPALeadAnalysis,
  SIPAActionItem,
  SIPAAlert,
  SIPATimelineEvent,
  SIPAAIResponse,
  SIPAProgress,
  SIPAAlertSeverity,
} from "@/types/sipa";

// ─── Constants ───

export const SIPA_BATCH_SIZE = 3;
export const SIPA_TIMEOUT_MS = 90_000;
export const SIPA_INTER_BATCH_DELAY_MS = 3_000;
export const SIPA_MAX_LEADS_PER_CYCLE = 50;
const SIPA_CACHE_KEY = "sipa_analyses";
const SIPA_ALERTS_KEY = "sipa_alerts";
const SIPA_CONFIG_KEY = "sipa_notification_config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SIPA_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.3-70b:free",
];

// ─── System Prompt ───

const SIPA_SYSTEM_PROMPT = `Eres S.I.P.A. (Sentiment Interaction Proactive Alerting), un sistema experto de alertas proactivas para ARA Group Costa Rica (cocinas, closets, muebles de diseño).

Tu trabajo es analizar TODAS las interacciones históricas de un lead y generar un plan de acción proactivo para que el vendedor no pierda el deal.

Para cada lead, debes responder con un JSON con EXACTAMENTE estos campos:
{
  "lead_id": "string",
  "lead_name": "string",
  "summary": "Resumen ejecutivo de la situación del lead en español (2-3 oraciones)",
  "health_score": number (0-100, probabilidad de conversión),
  "risk_level": "critical" | "high" | "medium" | "low",
  "key_insights": ["array de hallazgos clave en español, máximo 5"],
  "action_items": [
    {
      "type": "appointment" | "follow_up" | "reminder" | "ar" | "callback" | "quote_follow_up" | "design_review" | "showroom_visit" | "closing_attempt" | "escalation",
      "timeframe": "immediate" | "today" | "short_term" | "mid_term" | "long_term",
      "priority": "critical" | "high" | "medium" | "low",
      "title": "Título corto de la acción",
      "description": "Descripción detallada de qué hacer y por qué",
      "suggested_date": "YYYY-MM-DD (fecha sugerida para la acción)",
      "employee": "nombre del vendedor asignado o null"
    }
  ]
}

REGLAS:
- Responde SIEMPRE en ESPAÑOL
- Devuelve SOLO el JSON, sin markdown ni explicaciones
- Si hay múltiples leads, devuelve un array JSON
- Genera entre 2-6 action_items por lead según la complejidad
- Las fechas sugeridas deben ser realistas basadas en la fecha actual y la urgencia
- SIEMPRE incluye al menos una acción inmediata o de hoy
- Si el lead está en riesgo, genera acciones de tipo "escalation" o "ar"
- Considera el historial completo: frecuencia de contacto, canales usados, tiempos de respuesta, notas, etapas
- Si hay WhatsApp o notas sin respuesta, genera "callback" urgente
- Si hay cotización enviada sin seguimiento, genera "quote_follow_up"
- Si el lead mostró interés en diseño/showroom, genera "design_review" o "showroom_visit"
- Si la oportunidad está madura, genera "closing_attempt"`;

// ─── Build prompt from lead data ───

interface LeadInteractionData {
  lead_id: string;
  lead_name: string;
  status: string;
  segment: string;
  score: number;
  employees: string[];
  channels: string[];
  first_seen: string | null;
  last_seen: string | null;
  etapa_bitrix: string | null;
  budget_range: string | null;
  total_amount: number | null;
  interactions: Array<{
    type: string;
    channel: string;
    direction: string;
    timestamp: string;
    employee: string | null;
    message_count: number | null;
    first_response_seconds: number | null;
    has_notes: boolean;
    note_preview: string | null;
  }>;
}

export function buildSIPAPayload(
  lead: ECSLead,
  interactions: ECSInteraction[]
): LeadInteractionData {
  const leadIx = interactions
    .filter((ix) => ix.lead_id === lead.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-30); // Cap to last 30 interactions to keep payload within context window

  return {
    lead_id: lead.id,
    lead_name: lead.name,
    status: lead.status,
    segment: lead.segment,
    score: lead.current_score,
    employees: lead.employees ?? [],
    channels: lead.channels ?? [],
    first_seen: lead.first_seen,
    last_seen: lead.last_seen,
    etapa_bitrix: lead.etapa_bitrix ?? null,
    budget_range: lead.budget_range ?? null,
    total_amount: lead.total_amount ?? null,
    interactions: leadIx.map((ix) => {
      // Extract note text from bitrix_raw if available
      const rawNote =
        ix.bitrix_raw && typeof ix.bitrix_raw === "object"
          ? (ix.bitrix_raw as Record<string, unknown>).DESCRIPTION ||
            (ix.bitrix_raw as Record<string, unknown>).COMMENT ||
            (ix.bitrix_raw as Record<string, unknown>).note ||
            null
          : null;
      const noteText = rawNote ? String(rawNote).slice(0, 200) : null;

      return {
        type: ix.type,
        channel: ix.channel,
        direction: ix.direction,
        timestamp: ix.timestamp,
        employee: ix.employee,
        message_count: ix.message_count,
        first_response_seconds: ix.first_response_seconds,
        has_notes: ix.type === "note_added" || !!noteText,
        note_preview: noteText,
      };
    }),
  };
}

// ─── Interaction hash for change detection ───

export function computeInteractionHash(interactions: ECSInteraction[]): string {
  const sorted = interactions
    .map((ix) => `${ix.id}:${ix.timestamp}:${ix.type}`)
    .sort()
    .join("|");
  // Simple hash
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

// ─── Call AI via OpenRouter ───

async function callSIPAAI(
  payloads: LeadInteractionData[],
  signal?: AbortSignal
): Promise<SIPAAIResponse[]> {
  const today = new Date().toISOString().split("T")[0];
  const userPrompt = `Fecha actual: ${today}\n\nAnaliza ${payloads.length === 1 ? "este lead" : `estos ${payloads.length} leads`} y genera el plan de acción proactivo:\n\n${JSON.stringify(payloads, null, 2)}`;

  for (const model of SIPA_MODELS) {
    try {
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "ECS-SIPA",
      };
      // Only add Authorization if key is actually set (free models work without it)
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SIPA_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
        signal,
      });

      if (!res.ok) {
        console.warn(`[SIPA] Model ${model} returned ${res.status}, trying next...`);
        continue;
      }

      const data = await res.json();
      let content = data.choices?.[0]?.message?.content ?? "";

      // Strip markdown code fences and DeepSeek think blocks
      content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (content.startsWith("```")) {
        content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/) || content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[SIPA] Model ${model} returned non-JSON, trying next...`);
        continue;
      }

      let parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) parsed = [parsed];

      return parsed as SIPAAIResponse[];
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn(`[SIPA] Model ${model} failed:`, err);
      continue;
    }
  }

  throw new Error("[SIPA] All AI models failed");
}

// ─── Convert AI response to typed SIPA objects ───

function generateId(): string {
  return `sipa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function aiResponseToAnalysis(
  ai: SIPAAIResponse,
  interactionHash: string,
  interactionCount: number
): SIPALeadAnalysis {
  const now = new Date().toISOString();
  const actionItems: SIPAActionItem[] = (ai.action_items || []).map((item) => ({
    id: generateId(),
    lead_id: ai.lead_id,
    lead_name: ai.lead_name,
    employee: item.employee ?? null,
    type: item.type,
    timeframe: item.timeframe,
    priority: item.priority,
    title: item.title,
    description: item.description,
    due_date: item.suggested_date || now.split("T")[0],
    created_at: now,
    completed: false,
    completed_at: null,
    dismissed: false,
    source_interaction_ids: [],
  }));

  const timelineEvents: SIPATimelineEvent[] = actionItems.map((item) => ({
    id: `tl_${item.id}`,
    lead_id: item.lead_id,
    lead_name: item.lead_name,
    employee: item.employee,
    type: "scheduled_action" as const,
    label: item.title,
    start_date: item.due_date,
    end_date: null,
    color: item.priority === "critical" ? "#ef4444" :
           item.priority === "high" ? "#f97316" :
           item.priority === "medium" ? "#eab308" : "#22c55e",
    completed: false,
  }));

  return {
    lead_id: ai.lead_id,
    lead_name: ai.lead_name,
    analyzed_at: now,
    interaction_count: interactionCount,
    interaction_hash: interactionHash,
    summary: ai.summary || "Sin resumen disponible",
    health_score: Math.max(0, Math.min(100, ai.health_score || 50)),
    risk_level: ai.risk_level || "medium",
    key_insights: ai.key_insights || [],
    action_items: actionItems,
    timeline_events: timelineEvents,
  };
}

function analysisToAlerts(analysis: SIPALeadAnalysis): SIPAAlert[] {
  const alerts: SIPAAlert[] = [];

  // Generate alert for critical/high priority items
  for (const item of analysis.action_items) {
    if (item.priority === "critical" || item.priority === "high") {
      const severity: SIPAAlertSeverity =
        item.priority === "critical" ? "critical" :
        item.timeframe === "immediate" ? "critical" : "warning";

      alerts.push({
        id: `alert_${item.id}`,
        lead_id: analysis.lead_id,
        lead_name: analysis.lead_name,
        employee: item.employee,
        severity,
        title: item.title,
        message: item.description,
        created_at: item.created_at,
        read: false,
        action_item_id: item.id,
        notified_channels: [],
      });
    }
  }

  // Generate alert if health score is low
  if (analysis.health_score < 30) {
    alerts.push({
      id: generateId(),
      lead_id: analysis.lead_id,
      lead_name: analysis.lead_name,
      employee: null,
      severity: "critical",
      title: `⚠️ ${analysis.lead_name}: Riesgo alto de pérdida`,
      message: `Health score: ${analysis.health_score}/100. ${analysis.summary}`,
      created_at: new Date().toISOString(),
      read: false,
      action_item_id: null,
      notified_channels: [],
    });
  }

  return alerts;
}

// ─── Main Analysis Function ───

export async function analyzeSIPABatch(
  leads: ECSLead[],
  allInteractions: ECSInteraction[],
  existingAnalyses: Record<string, SIPALeadAnalysis>,
  onProgress?: (p: SIPAProgress) => void,
  signal?: AbortSignal
): Promise<{ analyses: Record<string, SIPALeadAnalysis>; alerts: SIPAAlert[] }> {
  const newAnalyses: Record<string, SIPALeadAnalysis> = {};
  const newAlerts: SIPAAlert[] = [];
  const totalLeads = leads.length;
  let done = 0;
  let failed = 0;

  // Filter leads that need analysis (new or changed interactions)
  const candidates = leads.filter((lead) => {
    const leadIx = allInteractions.filter((ix) => ix.lead_id === lead.id);
    const hash = computeInteractionHash(leadIx);
    const existing = existingAnalyses[lead.id];
    // Re-analyze if: no existing analysis, or interactions changed
    return !existing || existing.interaction_hash !== hash;
  });

  if (candidates.length === 0) {
    onProgress?.({ done: totalLeads, total: totalLeads, failed: 0, phase: "idle" });
    return { analyses: {}, alerts: [] };
  }

  // Prioritize by score (highest first = most valuable leads), cap per cycle
  candidates.sort((a, b) => b.current_score - a.current_score);
  const leadsToAnalyze = candidates.slice(0, SIPA_MAX_LEADS_PER_CYCLE);
  if (candidates.length > SIPA_MAX_LEADS_PER_CYCLE) {
    console.log(`[SIPA] Capping from ${candidates.length} to ${SIPA_MAX_LEADS_PER_CYCLE} leads this cycle`);
  }

  console.log(`[SIPA] Analyzing ${leadsToAnalyze.length} leads (${totalLeads - leadsToAnalyze.length} skipped/unchanged)`);

  // Process in batches
  for (let i = 0; i < leadsToAnalyze.length; i += SIPA_BATCH_SIZE) {
    if (signal?.aborted) break;

    const batch = leadsToAnalyze.slice(i, i + SIPA_BATCH_SIZE);
    onProgress?.({
      done,
      total: leadsToAnalyze.length,
      failed,
      phase: "analyzing",
    });

    try {
      const payloads = batch.map((lead) =>
        buildSIPAPayload(lead, allInteractions)
      );
      const aiResponses = await callSIPAAI(payloads, signal);

      for (const aiResp of aiResponses) {
        const lead = batch.find((l) => l.id === aiResp.lead_id || l.name === aiResp.lead_name);
        if (!lead) continue;

        const leadIx = allInteractions.filter((ix) => ix.lead_id === lead.id);
        const hash = computeInteractionHash(leadIx);
        const analysis = aiResponseToAnalysis(aiResp, hash, leadIx.length);
        // Ensure lead_id is correct (AI may return name instead of ID)
        analysis.lead_id = lead.id;
        newAnalyses[lead.id] = analysis;

        const alerts = analysisToAlerts(analysis);
        newAlerts.push(...alerts);
        done++;
      }

      // Handle leads in batch that weren't in AI response
      for (const lead of batch) {
        if (!newAnalyses[lead.id]) {
          done++;
          failed++;
        }
      }
    } catch (err) {
      if (signal?.aborted) break;
      console.error("[SIPA] Batch failed:", err);
      done += batch.length;
      failed += batch.length;
    }

    // Inter-batch delay
    if (i + SIPA_BATCH_SIZE < leadsToAnalyze.length) {
      await new Promise((r) => setTimeout(r, SIPA_INTER_BATCH_DELAY_MS));
    }
  }

  onProgress?.({
    done: leadsToAnalyze.length,
    total: leadsToAnalyze.length,
    failed,
    phase: "idle",
  });

  return { analyses: newAnalyses, alerts: newAlerts };
}

// ─── LocalStorage Cache ───

export function loadCachedAnalyses(): Record<string, SIPALeadAnalysis> {
  try {
    const raw = localStorage.getItem(SIPA_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCachedAnalyses(analyses: Record<string, SIPALeadAnalysis>): void {
  try {
    localStorage.setItem(SIPA_CACHE_KEY, JSON.stringify(analyses));
  } catch (err) {
    console.warn("[SIPA] Failed to save cache:", err);
  }
}

export function loadCachedAlerts(): SIPAAlert[] {
  try {
    const raw = localStorage.getItem(SIPA_ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedAlerts(alerts: SIPAAlert[]): void {
  try {
    localStorage.setItem(SIPA_ALERTS_KEY, JSON.stringify(alerts));
  } catch (err) {
    console.warn("[SIPA] Failed to save alerts:", err);
  }
}

export function loadNotificationConfig() {
  try {
    const raw = localStorage.getItem(SIPA_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveNotificationConfig(config: unknown): void {
  try {
    localStorage.setItem(SIPA_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn("[SIPA] Failed to save config:", err);
  }
}

export function clearSIPACache(): void {
  localStorage.removeItem(SIPA_CACHE_KEY);
  localStorage.removeItem(SIPA_ALERTS_KEY);
}
