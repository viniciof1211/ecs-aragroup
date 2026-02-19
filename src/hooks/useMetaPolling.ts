/**
 * Hook that manages Meta Marketing API polling every 240s.
 * Fetches campaigns, ads, posts, and insights from Meta Graph API.
 * Similar pattern to useBitrixPolling.ts.
 */
import { useEffect, useRef, useCallback } from "react";
import { useMetaAdsStore } from "@/stores/useMetaAdsStore";
import { getMetaPollInterval } from "@/lib/meta-api";

let _pollMetaNowFn: (() => Promise<void>) | null = null;

/** Trigger an immediate Meta poll from any component */
export function pollMetaNow(): Promise<void> {
  if (_pollMetaNowFn) return _pollMetaNowFn();
  console.warn("[Meta Poll] pollNow called before hook initialized");
  return Promise.resolve();
}

export function useMetaPolling() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchAll = useMetaAdsStore((s) => s.fetchAll);

  const doPoll = useCallback(async () => {
    console.log("[Meta Poll] Fetching Meta Marketing data...");
    await fetchAll();
  }, [fetchAll]);

  // Expose pollNow globally
  useEffect(() => {
    _pollMetaNowFn = doPoll;
    return () => { _pollMetaNowFn = null; };
  }, [doPoll]);

  useEffect(() => {
    const interval = getMetaPollInterval();

    // Initial fetch after short delay
    const initialTimeout = setTimeout(doPoll, 3000);

    // Recurring polls
    timerRef.current = setInterval(doPoll, interval);
    console.log(`[Meta Poll] Started — interval: ${interval / 1000}s`);

    return () => {
      clearTimeout(initialTimeout);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [doPoll]);

  return { pollMetaNow: doPoll };
}
