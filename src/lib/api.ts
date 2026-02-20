import type { InteractionSummary, SentimentResult, BatchSentimentResponse } from "@/types/ecs";
import {
  isFallbackActive,
  activateFallback,
  deactivateFallback,
  fallbackAnalyzeSentimentBatch,
  getFallbackStatus,
} from "@/lib/openrouter-fallback";

const BITRIX_MCP_URL =
  import.meta.env.VITE_BITRIX_MCP_URL ??
  "https://levinnovation--bitrix24-mcp-bitrix24-server.modal.run";

const SENTIMENT_URL =
  import.meta.env.VITE_SENTIMENT_AGENT_URL ??
  "https://levinnovation--ecs-sentiment-agent-ecs-sentiment-server.modal.run";

// ─── Bitrix MCP ───

export async function bitrixHealth() {
  const res = await fetch(`${BITRIX_MCP_URL}/health`);
  return res.json();
}

export async function bitrixStats() {
  const res = await fetch(`${BITRIX_MCP_URL}/stats`);
  return res.json();
}

export async function bitrixPollState() {
  const res = await fetch(`${BITRIX_MCP_URL}/poll-state`);
  return res.json();
}

export async function bitrixTriggerPoll() {
  const res = await fetch(`${BITRIX_MCP_URL}/poll`, { method: "POST" });
  return res.json();
}

export async function bitrixCallTool(tool: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`${BITRIX_MCP_URL}/mcp/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, args }),
  });
  return res.json();
}

export async function fetchECSLive(limit = 500) {
  const res = await fetch(`${BITRIX_MCP_URL}/ecs/live?limit=${limit}`);
  return res.json();
}

// ─── Sentiment Agent ───

export async function sentimentHealth() {
  const res = await fetch(`${SENTIMENT_URL}/ecs/health`);
  return res.json();
}

const SPANISH_INSTRUCTIONS = "IMPORTANTE: Responde SIEMPRE completamente en ESPAÑOL. Todos los campos — recommended_action, reasoning, intent_signals, risk_flags — deben estar escritos 100% en español. No mezcles inglés y español. Usa terminología comercial en español de Latinoamérica.";

export async function analyzeSentimentBatch(
  leads: InteractionSummary[],
  signal?: AbortSignal
): Promise<BatchSentimentResponse> {
  // If fallback is already active, go directly to free models
  if (isFallbackActive()) {
    return fallbackAnalyzeSentimentBatch(leads, signal);
  }

  try {
    const res = await fetch(`${SENTIMENT_URL}/ecs/sentiment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leads,
        language: "es",
        system_instructions: SPANISH_INSTRUCTIONS,
      }),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      const isCreditsError =
        res.status === 402 ||
        res.status === 429 ||
        errorText.includes("credit") ||
        errorText.includes("quota") ||
        errorText.includes("rate_limit") ||
        errorText.includes("insufficient");

      if (isCreditsError || res.status >= 500) {
        console.warn(
          `[API] Primary agent failed (${res.status}), activating fallback...`
        );
        activateFallback();
        return fallbackAnalyzeSentimentBatch(leads, signal);
      }
      throw new Error(`Sentiment API returned ${res.status}`);
    }

    // Primary succeeded — deactivate fallback if it was active
    if (getFallbackStatus().active) {
      deactivateFallback();
    }
    return res.json();
  } catch (err) {
    // Network errors or timeouts — try fallback
    if (signal?.aborted) throw err;
    console.warn("[API] Primary agent unreachable, activating fallback...", err);
    activateFallback();
    return fallbackAnalyzeSentimentBatch(leads, signal);
  }
}

export async function analyzeSentimentSingle(
  data: InteractionSummary,
  signal?: AbortSignal
): Promise<SentimentResult> {
  // Delegate to batch (which handles fallback internally)
  const batch = await analyzeSentimentBatch([data], signal);
  return batch.results[0];
}

/** Expose fallback status for UI indicators */
export { getFallbackStatus } from "@/lib/openrouter-fallback";
