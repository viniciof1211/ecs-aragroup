import { create } from "zustand";
import type { SentimentResult, SentimentProgress } from "@/types/ecs";
import { loadCachedResults, saveCachedResults, getCachedTimestamp, clearCachedResults } from "@/lib/sentiment";

interface SentimentState {
  results: Record<string, SentimentResult>;
  progress: SentimentProgress | null;
  isRunning: boolean;
  lastAnalyzedAt: string | null;
  abortController: AbortController | null;

  // Actions
  setResults: (results: Record<string, SentimentResult>) => void;
  mergeResults: (newResults: Record<string, SentimentResult>) => void;
  setProgress: (progress: SentimentProgress | null) => void;
  setIsRunning: (running: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  getResult: (leadId: string) => SentimentResult | undefined;
  clearAll: () => void;
  hydrate: () => void;
}

export const useSentimentStore = create<SentimentState>()((set, get) => ({
  results: {},
  progress: null,
  isRunning: false,
  lastAnalyzedAt: null,
  abortController: null,

  setResults: (results) => {
    set({ results, lastAnalyzedAt: new Date().toISOString() });
    saveCachedResults(results);
  },

  mergeResults: (newResults) => {
    const merged = { ...get().results, ...newResults };
    set({ results: merged, lastAnalyzedAt: new Date().toISOString() });
    saveCachedResults(merged);
  },

  setProgress: (progress) => set({ progress }),

  setIsRunning: (isRunning) => set({ isRunning }),

  setAbortController: (abortController) => set({ abortController }),

  getResult: (leadId) => get().results[leadId],

  clearAll: () => {
    set({ results: {}, progress: null, lastAnalyzedAt: null });
    clearCachedResults();
  },

  hydrate: () => {
    const cached = loadCachedResults();
    const timestamp = getCachedTimestamp();
    if (Object.keys(cached).length > 0) {
      set({ results: cached, lastAnalyzedAt: timestamp });
    }
  },
}));
