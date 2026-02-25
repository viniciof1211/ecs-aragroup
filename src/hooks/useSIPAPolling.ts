/**
 * S.I.P.A. Polling Hook — runs analysis every 4 minutes.
 *
 * On each cycle:
 *   1. Loads all leads + interactions from React Query cache
 *   2. Detects which leads are new or have updated interactions
 *   3. Sends them to the SIPA AI engine in batches
 *   4. Stores results + generates alerts
 *   5. Fires browser notifications if configured
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

  // Hydrate on first mount
  useEffect(() => {
    if (!hydratedRef.current) {
      store.hydrate();
      hydratedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAnalysis = useCallback(async () => {
    if (store.isRunning) return;

    // Get cached data from React Query
    const leads = queryClient.getQueryData<ECSLead[]>(["leads"]) ?? [];
    const interactions = queryClient.getQueryData<ECSInteraction[]>(["interactions"]) ?? [];

    if (leads.length === 0) {
      console.log("[SIPA] No leads available, skipping cycle");
      return;
    }

    const controller = new AbortController();
    store.setAbortController(controller);
    store.setIsRunning(true);

    try {
      const { analyses, alerts } = await analyzeSIPABatch(
        leads,
        interactions,
        store.analyses,
        (p) => store.setProgress(p),
        controller.signal
      );

      if (Object.keys(analyses).length > 0) {
        store.mergeAnalyses(analyses);
      }
      if (alerts.length > 0) {
        store.addAlerts(alerts);
        fireBrowserNotifications(alerts.length);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("[SIPA] Analysis cycle failed:", err);
      }
    } finally {
      store.setIsRunning(false);
      store.setAbortController(null);
      store.setProgress(null);
    }
  }, [store, queryClient]);

  // Set up polling interval
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
      store.abortController?.abort();
      store.setIsRunning(false);
      store.setAbortController(null);
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
