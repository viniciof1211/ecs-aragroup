/**
 * S.I.P.A. — Sentiment Interaction Proactive Alerting
 *
 * Types for the proactive alerting system that analyzes all lead interactions
 * and generates actionable appointments, reminders, and follow-ups.
 */

// ─── SIPA Action Item (appointment, reminder, follow-up, AR) ───

export type SIPAActionType =
  | "appointment"
  | "follow_up"
  | "reminder"
  | "ar"           // Action Required by salesman
  | "callback"
  | "quote_follow_up"
  | "design_review"
  | "showroom_visit"
  | "closing_attempt"
  | "escalation";

export type SIPATimeframe =
  | "immediate"    // within 1 hour
  | "today"        // same day
  | "short_term"   // 1-3 days
  | "mid_term"     // 1-2 weeks
  | "long_term";   // 2+ weeks

export type SIPAPriority = "critical" | "high" | "medium" | "low";

export interface SIPAActionItem {
  id: string;
  lead_id: string;
  lead_name: string;
  employee: string | null;
  type: SIPAActionType;
  timeframe: SIPATimeframe;
  priority: SIPAPriority;
  title: string;
  description: string;
  due_date: string;          // ISO date string
  created_at: string;
  completed: boolean;
  completed_at: string | null;
  dismissed: boolean;
  source_interaction_ids: string[];  // interactions that triggered this
}

// ─── SIPA Alert ───

export type SIPAAlertSeverity = "critical" | "warning" | "info";

export interface SIPAAlert {
  id: string;
  lead_id: string;
  lead_name: string;
  employee: string | null;
  severity: SIPAAlertSeverity;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  action_item_id: string | null;  // linked action item
  notified_channels: string[];    // which channels were notified
}

// ─── SIPA Lead Analysis (full AI analysis per lead) ───

export interface SIPALeadAnalysis {
  lead_id: string;
  lead_name: string;
  analyzed_at: string;
  interaction_count: number;
  interaction_hash: string;      // hash to detect changes
  summary: string;               // AI-generated summary of all interactions
  health_score: number;          // 0-100, likelihood of conversion
  risk_level: SIPAPriority;
  key_insights: string[];
  action_items: SIPAActionItem[];
  timeline_events: SIPATimelineEvent[];
}

// ─── Timeline Event (for Gantt chart) ───

export interface SIPATimelineEvent {
  id: string;
  lead_id: string;
  lead_name: string;
  employee: string | null;
  type: "past_interaction" | "scheduled_action" | "milestone";
  label: string;
  start_date: string;
  end_date: string | null;
  color: string;
  completed: boolean;
}

// ─── Notification Settings ───

export type SIPANotificationChannel = "email" | "browser" | "whatsapp";

export interface SIPANotificationConfig {
  enabled: boolean;
  channels: SIPANotificationChannel[];
  email_recipients: string[];
  whatsapp_numbers: string[];
  min_severity: SIPAAlertSeverity;  // only alert above this severity
  quiet_hours: { start: string; end: string } | null;  // e.g. "22:00" - "07:00"
}

// ─── SIPA Progress ───

export interface SIPAProgress {
  done: number;
  total: number;
  failed: number;
  phase: "analyzing" | "generating" | "notifying" | "idle";
  lastError?: string;
}

// ─── AI Response Schema (what we expect from the LLM) ───

export interface SIPAAIResponse {
  lead_id: string;
  lead_name: string;
  summary: string;
  health_score: number;
  risk_level: "critical" | "high" | "medium" | "low";
  key_insights: string[];
  action_items: Array<{
    type: SIPAActionType;
    timeframe: SIPATimeframe;
    priority: "critical" | "high" | "medium" | "low";
    title: string;
    description: string;
    suggested_date: string;
    employee: string | null;
  }>;
}

// ─── Labels ───

export const SIPA_ACTION_LABELS: Record<SIPAActionType, string> = {
  appointment: "Cita",
  follow_up: "Seguimiento",
  reminder: "Recordatorio",
  ar: "Acción Requerida",
  callback: "Devolución de llamada",
  quote_follow_up: "Seguimiento cotización",
  design_review: "Revisión de diseño",
  showroom_visit: "Visita showroom",
  closing_attempt: "Intento de cierre",
  escalation: "Escalamiento",
};

export const SIPA_TIMEFRAME_LABELS: Record<SIPATimeframe, string> = {
  immediate: "Inmediato",
  today: "Hoy",
  short_term: "1-3 días",
  mid_term: "1-2 semanas",
  long_term: "2+ semanas",
};

export const SIPA_PRIORITY_LABELS: Record<SIPAPriority, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

export const SIPA_PRIORITY_COLORS: Record<SIPAPriority, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export const SIPA_SEVERITY_COLORS: Record<SIPAAlertSeverity, string> = {
  critical: "#ef4444",
  warning: "#f97316",
  info: "#3b82f6",
};
