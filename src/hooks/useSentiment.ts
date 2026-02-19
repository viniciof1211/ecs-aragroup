import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { sentimentHealth, analyzeSentimentSingle } from "@/lib/api";
import { analyzeAllLeads, buildLeadPayload, SINGLE_LEAD_TIMEOUT_MS, BATCH_SIZE } from "@/lib/sentiment";
import { useSentimentStore } from "@/stores/useSentimentStore";
import type { ECSLead, ECSInteraction, SentimentProgress, SentimentResult } from "@/types/ecs";

// ─── Health Check Hook ───
export function useSentimentHealth() {
  return useQuery({
    queryKey: ["sentiment-health"],
    queryFn: sentimentHealth,
    staleTime: 60_000,
    retry: 2,
  });
}

// ─── Main Sentiment Hook ───
export function useSentiment(leads: ECSLead[], interactions: ECSInteraction[]) {
  const store = useSentimentStore();

  // Hydrate from localStorage on first mount
  useEffect(() => {
    store.hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyzeAll = useCallback(
    async (onProgress?: (p: SentimentProgress) => void) => {
      if (store.isRunning) return;

      const controller = new AbortController();
      store.setAbortController(controller);
      store.setIsRunning(true);
      store.setProgress({ done: 0, total: leads.length, failed: 0, currentBatch: 0, totalBatches: Math.ceil(leads.length / BATCH_SIZE) });

      try {
        const newResults = await analyzeAllLeads(
          leads,
          interactions,
          (p) => {
            store.setProgress(p);
            onProgress?.(p);
          },
          controller.signal,
          (partial) => store.mergeResults(partial)
        );
        store.mergeResults(newResults);
        return newResults;
      } finally {
        store.setIsRunning(false);
        store.setAbortController(null);
      }
    },
    [leads, interactions, store]
  );

  const analyzeNew = useCallback(
    async (onProgress?: (p: SentimentProgress) => void) => {
      const unanalyzed = leads.filter((l) => !store.results[l.id]);
      if (unanalyzed.length === 0) return;

      if (store.isRunning) return;

      const controller = new AbortController();
      store.setAbortController(controller);
      store.setIsRunning(true);
      store.setProgress({ done: 0, total: unanalyzed.length, failed: 0, currentBatch: 0, totalBatches: Math.ceil(unanalyzed.length / BATCH_SIZE) });

      try {
        const newResults = await analyzeAllLeads(
          unanalyzed,
          interactions,
          (p) => {
            store.setProgress(p);
            onProgress?.(p);
          },
          controller.signal,
          (partial) => store.mergeResults(partial)
        );
        store.mergeResults(newResults);
        return newResults;
      } finally {
        store.setIsRunning(false);
        store.setAbortController(null);
      }
    },
    [leads, interactions, store]
  );

  const analyzeSingle = useCallback(
    async (lead: ECSLead): Promise<SentimentResult> => {
      const payload = buildLeadPayload(lead, interactions);
      const result = await analyzeSentimentSingle(
        payload,
        AbortSignal.timeout(SINGLE_LEAD_TIMEOUT_MS)
      );
      store.mergeResults({ [result.lead_id]: result });
      return result;
    },
    [interactions, store]
  );

  const cancel = useCallback(() => {
    store.abortController?.abort();
    store.setIsRunning(false);
    store.setAbortController(null);
  }, [store]);

  const analyzedCount = Object.keys(store.results).length;
  const coverage = leads.length > 0 ? Math.round((analyzedCount / leads.length) * 100) : 0;

  return {
    results: store.results,
    getResult: (leadId: string) => store.results[leadId],
    hasResult: (leadId: string) => leadId in store.results,
    analyzedCount,
    totalLeads: leads.length,
    coverage,
    lastAnalyzedAt: store.lastAnalyzedAt,

    analyzeAll,
    analyzeNew,
    analyzeSingle,
    cancel,

    isRunning: store.isRunning,
    progress: store.progress,

    clearResults: store.clearAll,
  };
}

// Re-export for backward compat
export { useSentimentHealth as useSentimentAnalysis };
