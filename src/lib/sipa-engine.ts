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
import { callOpenRouterFree } from "@/lib/openrouter-fallback";
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

export const SIPA_BATCH_SIZE = 1;
export const SIPA_TIMEOUT_MS = 90_000;
export const SIPA_INTER_BATCH_DELAY_MS = 8_000;
export const SIPA_MAX_LEADS_PER_CYCLE = 15;
const SIPA_CACHE_KEY = "sipa_analyses";
const SIPA_ALERTS_KEY = "sipa_alerts";
const SIPA_CONFIG_KEY = "sipa_notification_config";

const SIPA_MODELS = [
  "openrouter/free",                                 // auto-router: picks best available free model
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "stepfun/step-3.5-flash:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "nvidia/nemotron-nano-9b-v2:free",
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
      const noteText = rawNote ? String(rawNote).slice(0, 80) : null;

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

// ─── Robust JSON extraction (handles trailing text after valid JSON) ───

function extractJson(text: string): string | null {
  // Find the first [ or { that starts JSON
  const arrStart = text.indexOf("[");
  const objStart = text.indexOf("{");
  if (arrStart === -1 && objStart === -1) return null;

  // Try array first (expected), then object
  const starts: number[] = [];
  if (arrStart !== -1) starts.push(arrStart);
  if (objStart !== -1) starts.push(objStart);
  starts.sort((a, b) => a - b);

  for (const start of starts) {
    const open = text[start]; // '[' or '{'
    const close = open === "[" ? "]" : "}";
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "[" || ch === "{") depth++;
      if (ch === "]" || ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            break; // this bracket pair didn't parse, try next start
          }
        }
      }
    }
  }
  return null;
}

// ─── Call AI via OpenRouter ───

async function callSIPAAI(
  payloads: LeadInteractionData[],
  signal?: AbortSignal
): Promise<SIPAAIResponse[]> {
  const today = new Date().toISOString().split("T")[0];
  const userPrompt = `Fecha actual: ${today}\nAnaliza ${payloads.length === 1 ? "este lead" : `estos ${payloads.length} leads`}:\n${JSON.stringify(payloads)}`;

  const promptSize = SIPA_SYSTEM_PROMPT.length + userPrompt.length;
  console.log(`[SIPA] Prompt size: ${promptSize} chars for ${payloads.length} leads`);

  // Use the same proven callOpenRouterFree that the sentiment fallback uses
  const errors: string[] = [];
  for (let i = 0; i < SIPA_MODELS.length; i++) {
    const model = SIPA_MODELS[i];
    // Small delay between model attempts to avoid simultaneous rate-limit hits
    if (i > 0) await new Promise((r) => setTimeout(r, 1_500));
    try {
      const raw = await callOpenRouterFree(model, SIPA_SYSTEM_PROMPT, userPrompt, signal, 4000);

      // Strip markdown code fences and DeepSeek think blocks
      let content = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (content.startsWith("```")) {
        content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      // Extract JSON robustly using bracket counting (handles trailing text)
      const jsonStr = extractJson(content);
      if (!jsonStr) {
        const preview = content.slice(0, 150);
        errors.push(`${model}: non-JSON response: "${preview}"`);
        console.warn(`[SIPA] Model ${model} non-JSON:`, preview);
        continue;
      }

      let parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) parsed = [parsed];

      console.log(`[SIPA] Model ${model} succeeded for ${parsed.length} leads`);
      return parsed as SIPAAIResponse[];
    } catch (err) {
      if (signal?.aborted) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${msg}`);
      console.warn(`[SIPA] Model ${model} failed:`, msg);
      continue;
    }
  }

  throw new Error(errors.join(" | "));
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
  const errors: string[] = [];

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
      errors,
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
          errors.push(`Lead ${lead.name}: sin respuesta del AI`);
        }
      }
    } catch (err) {
      if (signal?.aborted) break;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[SIPA] Batch failed:", errMsg);
      // Condense long multi-model error chains for UI readability
      const condensed = errMsg
        .split(" | ")
        .map((e) => {
          const statusMatch = e.match(/returned (\d+)/);
          const modelMatch = e.match(/^([^:]+)/);
          return modelMatch && statusMatch
            ? `${modelMatch[1]}: ${statusMatch[1]}`
            : e.slice(0, 80);
        })
        .join(" | ");
      errors.push(condensed.length > 300 ? condensed.slice(0, 300) + "…" : condensed);
      done += batch.length;
      failed += batch.length;
    }

    onProgress?.({
      done,
      total: leadsToAnalyze.length,
      failed,
      phase: "analyzing",
      errors,
    });

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
    errors,
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
