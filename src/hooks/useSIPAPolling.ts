/**
 * S.I.P.A. Polling Hook — runs analysis every 4 minutes.
 *
 * On each cycle:
 *   1. Loads all leads + interactions from React Query cache
 *   2. Detects which leads are new or have updated interactions
 *   3. Sends them to the SIPA AI engine in batches
 *   4. Stores results + generates alerts (incrementally per-batch)
 *   5. Fires browser notifications if configured
 *
 * Uses refs for store/queryClient access so the polling interval
 * is stable and doesn't restart on every Zustand state change.
 */

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSIPAStore } from "@/stores/useSIPAStore";
import { analyzeSIPABatch } from "@/lib/sipa-engine";
import type { ECSLead, ECSInteraction } from "@/types/ecs";

const SIPA_POLL_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

export function useSIPAPolling() {
  const store = useSIPAStore();
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hydratedRef = useRef(false);

  // Keep stable refs to avoid re-creating runAnalysis on every store change
  const storeRef = useRef(store);
  storeRef.current = store;
  const qcRef = useRef(queryClient);
  qcRef.current = queryClient;

  // Hydrate on first mount
  useEffect(() => {
    if (!hydratedRef.current) {
      storeRef.current.hydrate();
      hydratedRef.current = true;
    }
  }, []);

  // Stable runAnalysis — no dependency on store, so interval never restarts
  const runAnalysis = useCallback(async () => {
    const s = storeRef.current;
    const qc = qcRef.current;

    if (s.isRunning) return;

    // Get cached data from React Query
    const leads = qc.getQueryData<ECSLead[]>(["leads"]) ?? [];
    const interactions = qc.getQueryData<ECSInteraction[]>(["interactions"]) ?? [];

    if (leads.length === 0) {
      console.log("[SIPA] No leads available, skipping cycle");
      return;
    }

    const controller = new AbortController();
    s.setAbortController(controller);
    s.setIsRunning(true);

    try {
      // Read current analyses snapshot at start (includes localStorage-persisted data)
      const existingAnalyses = useSIPAStore.getState().analyses;

      const { analyses, alerts } = await analyzeSIPABatch(
        leads,
        interactions,
        existingAnalyses,
        (p) => useSIPAStore.getState().setProgress(p),
        controller.signal,
        // Incremental save callback — called after each successful batch
        (batchAnalyses, batchAlerts) => {
          const current = useSIPAStore.getState();
          if (Object.keys(batchAnalyses).length > 0) {
            current.mergeAnalyses(batchAnalyses);
          }
          if (batchAlerts.length > 0) {
            current.addAlerts(batchAlerts);
          }
        }
      );

      // Final merge for anything not yet saved (shouldn't be needed but safe)
      if (Object.keys(analyses).length > 0) {
        useSIPAStore.getState().mergeAnalyses(analyses);
      }
      if (alerts.length > 0) {
        useSIPAStore.getState().addAlerts(alerts);
        fireBrowserNotifications(alerts.length);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("[SIPA] Analysis cycle failed:", err);
      }
    } finally {
      useSIPAStore.getState().setIsRunning(false);
      useSIPAStore.getState().setAbortController(null);
      // NOTE: Do NOT clear progress here — preserve it so errors remain visible in UI
    }
  }, []);

  // Set up polling interval — stable because runAnalysis never changes
  useEffect(() => {
    // Run first analysis after 30s to let data load
    const initialTimeout = setTimeout(() => {
      runAnalysis();
    }, 30_000);

    intervalRef.current = setInterval(runAnalysis, SIPA_POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runAnalysis]);

  return {
    runNow: runAnalysis,
    cancel: () => {
      const s = useSIPAStore.getState();
      s.abortController?.abort();
      s.setIsRunning(false);
      s.setAbortController(null);
    },
  };
}

// ─── Browser Notifications ───

function fireBrowserNotifications(alertCount: number) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("S.I.P.A. — Nuevas Alertas", {
      body: `Se generaron ${alertCount} nuevas alertas proactivas. Revisa el panel SIPA.`,
      icon: "/ecs-logo-192.png",
      tag: "sipa-alert",
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}
