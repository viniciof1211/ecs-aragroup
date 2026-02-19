// ─── Lead ───
export interface ECSLead {
  id: string;
  lead_id: string;
  bitrix_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  brand: string | null;
  source: string | null;
  status: LeadStatus;
  channels: string[];
  employees: string[];
  interaction_count: number;
  total_messages: number;
  first_seen: string | null;
  last_seen: string | null;
  bitrix_lead_ids: number[];
  current_score: number;
  previous_score: number;
  segment: Segment;
  created_at: string;
  last_interaction_at: string | null;
  bitrix_raw: Record<string, unknown> | null;
  updated_at: string;
  // Extended Bitrix fields
  etapa_bitrix?: string | null;
  loss_reason?: string | null;
  loss_reason_raw?: string | null;
  budget_range?: string | null;
  project_timeline?: string | null;
  client_type?: string | null;
  project_type?: string | null;
  design_type?: string | null;
  designing?: string | null;
  product_sold?: string | null;
  profile?: string | null;
  cargo?: string | null;
  total_amount?: number;
  currency?: string | null;
  sucursal?: string | null;
  division?: string | null;
  utm_source?: string | null;
  score_breakdown?: ECSScoreBreakdown | null;
}

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type Segment = "hot" | "warm" | "cool" | "cold" | "dormant" | "lost";

// ─── Interaction ───
export interface ECSInteraction {
  id: string;
  lead_id: string;
  bitrix_conversation_id: number | null;
  bitrix_lead_id: number | null;
  bitrix_activity_id: number | null;
  type: InteractionType;
  channel: string;
  direction: "entrante" | "saliente" | "unknown";
  status: string | null;
  timestamp: string;
  agent_replied_at: string | null;
  last_message_at: string | null;
  agent_closed_at: string | null;
  message_count: number | null;
  duration_seconds: number | null;
  first_response_seconds: number | null;
  avg_response_seconds: number | null;
  client_rating: number | null;
  employee: string | null;
  source: string | null;
  raw_weight: number | null;
  decayed_weight: number | null;
  bitrix_raw: Record<string, unknown> | null;
  updated_at: string;
}

export type InteractionType =
  | "lead_created"
  | "status_changed"
  | "note_added"
  | "call"
  | "email_sent"
  | "email_received"
  | "whatsapp"
  | "meeting"
  | "quote_sent"
  | "deal_won"
  | "deal_lost"
  | "form_submitted"
  | "page_visited"
  | "chat"
  | "web_visit"
  | "showroom_visit"
  | "facebook_lead"
  | "stage_change"
  | "contact_attempt"
  | "budget_qualified"
  | "design_request";

// ─── ECS Score ───
export interface ECSScoreBreakdown {
  recency: number;
  frequency: number;
  depth: number;
  channelDiversity: number;
  velocity: number;
  total: number;
}

export interface ECSScore {
  id: string;
  lead_id: string;
  score: number;
  previous_score: number;
  delta: number;
  trend: "up" | "down" | "stable";
  breakdown: ECSScoreBreakdown;
  calculated_at: string;
  version: number;
}

// ─── Sentiment ───
export interface InteractionSummary {
  lead_id: string;
  lead_name: string;
  total_conversations: number;
  total_messages: number;
  channels: string[];
  employees: string[];
  avg_response_seconds: number;
  avg_duration_seconds: number;
  client_ratings: number[];
  interaction_types: Record<string, number>;
  first_seen: string | null;
  last_seen: string | null;
  direction_breakdown: Record<string, number>;
}

export interface BatchSentimentRequest {
  leads: InteractionSummary[];
}

export interface BatchSentimentResponse {
  results: SentimentResult[];
  model_used: string;
  analyzed_at: string;
  total_leads: number;
}

export interface SentimentResult {
  lead_id: string;
  lead_name: string;
  sentiment_score: number;
  sentiment_label: "very_positive" | "positive" | "neutral" | "negative" | "very_negative";
  engagement_quality: "excellent" | "good" | "moderate" | "poor" | "minimal";
  intent_signals: string[];
  risk_flags: string[];
  recommended_action: string;
  ecs_sentiment_bonus: number;
  reasoning: string;
}

export interface SentimentProgress {
  done: number;
  total: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  lastError?: string | null;
}

// Keep old SentimentRequest as alias for backward compat
export type SentimentRequest = InteractionSummary;

// ─── Automation ───
export type RuleConditionType =
  | "score_above"
  | "score_below"
  | "score_drop_by"
  | "score_rise_by"
  | "segment_change"
  | "no_interaction_days"
  | "channel_inactive";

export type RuleActionType =
  | "send_email"
  | "send_whatsapp"
  | "assign_agent"
  | "create_task"
  | "notify_sales"
  | "move_segment"
  | "schedule_call"
  | "add_tag";

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  active: boolean;
  conditions: Array<{
    type: RuleConditionType;
    value: number | string;
    operator?: "gt" | "lt" | "eq" | "gte" | "lte";
  }>;
  actions: Array<{
    type: RuleActionType;
    params: Record<string, unknown>;
  }>;
  triggerCount: number;
  lastTriggered: string | null;
  createdAt: string;
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  leadId: string;
  leadName: string;
  action: string;
  result: "success" | "failure";
  timestamp: string;
  details: string;
}

// ─── Analytics ───
export interface ChannelStats {
  channel: string;
  count: number;
  avgScore: number;
  avgResponseTime: number;
  conversionRate: number;
}

export interface EmployeeStats {
  employee: string;
  avgScore: number;
  responseTime: number;
  conversionRate: number;
  activeLeads: number;
  totalInteractions: number;
}

export interface ChurnRisk {
  leadId: string;
  leadName: string;
  currentScore: number;
  riskProbability: number;
  riskFactors: string[];
  recommendedIntervention: string;
  daysSinceLastInteraction: number;
  scoreTrend: "up" | "down" | "stable";
}

export interface PriorityAction {
  leadId: string;
  leadName: string;
  currentScore: number;
  segment: Segment;
  recommendedAction: string;
  channel: string;
  urgency: "high" | "medium" | "low";
  expectedImpact: number;
  reasoning: string;
}

// ─── Segment Config ───
export interface SegmentConfig {
  name: Segment;
  label: string;
  min: number;
  max: number;
  color: string;
  bgColor: string;
  textColor: string;
  icon: string;
}

export const SEGMENT_CONFIGS: SegmentConfig[] = [
  { name: "hot", label: "Caliente", min: 80, max: 100, color: "rgb(239,68,68)", bgColor: "bg-red-500/10", textColor: "text-red-600 dark:text-red-400", icon: "🔴" },
  { name: "warm", label: "Tibio", min: 60, max: 79, color: "rgb(249,115,22)", bgColor: "bg-orange-500/10", textColor: "text-orange-600 dark:text-orange-400", icon: "🟠" },
  { name: "cool", label: "Fresco", min: 40, max: 59, color: "rgb(234,179,8)", bgColor: "bg-yellow-500/10", textColor: "text-yellow-600 dark:text-yellow-400", icon: "🟡" },
  { name: "cold", label: "Frío", min: 20, max: 39, color: "rgb(59,130,246)", bgColor: "bg-blue-500/10", textColor: "text-blue-600 dark:text-blue-400", icon: "🔵" },
  { name: "dormant", label: "Inactivo", min: 5, max: 19, color: "rgb(100,116,139)", bgColor: "bg-slate-500/10", textColor: "text-slate-600 dark:text-slate-400", icon: "⚫" },
  { name: "lost", label: "Perdido", min: 0, max: 4, color: "rgb(156,163,175)", bgColor: "bg-gray-400/10", textColor: "text-gray-500 dark:text-gray-400", icon: "⬜" },
];

export function getSegmentConfig(segment: Segment): SegmentConfig {
  return SEGMENT_CONFIGS.find((s) => s.name === segment) ?? SEGMENT_CONFIGS[5];
}

export function getSegmentFromScore(score: number): Segment {
  if (score >= 80) return "hot";
  if (score >= 60) return "warm";
  if (score >= 40) return "cool";
  if (score >= 20) return "cold";
  if (score >= 5) return "dormant";
  return "lost";
}

// ─── Status Labels ───
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  proposal: "Propuesta",
  negotiation: "Negociación",
  won: "Ganado",
  lost: "Perdido",
};

export const INTERACTION_TYPE_LABELS: Record<string, string> = {
  lead_created: "Lead creado",
  status_changed: "Cambio de estado",
  note_added: "Nota agregada",
  call: "Llamada",
  email_sent: "Email enviado",
  email_received: "Email recibido",
  whatsapp: "WhatsApp",
  meeting: "Reunión",
  quote_sent: "Cotización enviada",
  deal_won: "Negocio ganado",
  deal_lost: "Negocio perdido",
  form_submitted: "Formulario",
  page_visited: "Página visitada",
  chat: "Chat",
  web_visit: "Visita web",
  showroom_visit: "Visita Showroom",
  facebook_lead: "Lead Facebook",
  stage_change: "Cambio de etapa",
  contact_attempt: "Intento de contacto",
  budget_qualified: "Presupuesto calificado",
  design_request: "Solicitud de diseño",
};

export const CHANNEL_LABELS: Record<string, string> = {
  bitrix: "Bitrix",
  whatsapp: "WhatsApp",
  phone: "Teléfono",
  email: "Email",
  web: "Web",
  facebook: "Facebook",
  instagram: "Instagram",
  telegram: "Telegram",
  showroom: "Showroom",
  referral: "Referido",
  chat: "Chat",
  other: "Otro",
  unknown: "Desconocido",
};

// ─── Score History (longitudinal) ───
export interface ScoreSnapshot {
  lead_id: string;
  score: number;
  previous_score: number;
  delta: number;
  trend: "up" | "down" | "stable";
  calculated_at: string;
  interaction_count: number;
}
