/**
 * OpenRouter Free-Model Fallback System
 *
 * When the primary sentiment agent (Modal-hosted, paid OpenRouter) fails
 * due to credit exhaustion or any API error, this module provides a
 * direct-to-OpenRouter fallback using free-tier models.
 *
 * The fallback is TEMPORARY (designed for ~2h semi-downtime windows)
 * and automatically deactivates once the primary agent recovers.
 */

import type {
  InteractionSummary,
  SentimentResult,
  BatchSentimentResponse,
} from "@/types/ecs";

// ─── Free Model Tiers ───

export interface FreeModel {
  id: string;
  label: string;
  contextWindow: number;
  /** Lower = tried first */
  priority: number;
}

/**
 * Free models ordered by priority for sentiment analysis.
 * All use the `:free` suffix on OpenRouter.
 */
export const FREE_MODELS: FreeModel[] = [
  {
    id: "google/gemini-2.0-flash-exp:free",
    label: "Gemini 2.0 Flash",
    contextWindow: 1_000_000,
    priority: 1,
  },
  {
    id: "deepseek/deepseek-r1:free",
    label: "DeepSeek R1",
    contextWindow: 128_000,
    priority: 2,
  },
  {
    id: "meta-llama/llama-3.3-70b:free",
    label: "Llama 3.3 70B",
    contextWindow: 128_000,
    priority: 3,
  },
  {
    id: "google/gemini-2.5-flash-image-preview:free",
    label: "Gemini 2.5 Flash Preview",
    contextWindow: 128_000,
    priority: 4,
  },
];

/**
 * Mapping from paid model patterns to their free fallback chain.
 * The first model in the array is tried first.
 */
export const FALLBACK_MAP: Record<string, string[]> = {
  // GPT-4o-mini → Gemini Flash → DeepSeek → Llama
  "gpt-4o-mini": [
    "google/gemini-2.0-flash-exp:free",
    "deepseek/deepseek-r1:free",
    "meta-llama/llama-3.3-70b:free",
  ],
  // Grok → DeepSeek → Gemini → Llama
  grok: [
    "deepseek/deepseek-r1:free",
    "google/gemini-2.0-flash-exp:free",
    "meta-llama/llama-3.3-70b:free",
  ],
  // Nano/small models → Gemini Flash → Llama
  nano: [
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-2.5-flash-image-preview:free",
    "meta-llama/llama-3.3-70b:free",
  ],
  // Default fallback chain
  default: [
    "google/gemini-2.0-flash-exp:free",
    "deepseek/deepseek-r1:free",
    "meta-llama/llama-3.3-70b:free",
  ],
};

// ─── Fallback State ───

interface FallbackState {
  active: boolean;
  activatedAt: number | null;
  currentModel: string | null;
  failedModels: Set<string>;
  consecutiveFailures: number;
  /** Auto-deactivate after this many ms (default 2h) */
  ttlMs: number;
}

const FALLBACK_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const state: FallbackState = {
  active: false,
  activatedAt: null,
  currentModel: null,
  failedModels: new Set(),
  consecutiveFailures: 0,
  ttlMs: FALLBACK_TTL_MS,
};

export function isFallbackActive(): boolean {
  if (!state.active) return false;
  // Auto-deactivate after TTL
  if (state.activatedAt && Date.now() - state.activatedAt > state.ttlMs) {
    deactivateFallback();
    return false;
  }
  return true;
}

export function getFallbackStatus() {
  return {
    active: isFallbackActive(),
    currentModel: state.currentModel,
    activatedAt: state.activatedAt ? new Date(state.activatedAt).toISOString() : null,
    failedModels: [...state.failedModels],
    consecutiveFailures: state.consecutiveFailures,
  };
}

export function activateFallback(): void {
  state.active = true;
  state.activatedAt = Date.now();
  state.failedModels.clear();
  state.consecutiveFailures = 0;
  console.warn("[OpenRouter Fallback] ⚠️ Activated — using free models");
}

export function deactivateFallback(): void {
  state.active = false;
  state.activatedAt = null;
  state.currentModel = null;
  state.failedModels.clear();
  state.consecutiveFailures = 0;
  console.info("[OpenRouter Fallback] ✅ Deactivated — primary agent recovered");
}

// ─── OpenRouter Direct Call ───

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SENTIMENT_SYSTEM_PROMPT = `Eres un agente de análisis de sentimiento comercial para ARA Group Costa Rica (cocinas, closets, muebles de diseño).

Analiza los datos de interacción de cada lead y devuelve un JSON con EXACTAMENTE estos campos:
{
  "lead_id": "string — el ID del lead",
  "lead_name": "string — nombre del lead",
  "sentiment_score": number — de -1.0 (muy negativo) a +1.0 (muy positivo),
  "sentiment_label": "very_positive" | "positive" | "neutral" | "negative" | "very_negative",
  "engagement_quality": "excellent" | "good" | "moderate" | "poor" | "minimal",
  "intent_signals": ["array de señales de intención de compra en español"],
  "risk_flags": ["array de banderas de riesgo en español"],
  "recommended_action": "string — acción recomendada en español",
  "ecs_sentiment_bonus": number — bonus de -5.0 a +10.0 para el ECS Score,
  "reasoning": "string — razonamiento breve en español"
}

REGLAS:
- Responde SIEMPRE en ESPAÑOL
- Devuelve SOLO el JSON, sin markdown ni explicaciones
- Si hay múltiples leads, devuelve un array JSON de objetos
- Basa el análisis en: cantidad de interacciones, canales usados, tiempos de respuesta, ratings, dirección de comunicación
- Un lead con muchas interacciones bidireccionales = positivo
- Un lead sin respuesta o solo outbound = negativo
- Tiempos de respuesta rápidos = positivo`;

function buildSentimentPrompt(leads: InteractionSummary[]): string {
  const leadsData = leads.map((l) => ({
    lead_id: l.lead_id,
    lead_name: l.lead_name,
    total_conversations: l.total_conversations,
    total_messages: l.total_messages,
    channels: l.channels,
    employees: l.employees,
    avg_response_seconds: Math.round(l.avg_response_seconds),
    avg_duration_seconds: Math.round(l.avg_duration_seconds),
    client_ratings: l.client_ratings,
    interaction_types: l.interaction_types,
    first_seen: l.first_seen,
    last_seen: l.last_seen,
    direction_breakdown: l.direction_breakdown,
  }));

  return `Analiza el sentimiento de ${leads.length === 1 ? "este lead" : `estos ${leads.length} leads`}:\n\n${JSON.stringify(leadsData, null, 2)}`;
}

export async function callOpenRouterFree(
  model: string,
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal,
  maxTokens = 2000
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "HTTP-Referer": window.location.origin,
    "X-Title": "ECS Lead Intelligence",
  };
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${model} returned ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`OpenRouter ${model} returned empty content`);
  return content;
}

function parseJsonResponse(raw: string): unknown {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  // Handle DeepSeek R1 <think>...</think> blocks
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Try to find JSON array or object
  const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }
  return JSON.parse(cleaned);
}

function validateSentimentResult(obj: Record<string, unknown>): SentimentResult {
  return {
    lead_id: String(obj.lead_id ?? ""),
    lead_name: String(obj.lead_name ?? ""),
    sentiment_score: Number(obj.sentiment_score ?? 0),
    sentiment_label: validateLabel(String(obj.sentiment_label ?? "neutral")),
    engagement_quality: validateQuality(String(obj.engagement_quality ?? "moderate")),
    intent_signals: Array.isArray(obj.intent_signals) ? obj.intent_signals.map(String) : [],
    risk_flags: Array.isArray(obj.risk_flags) ? obj.risk_flags.map(String) : [],
    recommended_action: String(obj.recommended_action ?? "Seguimiento estándar"),
    ecs_sentiment_bonus: Math.max(-5, Math.min(10, Number(obj.ecs_sentiment_bonus ?? 0))),
    reasoning: String(obj.reasoning ?? "Análisis generado por modelo de respaldo gratuito"),
  };
}

function validateLabel(s: string): SentimentResult["sentiment_label"] {
  const valid = ["very_positive", "positive", "neutral", "negative", "very_negative"];
  return valid.includes(s) ? (s as SentimentResult["sentiment_label"]) : "neutral";
}

function validateQuality(s: string): SentimentResult["engagement_quality"] {
  const valid = ["excellent", "good", "moderate", "poor", "minimal"];
  return valid.includes(s) ? (s as SentimentResult["engagement_quality"]) : "moderate";
}

// ─── Public Fallback API ───

/**
 * Analyze sentiment for a batch of leads using free OpenRouter models.
 * Tries models in priority order until one succeeds.
 */
export async function fallbackAnalyzeSentimentBatch(
  leads: InteractionSummary[],
  signal?: AbortSignal
): Promise<BatchSentimentResponse> {
  const chain = FALLBACK_MAP.default;
  const userMessage = buildSentimentPrompt(leads);
  let lastError: Error | null = null;

  for (const modelId of chain) {
    if (state.failedModels.has(modelId)) continue;
    if (signal?.aborted) throw new Error("Aborted");

    try {
      console.info(`[Fallback] Trying ${modelId} for ${leads.length} leads...`);
      state.currentModel = modelId;

      const raw = await callOpenRouterFree(
        modelId,
        SENTIMENT_SYSTEM_PROMPT,
        userMessage,
        signal,
        leads.length > 1 ? 4000 : 1500
      );

      const parsed = parseJsonResponse(raw);
      const results: SentimentResult[] = [];

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          results.push(validateSentimentResult(item as Record<string, unknown>));
        }
      } else if (typeof parsed === "object" && parsed !== null) {
        results.push(validateSentimentResult(parsed as Record<string, unknown>));
      }

      // Ensure all leads have a result (fill missing with defaults)
      const resultMap = new Map(results.map((r) => [r.lead_id, r]));
      for (const lead of leads) {
        if (!resultMap.has(lead.lead_id)) {
          results.push({
            lead_id: lead.lead_id,
            lead_name: lead.lead_name,
            sentiment_score: 0,
            sentiment_label: "neutral",
            engagement_quality: "moderate",
            intent_signals: [],
            risk_flags: ["Análisis incompleto por modelo de respaldo"],
            recommended_action: "Seguimiento estándar — reanálisis recomendado",
            ecs_sentiment_bonus: 0,
            reasoning: "Lead no incluido en la respuesta del modelo de respaldo",
          });
        }
      }

      const modelLabel = FREE_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
      console.info(`[Fallback] ✅ ${modelLabel} succeeded for ${leads.length} leads`);

      return {
        results,
        model_used: `fallback:${modelId}`,
        analyzed_at: new Date().toISOString(),
        total_leads: leads.length,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      state.failedModels.add(modelId);
      console.warn(`[Fallback] ❌ ${modelId} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error("All fallback models failed");
}

/**
 * Chat completion using free OpenRouter models (for LeadAdvisorChat).
 */
export async function fallbackChatCompletion(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  const chain = FALLBACK_MAP.default;
  let lastError: Error | null = null;

  for (const modelId of chain) {
    if (state.failedModels.has(modelId)) continue;
    if (signal?.aborted) throw new Error("Aborted");

    try {
      state.currentModel = modelId;
      const userMsg = messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n");

      const contextMsgs = messages
        .filter((m) => m.role === "assistant")
        .slice(-2)
        .map((m) => m.content)
        .join("\n---\n");

      const fullPrompt = contextMsgs
        ? `Contexto previo:\n${contextMsgs}\n\nPregunta actual:\n${userMsg}`
        : userMsg;

      return await callOpenRouterFree(modelId, systemPrompt, fullPrompt, signal, 800);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      state.failedModels.add(modelId);
      console.warn(`[Fallback Chat] ❌ ${modelId} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error("All fallback chat models failed");
}
