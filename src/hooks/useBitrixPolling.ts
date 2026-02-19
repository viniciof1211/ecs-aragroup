/**
 * Hook that manages Bitrix24 webhook polling every 180s.
 * On each poll cycle, fetches recently modified leads,
 * merges them into the cached leads list, and invalidates
 * React Query caches to trigger UI refresh.
 *
 * Exposes pollNow() for on-demand refresh from any component.
 */
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchRecentLeads,
  mergePolledLeads,
  getPollInterval,
} from "@/lib/bitrix-poller";
import type { ECSLead, ECSInteraction } from "@/types/ecs";
import { create } from "zustand";

// ─── Shared polling state (Zustand) so any component can read/trigger ───
interface BitrixPollState {
  isPolling: boolean;
  lastPollAt: Date | null;
  lastLeadCount: number;
  lastError: string | null;
  totalSynced: number;
  setPolling: (v: boolean) => void;
  setLastPoll: (at: Date, count: number) => void;
  setError: (err: string | null) => void;
  addSynced: (n: number) => void;
}

export const useBitrixPollStore = create<BitrixPollState>((set) => ({
  isPolling: false,
  lastPollAt: null,
  lastLeadCount: 0,
  lastError: null,
  totalSynced: 0,
  setPolling: (v) => set({ isPolling: v }),
  setLastPoll: (at, count) => set({ lastPollAt: at, lastLeadCount: count, lastError: null }),
  setError: (err) => set({ lastError: err, isPolling: false }),
  addSynced: (n) => set((s) => ({ totalSynced: s.totalSynced + n })),
}));

// ─── Singleton reference so pollNow can be called from anywhere ───
let _pollNowFn: (() => Promise<void>) | null = null;

/** Trigger an immediate Bitrix poll from any component */
export function pollBitrixNow(): Promise<void> {
  if (_pollNowFn) return _pollNowFn();
  console.warn("[Bitrix Poll] pollNow called before hook initialized");
  return Promise.resolve();
}

export function useBitrixPolling() {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollRef = useRef<Date | null>(null);
  const doPoll = useCallback(async () => {
    if (useBitrixPollStore.getState().isPolling) {
      console.log("[Bitrix Poll] Already polling, skipping");
      return;
    }

    useBitrixPollStore.getState().setPolling(true);

    try {
      const minutesSinceLastPoll = lastPollRef.current
        ? Math.ceil((Date.now() - lastPollRef.current.getTime()) / 60000) + 1
        : 5;

      console.log(`[Bitrix Poll] Fetching leads modified in last ${minutesSinceLastPoll} min...`);
      const recentLeads = await fetchRecentLeads(minutesSinceLastPoll);
      lastPollRef.current = new Date();

      useBitrixPollStore.getState().setLastPoll(new Date(), recentLeads.length);

      if (recentLeads.length === 0) {
        console.log("[Bitrix Poll] No changes detected");
        useBitrixPollStore.getState().setPolling(false);
        return;
      }

      console.log(`[Bitrix Poll] ${recentLeads.length} leads updated`);
      useBitrixPollStore.getState().addSynced(recentLeads.length);

      // Merge into cached leads
      const cachedLeads = queryClient.getQueryData<ECSLead[]>(["leads"]) ?? [];
      const cachedInteractions =
        queryClient.getQueryData<ECSInteraction[]>(["interactions"]) ?? [];

      const merged = mergePolledLeads(cachedLeads, recentLeads, cachedInteractions);
      merged.sort((a, b) => b.current_score - a.current_score);

      // Update the leads cache directly
      queryClient.setQueryData(["leads"], merged);

      // Invalidate dependent queries so dashboards refresh
      queryClient.invalidateQueries({ queryKey: ["interactions"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Bitrix Poll] Error:", msg);
      useBitrixPollStore.getState().setError(msg);
    } finally {
      useBitrixPollStore.getState().setPolling(false);
    }
  }, [queryClient]);

  // Expose pollNow globally
  useEffect(() => {
    _pollNowFn = doPoll;
    return () => {
      _pollNowFn = null;
    };
  }, [doPoll]);

  useEffect(() => {
    const interval = getPollInterval();

    // Initial poll after a short delay (let app load first)
    const initialTimeout = setTimeout(doPoll, 5000);

    // Recurring polls
    timerRef.current = setInterval(doPoll, interval);
    console.log(`[Bitrix Poll] Started — interval: ${interval / 1000}s`);

    return () => {
      clearTimeout(initialTimeout);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [doPoll]);

  return { pollNow: doPoll };
}
