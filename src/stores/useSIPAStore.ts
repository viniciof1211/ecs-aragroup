/**
 * S.I.P.A. Zustand Store — persists analyses, alerts, and notification config.
 */

import { create } from "zustand";
import type {
  SIPALeadAnalysis,
  SIPAAlert,
  SIPANotificationConfig,
  SIPAProgress,
} from "@/types/sipa";
import {
  loadCachedAnalyses,
  saveCachedAnalyses,
  loadCachedAlerts,
  saveCachedAlerts,
  loadNotificationConfig,
  saveNotificationConfig,
  clearSIPACache,
} from "@/lib/sipa-engine";

interface SIPAState {
  analyses: Record<string, SIPALeadAnalysis>;
  alerts: SIPAAlert[];
  progress: SIPAProgress | null;
  isRunning: boolean;
  lastRunAt: string | null;
  abortController: AbortController | null;
  notificationConfig: SIPANotificationConfig;

  // Actions
  mergeAnalyses: (newAnalyses: Record<string, SIPALeadAnalysis>) => void;
  addAlerts: (newAlerts: SIPAAlert[]) => void;
  markAlertRead: (alertId: string) => void;
  markAllAlertsRead: () => void;
  dismissAlert: (alertId: string) => void;
  completeActionItem: (leadId: string, actionId: string) => void;
  dismissActionItem: (leadId: string, actionId: string) => void;
  setProgress: (progress: SIPAProgress | null) => void;
  setIsRunning: (running: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  setNotificationConfig: (config: Partial<SIPANotificationConfig>) => void;
  clearAll: () => void;
  hydrate: () => void;
}

const DEFAULT_NOTIFICATION_CONFIG: SIPANotificationConfig = {
  enabled: true,
  channels: ["browser"],
  email_recipients: [],
  whatsapp_numbers: [],
  min_severity: "warning",
  quiet_hours: null,
};

export const useSIPAStore = create<SIPAState>()((set, get) => ({
  analyses: {},
  alerts: [],
  progress: null,
  isRunning: false,
  lastRunAt: null,
  abortController: null,
  notificationConfig: DEFAULT_NOTIFICATION_CONFIG,

  mergeAnalyses: (newAnalyses) => {
    const merged = { ...get().analyses, ...newAnalyses };
    set({ analyses: merged, lastRunAt: new Date().toISOString() });
    saveCachedAnalyses(merged);
  },

  addAlerts: (newAlerts) => {
    if (newAlerts.length === 0) return;
    // Deduplicate by checking lead_id + title
    const existing = get().alerts;
    const existingKeys = new Set(existing.map((a) => `${a.lead_id}:${a.title}`));
    const unique = newAlerts.filter((a) => !existingKeys.has(`${a.lead_id}:${a.title}`));
    const merged = [...unique, ...existing].slice(0, 500); // cap at 500
    set({ alerts: merged });
    saveCachedAlerts(merged);
  },

  markAlertRead: (alertId) => {
    const alerts = get().alerts.map((a) =>
      a.id === alertId ? { ...a, read: true } : a
    );
    set({ alerts });
    saveCachedAlerts(alerts);
  },

  markAllAlertsRead: () => {
    const alerts = get().alerts.map((a) => ({ ...a, read: true }));
    set({ alerts });
    saveCachedAlerts(alerts);
  },

  dismissAlert: (alertId) => {
    const alerts = get().alerts.filter((a) => a.id !== alertId);
    set({ alerts });
    saveCachedAlerts(alerts);
  },

  completeActionItem: (leadId, actionId) => {
    const analyses = { ...get().analyses };
    const analysis = analyses[leadId];
    if (!analysis) return;
    analyses[leadId] = {
      ...analysis,
      action_items: analysis.action_items.map((item) =>
        item.id === actionId
          ? { ...item, completed: true, completed_at: new Date().toISOString() }
          : item
      ),
      timeline_events: analysis.timeline_events.map((ev) =>
        ev.id === `tl_${actionId}` ? { ...ev, completed: true } : ev
      ),
    };
    set({ analyses });
    saveCachedAnalyses(analyses);
  },

  dismissActionItem: (leadId, actionId) => {
    const analyses = { ...get().analyses };
    const analysis = analyses[leadId];
    if (!analysis) return;
    analyses[leadId] = {
      ...analysis,
      action_items: analysis.action_items.map((item) =>
        item.id === actionId ? { ...item, dismissed: true } : item
      ),
    };
    set({ analyses });
    saveCachedAnalyses(analyses);
  },

  setProgress: (progress) => set({ progress }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setAbortController: (abortController) => set({ abortController }),

  setNotificationConfig: (partial) => {
    const config = { ...get().notificationConfig, ...partial };
    set({ notificationConfig: config });
    saveNotificationConfig(config);
  },

  clearAll: () => {
    set({
      analyses: {},
      alerts: [],
      progress: null,
      lastRunAt: null,
    });
    clearSIPACache();
  },

  hydrate: () => {
    const analyses = loadCachedAnalyses();
    const alerts = loadCachedAlerts();
    const config = loadNotificationConfig();
    set({
      analyses,
      alerts,
      notificationConfig: config ?? DEFAULT_NOTIFICATION_CONFIG,
      lastRunAt: Object.keys(analyses).length > 0
        ? Object.values(analyses)[0]?.analyzed_at ?? null
        : null,
    });
  },
}));
