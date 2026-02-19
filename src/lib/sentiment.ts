import { analyzeSentimentBatch } from "@/lib/api";
import type {
  ECSLead,
  ECSInteraction,
  InteractionSummary,
  SentimentResult,
  SentimentProgress,
} from "@/types/ecs";

// ─── Constants ───
export const BATCH_SIZE = 10;
export const MAX_CONCURRENT_BATCHES = 1;
export const BATCH_TIMEOUT_MS = 120_000;
export const SINGLE_LEAD_TIMEOUT_MS = 60_000;
export const MAX_RETRIES = 2;
export const RETRY_DELAY_MS = 3_000;
export const INTER_BATCH_DELAY_MS = 1_500;

// ─── Build Payload ───

export function buildLeadPayload(
  lead: ECSLead,
  allInteractions: ECSInteraction[]
): InteractionSummary {
  const leadInteractions = allInteractions.filter(
    (ix) => ix.lead_id === lead.id
  );

  const directionBreakdown: Record<string, number> = {};
  const typeBreakdown: Record<string, number> = {};
  let totalResponseSeconds = 0;
  let totalDurationSeconds = 0;
  const ratings: number[] = [];

  for (const ix of leadInteractions) {
    directionBreakdown[ix.direction] =
      (directionBreakdown[ix.direction] || 0) + 1;
    typeBreakdown[ix.type] = (typeBreakdown[ix.type] || 0) + 1;
    totalResponseSeconds += ix.avg_response_seconds ?? 0;
    totalDurationSeconds += ix.duration_seconds ?? 0;
    if (ix.client_rating && ix.client_rating > 0) {
      ratings.push(ix.client_rating);
    }
  }

  return {
    lead_id: lead.id,
    lead_name: lead.name,
    total_conversations: lead.interaction_count,
    total_messages: lead.total_messages,
    channels: lead.channels ?? [],
    employees: lead.employees ?? [],
    avg_response_seconds:
      leadInteractions.length > 0
        ? totalResponseSeconds / leadInteractions.length
        : 0,
    avg_duration_seconds:
      leadInteractions.length > 0
        ? totalDurationSeconds / leadInteractions.length
        : 0,
    client_ratings: ratings,
    interaction_types: typeBreakdown,
    first_seen: lead.first_seen,
    last_seen: lead.last_seen,
    direction_breakdown: directionBreakdown,
  };
}

// ─── Helpers ───

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}

// ─── Batch Processing ───

export async function analyzeAllLeads(
  leads: ECSLead[],
  interactions: ECSInteraction[],
  onProgress: (progress: SentimentProgress) => void,
  abortSignal?: AbortSignal,
  onPartialResults?: (partial: Record<string, SentimentResult>) => void
): Promise<Record<string, SentimentResult>> {
  const batches: ECSLead[][] = [];
  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    batches.push(leads.slice(i, i + BATCH_SIZE));
  }

  const allResults: Record<string, SentimentResult> = {};
  let doneCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;

  const processBatch = async (
    batch: ECSLead[],
    batchIdx: number
  ): Promise<void> => {
    if (abortSignal?.aborted) return;

    const payload = batch.map((lead) =>
      buildLeadPayload(lead, interactions)
    );

    let attempt = 0;
    let success = false;

    while (attempt <= MAX_RETRIES && !success) {
      if (abortSignal?.aborted) return;

      try {
        if (attempt > 0) {
          console.warn(`Batch ${batchIdx + 1}: retry ${attempt}/${MAX_RETRIES}`);
          await delay(RETRY_DELAY_MS * attempt, abortSignal);
        }

        const timeoutSignal = AbortSignal.timeout(BATCH_TIMEOUT_MS);
        const combinedSignal = abortSignal
          ? AbortSignal.any([abortSignal, timeoutSignal])
          : timeoutSignal;

        const data = await analyzeSentimentBatch(payload, combinedSignal);

        if (data.results && data.results.length > 0) {
          for (const result of data.results) {
            allResults[result.lead_id] = result;
          }
          doneCount += batch.length;
          success = true;

          // Flush partial results to store so they persist even if cancelled
          onPartialResults?.(allResults);
        } else {
          throw new Error("API returned empty results array");
        }
      } catch (err) {
        if (abortSignal?.aborted) return;
        attempt++;
        const errMsg = err instanceof Error ? err.message : String(err);
        lastError = `Lote ${batchIdx + 1}: ${errMsg}`;
        console.error(`Batch ${batchIdx + 1} attempt ${attempt} error:`, errMsg);

        if (attempt > MAX_RETRIES) {
          failedCount += batch.length;
        }
      }
    }

    onProgress({
      done: doneCount,
      total: leads.length,
      failed: failedCount,
      currentBatch: batchIdx + 1,
      totalBatches: batches.length,
      lastError,
    });
  };

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    if (abortSignal?.aborted) break;
    const chunk = batches.slice(i, i + MAX_CONCURRENT_BATCHES);
    await Promise.all(
      chunk.map((batch, j) => processBatch(batch, i + j))
    );

    // Delay between batch groups to avoid hammering the API
    if (i + MAX_CONCURRENT_BATCHES < batches.length && !abortSignal?.aborted) {
      try {
        await delay(INTER_BATCH_DELAY_MS, abortSignal);
      } catch { /* abort */ break; }
    }
  }

  return allResults;
}

// ─── localStorage Persistence ───

const STORAGE_KEY = "ecs-sentiment-results";
const TIMESTAMP_KEY = "ecs-sentiment-analyzed-at";

export function loadCachedResults(): Record<string, SentimentResult> {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

export function saveCachedResults(
  results: Record<string, SentimentResult>
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString());
  } catch {
    console.warn("Failed to persist sentiment results to localStorage");
  }
}

export function getCachedTimestamp(): string | null {
  return localStorage.getItem(TIMESTAMP_KEY);
}

export function clearCachedResults(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TIMESTAMP_KEY);
}
