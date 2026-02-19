/**
 * Meta Marketing API / Ads Manager / Business Manager types
 * Covers campaigns, ad sets, ads, posts, and page insights.
 */

// ─── Campaign ───
export interface MetaCampaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  objective: string;
  daily_budget?: number;
  lifetime_budget?: number;
  start_time: string;
  stop_time?: string;
  created_time: string;
  updated_time: string;
  insights?: MetaInsights;
}

// ─── Ad Set ───
export interface MetaAdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  targeting_summary?: string;
  daily_budget?: number;
  lifetime_budget?: number;
  start_time: string;
  end_time?: string;
  insights?: MetaInsights;
}

// ─── Ad ───
export interface MetaAd {
  id: string;
  ad_set_id: string;
  campaign_id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";
  creative_id?: string;
  creative_thumbnail_url?: string;
  creative_title?: string;
  creative_body?: string;
  preview_url?: string;
  created_time: string;
  updated_time: string;
  insights?: MetaInsights;
}

// ─── Page Post ───
export interface MetaPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  updated_time?: string;
  type: "photo" | "video" | "link" | "status" | "offer" | "event" | "reel" | "story" | "carousel" | "unknown";
  permalink_url?: string;
  full_picture?: string;
  // Engagement metrics
  likes: number;
  comments: number;
  shares: number;
  reactions_total: number;
  reach: number;
  impressions: number;
  clicks: number;
  engagement_rate: number;
  // Derived
  is_promoted: boolean;
  ad_id?: string;
  // Effectiveness tracking
  effectiveness_score?: number;
  effectiveness_trend?: number;
}

// ─── Insights (shared metrics) ───
export interface MetaInsights {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency: number;
  // Conversion metrics
  leads: number;
  conversions: number;
  cost_per_lead: number;
  cost_per_conversion: number;
  conversion_rate: number;
  // Engagement
  post_engagement: number;
  page_engagement: number;
  link_clicks: number;
  // Video
  video_views?: number;
  video_avg_time?: number;
  // Date range
  date_start: string;
  date_stop: string;
}

// ─── Time-series data point ───
export interface MetaInsightPoint {
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  leads: number;
  conversions: number;
  cpl: number;
  ctr: number;
  engagement: number;
}

// ─── Post effectiveness over time ───
export interface PostEffectivenessPoint {
  date: string;
  post_type: string;
  engagement_rate: number;
  reach: number;
  clicks: number;
  conversions: number;
  effectiveness_score: number;
}

// ─── Audience segment from Meta ───
export interface MetaAudienceSegment {
  id: string;
  name: string;
  size: number;
  type: "custom" | "lookalike" | "saved" | "interest";
  description?: string;
}

// ─── AI Recommendation ───
export interface MetaAdRecommendation {
  id: string;
  type: "optimize_ad" | "pause_ad" | "increase_budget" | "new_content" | "retarget" | "ab_test" | "heat_segment";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  target_id?: string;
  target_name?: string;
  expected_impact: string;
  action_items: string[];
}

// ─── Aggregate metrics for KPI module ───
export interface MetaAggregateMetrics {
  total_spend: number;
  total_impressions: number;
  total_reach: number;
  total_clicks: number;
  total_leads: number;
  total_conversions: number;
  avg_cpl: number;
  avg_cpc: number;
  avg_ctr: number;
  avg_cpm: number;
  avg_frequency: number;
  roas: number;
  total_engagement: number;
  total_video_views: number;
  active_campaigns: number;
  active_ads: number;
  total_posts: number;
  avg_post_engagement_rate: number;
  best_performing_campaign?: string;
  best_performing_ad?: string;
  best_post_type?: string;
}

// ─── Post type labels ───
export const POST_TYPE_LABELS: Record<string, string> = {
  photo: "Foto",
  video: "Video",
  link: "Enlace",
  status: "Estado",
  offer: "Oferta",
  event: "Evento",
  reel: "Reel",
  story: "Historia",
  carousel: "Carrusel",
  unknown: "Otro",
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  DELETED: "Eliminada",
  ARCHIVED: "Archivada",
};

export const CAMPAIGN_OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: "Generación de Leads",
  OUTCOME_TRAFFIC: "Tráfico",
  OUTCOME_AWARENESS: "Reconocimiento",
  OUTCOME_ENGAGEMENT: "Interacción",
  OUTCOME_SALES: "Ventas",
  OUTCOME_APP_PROMOTION: "Promoción de App",
  LEAD_GENERATION: "Generación de Leads",
  LINK_CLICKS: "Clics en Enlace",
  CONVERSIONS: "Conversiones",
  REACH: "Alcance",
  BRAND_AWARENESS: "Reconocimiento de Marca",
  POST_ENGAGEMENT: "Interacción con Publicación",
  VIDEO_VIEWS: "Vistas de Video",
  MESSAGES: "Mensajes",
};
