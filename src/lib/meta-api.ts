/**
 * Meta Marketing API Client
 * Fetches campaigns, ad sets, ads, posts, and insights from Meta Graph API.
 * Uses a long-lived access token stored in VITE_META_ACCESS_TOKEN.
 * 
 * Meta Graph API v21.0
 * Admin: vinicio.flores.h@gmail.com
 */
import type {
  MetaCampaign,
  MetaAdSet,
  MetaAd,
  MetaPost,
  MetaInsights,
  MetaInsightPoint,
  MetaAggregateMetrics,
  PostEffectivenessPoint,
} from "@/types/meta-ads";

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";
const META_ACCESS_TOKEN = import.meta.env.VITE_META_ACCESS_TOKEN ?? "";
const META_AD_ACCOUNT_ID = import.meta.env.VITE_META_AD_ACCOUNT_ID ?? "";
const META_PAGE_ID = import.meta.env.VITE_META_PAGE_ID ?? "";
const META_POLL_INTERVAL = (Number(import.meta.env.VITE_META_POLL_INTERVAL_SECONDS) || 240) * 1000;

function metaUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${META_GRAPH_URL}${path}`);
  url.searchParams.set("access_token", META_ACCESS_TOKEN);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

async function metaFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = metaUrl(path, params);
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ─── Campaigns ───

export async function fetchCampaigns(): Promise<MetaCampaign[]> {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) return getDemoCampaigns();

  try {
    const data = await metaFetch<{ data: Record<string, unknown>[] }>(
      `/act_${META_AD_ACCOUNT_ID}/campaigns`,
      {
        fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time",
        limit: "100",
      }
    );
    return data.data.map(normalizeCampaign);
  } catch (err) {
    console.error("[Meta API] Campaign fetch error:", err);
    return getDemoCampaigns();
  }
}

export async function fetchCampaignInsights(campaignId: string, datePreset = "last_30d"): Promise<MetaInsights | null> {
  if (!META_ACCESS_TOKEN) return null;
  try {
    const data = await metaFetch<{ data: Record<string, unknown>[] }>(
      `/${campaignId}/insights`,
      {
        fields: "impressions,reach,clicks,spend,cpc,cpm,ctr,frequency,actions,cost_per_action_type",
        date_preset: datePreset,
      }
    );
    return data.data?.[0] ? normalizeInsights(data.data[0]) : null;
  } catch {
    return null;
  }
}

// ─── Ad Sets ───

export async function fetchAdSets(): Promise<MetaAdSet[]> {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) return getDemoAdSets();
  try {
    const data = await metaFetch<{ data: Record<string, unknown>[] }>(
      `/act_${META_AD_ACCOUNT_ID}/adsets`,
      {
        fields: "id,campaign_id,name,status,daily_budget,lifetime_budget,start_time,end_time,targeting",
        limit: "100",
      }
    );
    return data.data.map(normalizeAdSet);
  } catch (err) {
    console.error("[Meta API] AdSet fetch error:", err);
    return getDemoAdSets();
  }
}

// ─── Ads ───

export async function fetchAds(): Promise<MetaAd[]> {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) return getDemoAds();
  try {
    const data = await metaFetch<{ data: Record<string, unknown>[] }>(
      `/act_${META_AD_ACCOUNT_ID}/ads`,
      {
        fields: "id,adset_id,campaign_id,name,status,creative{id,thumbnail_url,title,body},created_time,updated_time",
        limit: "100",
      }
    );
    return data.data.map(normalizeAd);
  } catch (err) {
    console.error("[Meta API] Ads fetch error:", err);
    return getDemoAds();
  }
}

// ─── Page Posts ───

export async function fetchPagePosts(): Promise<MetaPost[]> {
  if (!META_ACCESS_TOKEN || !META_PAGE_ID) return getDemoPosts();
  try {
    const data = await metaFetch<{ data: Record<string, unknown>[] }>(
      `/${META_PAGE_ID}/posts`,
      {
        fields: "id,message,story,created_time,updated_time,type,permalink_url,full_picture,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_engaged_users,post_clicks,post_reactions_by_type_total){values}",
        limit: "50",
      }
    );
    return data.data.map(normalizePost);
  } catch (err) {
    console.error("[Meta API] Posts fetch error:", err);
    return getDemoPosts();
  }
}

// ─── Account-level insights time series ───

export async function fetchAccountInsightsTimeSeries(days = 30): Promise<MetaInsightPoint[]> {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) return getDemoTimeSeries();
  try {
    const data = await metaFetch<{ data: Record<string, unknown>[] }>(
      `/act_${META_AD_ACCOUNT_ID}/insights`,
      {
        fields: "impressions,reach,clicks,spend,actions,ctr,cost_per_action_type",
        time_increment: "1",
        date_preset: days <= 7 ? "last_7d" : days <= 14 ? "last_14d" : "last_30d",
      }
    );
    return data.data.map(normalizeInsightPoint);
  } catch {
    return getDemoTimeSeries();
  }
}

// ─── Aggregate metrics for KPI module ───

export function computeMetaAggregates(
  campaigns: MetaCampaign[],
  ads: MetaAd[],
  posts: MetaPost[],
  timeSeries: MetaInsightPoint[]
): MetaAggregateMetrics {
  const totalSpend = timeSeries.reduce((s, p) => s + p.spend, 0);
  const totalImpressions = timeSeries.reduce((s, p) => s + p.impressions, 0);
  const totalReach = timeSeries.reduce((s, p) => s + p.reach, 0);
  const totalClicks = timeSeries.reduce((s, p) => s + p.clicks, 0);
  const totalLeads = timeSeries.reduce((s, p) => s + p.leads, 0);
  const totalConversions = timeSeries.reduce((s, p) => s + p.conversions, 0);
  const totalEngagement = timeSeries.reduce((s, p) => s + p.engagement, 0);

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
  const activeAds = ads.filter((a) => a.status === "ACTIVE").length;

  const postEngRates = posts.filter((p) => p.engagement_rate > 0).map((p) => p.engagement_rate);
  const avgPostEngRate = postEngRates.length > 0
    ? postEngRates.reduce((a, b) => a + b, 0) / postEngRates.length
    : 0;

  // Best performers
  const bestCampaign = campaigns
    .filter((c) => c.insights)
    .sort((a, b) => (b.insights?.conversions ?? 0) - (a.insights?.conversions ?? 0))[0];
  const bestAd = ads
    .filter((a) => a.insights)
    .sort((a, b) => (b.insights?.ctr ?? 0) - (a.insights?.ctr ?? 0))[0];

  // Best post type
  const postTypeMap = new Map<string, number[]>();
  for (const p of posts) {
    if (!postTypeMap.has(p.type)) postTypeMap.set(p.type, []);
    postTypeMap.get(p.type)!.push(p.engagement_rate);
  }
  let bestPostType = "photo";
  let bestPostTypeAvg = 0;
  for (const [type, rates] of postTypeMap) {
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    if (avg > bestPostTypeAvg) {
      bestPostTypeAvg = avg;
      bestPostType = type;
    }
  }

  return {
    total_spend: totalSpend,
    total_impressions: totalImpressions,
    total_reach: totalReach,
    total_clicks: totalClicks,
    total_leads: totalLeads,
    total_conversions: totalConversions,
    avg_cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
    avg_cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    avg_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    avg_cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
    avg_frequency: totalReach > 0 ? totalImpressions / totalReach : 0,
    roas: totalSpend > 0 ? (totalConversions * 2500000) / totalSpend : 0,
    total_engagement: totalEngagement,
    total_video_views: 0,
    active_campaigns: activeCampaigns,
    active_ads: activeAds,
    total_posts: posts.length,
    avg_post_engagement_rate: Math.round(avgPostEngRate * 100) / 100,
    best_performing_campaign: bestCampaign?.name,
    best_performing_ad: bestAd?.name,
    best_post_type: bestPostType,
  };
}

// ─── Post effectiveness over time ───

export function computePostEffectiveness(posts: MetaPost[]): PostEffectivenessPoint[] {
  const sorted = [...posts].sort((a, b) => a.created_time.localeCompare(b.created_time));
  return sorted.map((p) => ({
    date: p.created_time.slice(0, 10),
    post_type: p.type,
    engagement_rate: p.engagement_rate,
    reach: p.reach,
    clicks: p.clicks,
    conversions: 0,
    effectiveness_score: p.effectiveness_score ?? Math.round(
      (p.engagement_rate * 30) + (Math.min(p.reach / 1000, 30)) + (Math.min(p.clicks / 100, 20)) + (p.shares * 2)
    ),
  }));
}

// ─── AI Recommendations Generator ───

export function generateAdRecommendations(
  campaigns: MetaCampaign[],
  ads: MetaAd[],
  posts: MetaPost[],
  metrics: MetaAggregateMetrics
): import("@/types/meta-ads").MetaAdRecommendation[] {
  const recs: import("@/types/meta-ads").MetaAdRecommendation[] = [];
  let recId = 0;

  // Low CTR ads → optimize creative
  for (const ad of ads) {
    if (ad.insights && ad.insights.ctr < 1.0 && ad.status === "ACTIVE") {
      recs.push({
        id: `rec-${recId++}`,
        type: "optimize_ad",
        priority: "high",
        title: `Optimizar anuncio: ${ad.name}`,
        description: `CTR de ${ad.insights.ctr.toFixed(2)}% está por debajo del benchmark (1%). Considere cambiar el creative o el copy.`,
        target_id: ad.id,
        target_name: ad.name,
        expected_impact: "+0.5-1.5% CTR",
        action_items: [
          "Probar nuevo copy con llamada a acción más directa",
          "Cambiar imagen/video del anuncio",
          "Revisar segmentación del ad set",
        ],
      });
    }
  }

  // High CPL campaigns → reduce spend or optimize
  for (const c of campaigns) {
    if (c.insights && c.insights.cost_per_lead > metrics.avg_cpl * 1.5 && c.status === "ACTIVE") {
      recs.push({
        id: `rec-${recId++}`,
        type: "optimize_ad",
        priority: "high",
        title: `Alto CPL en campaña: ${c.name}`,
        description: `Costo por lead de $${c.insights.cost_per_lead.toFixed(2)} es 50%+ mayor que el promedio ($${metrics.avg_cpl.toFixed(2)}).`,
        target_id: c.id,
        target_name: c.name,
        expected_impact: "-30% CPL",
        action_items: [
          "Revisar audiencia objetivo",
          "Pausar ad sets de bajo rendimiento",
          "Reasignar presupuesto a mejores performers",
        ],
      });
    }
  }

  // Low engagement posts → content suggestions
  const avgEngRate = metrics.avg_post_engagement_rate;
  const lowEngPosts = posts.filter((p) => p.engagement_rate < avgEngRate * 0.5 && p.engagement_rate > 0);
  if (lowEngPosts.length > 3) {
    recs.push({
      id: `rec-${recId++}`,
      type: "new_content",
      priority: "medium",
      title: "Crear contenido de alto valor",
      description: `${lowEngPosts.length} publicaciones tienen engagement por debajo del 50% del promedio. Considere contenido educativo o testimonial.`,
      expected_impact: "+2-3x engagement rate",
      action_items: [
        "Publicar testimonios de clientes satisfechos con fotos de cocinas instaladas",
        "Crear videos cortos (Reels) mostrando proceso de diseño → instalación",
        "Publicar contenido educativo: tips de diseño de cocinas, tendencias 2026",
        "Usar carruseles con antes/después de remodelaciones",
      ],
    });
  }

  // Best post type → double down
  if (metrics.best_post_type) {
    recs.push({
      id: `rec-${recId++}`,
      type: "new_content",
      priority: "medium",
      title: `Duplicar contenido tipo: ${metrics.best_post_type}`,
      description: `Las publicaciones tipo "${metrics.best_post_type}" tienen el mejor engagement promedio. Aumente la frecuencia de este tipo de contenido.`,
      expected_impact: "+15-25% engagement",
      action_items: [
        `Crear 3-4 publicaciones tipo ${metrics.best_post_type} por semana`,
        "Promover las mejores publicaciones orgánicas como anuncios",
        "Analizar qué elementos específicos generan más interacción",
      ],
    });
  }

  // Segment heating suggestions
  recs.push({
    id: `rec-${recId++}`,
    type: "heat_segment",
    priority: "high",
    title: "Calentar segmento: Leads Fríos con interacción previa",
    description: "Crear campaña de retargeting para leads que visitaron la web o interactuaron con posts pero no convirtieron.",
    expected_impact: "+20-30% tasa de conversión",
    action_items: [
      "Crear Custom Audience de visitantes web últimos 30 días",
      "Excluir leads ya convertidos",
      "Usar anuncios con cotización rápida o visita al showroom",
      "Activar lista desde Pruebas A/B para validar mensaje",
    ],
  });

  // A/B test suggestions
  recs.push({
    id: `rec-${recId++}`,
    type: "ab_test",
    priority: "medium",
    title: "Prueba A/B: Video vs Carrusel para generación de leads",
    description: "Comparar rendimiento de anuncios en video vs carrusel para la misma audiencia de generación de leads.",
    expected_impact: "Identificar formato óptimo",
    action_items: [
      "Crear 2 variantes del mismo mensaje: video y carrusel",
      "Asignar presupuesto equitativo por 7 días",
      "Medir CPL, CTR y tasa de conversión",
      "Escalar el ganador con 2x presupuesto",
    ],
  });

  return recs;
}

// ─── Polling ───

export function getMetaPollInterval(): number {
  return META_POLL_INTERVAL;
}

export function isMetaConfigured(): boolean {
  return !!(META_ACCESS_TOKEN && META_AD_ACCOUNT_ID);
}

// ─── Normalizers ───

function normalizeCampaign(raw: Record<string, unknown>): MetaCampaign {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    status: (raw.status as MetaCampaign["status"]) ?? "PAUSED",
    objective: String(raw.objective ?? ""),
    daily_budget: raw.daily_budget ? Number(raw.daily_budget) / 100 : undefined,
    lifetime_budget: raw.lifetime_budget ? Number(raw.lifetime_budget) / 100 : undefined,
    start_time: String(raw.start_time ?? ""),
    stop_time: raw.stop_time ? String(raw.stop_time) : undefined,
    created_time: String(raw.created_time ?? ""),
    updated_time: String(raw.updated_time ?? ""),
  };
}

function normalizeAdSet(raw: Record<string, unknown>): MetaAdSet {
  return {
    id: String(raw.id ?? ""),
    campaign_id: String(raw.campaign_id ?? ""),
    name: String(raw.name ?? ""),
    status: (raw.status as MetaAdSet["status"]) ?? "PAUSED",
    daily_budget: raw.daily_budget ? Number(raw.daily_budget) / 100 : undefined,
    lifetime_budget: raw.lifetime_budget ? Number(raw.lifetime_budget) / 100 : undefined,
    start_time: String(raw.start_time ?? ""),
    end_time: raw.end_time ? String(raw.end_time) : undefined,
  };
}

function normalizeAd(raw: Record<string, unknown>): MetaAd {
  const creative = raw.creative as Record<string, unknown> | undefined;
  return {
    id: String(raw.id ?? ""),
    ad_set_id: String(raw.adset_id ?? ""),
    campaign_id: String(raw.campaign_id ?? ""),
    name: String(raw.name ?? ""),
    status: (raw.status as MetaAd["status"]) ?? "PAUSED",
    creative_id: creative ? String(creative.id ?? "") : undefined,
    creative_thumbnail_url: creative ? String(creative.thumbnail_url ?? "") : undefined,
    creative_title: creative ? String(creative.title ?? "") : undefined,
    creative_body: creative ? String(creative.body ?? "") : undefined,
    created_time: String(raw.created_time ?? ""),
    updated_time: String(raw.updated_time ?? ""),
  };
}

function normalizePost(raw: Record<string, unknown>): MetaPost {
  const likes = (raw.likes as Record<string, unknown>)?.summary as Record<string, unknown> | undefined;
  const comments = (raw.comments as Record<string, unknown>)?.summary as Record<string, unknown> | undefined;
  const shares = raw.shares as Record<string, unknown> | undefined;
  const likeCount = Number(likes?.total_count ?? 0);
  const commentCount = Number(comments?.total_count ?? 0);
  const shareCount = Number(shares?.count ?? 0);
  const reach = 1;
  const impressions = 1;

  return {
    id: String(raw.id ?? ""),
    message: raw.message ? String(raw.message) : undefined,
    story: raw.story ? String(raw.story) : undefined,
    created_time: String(raw.created_time ?? ""),
    updated_time: raw.updated_time ? String(raw.updated_time) : undefined,
    type: (raw.type as MetaPost["type"]) ?? "unknown",
    permalink_url: raw.permalink_url ? String(raw.permalink_url) : undefined,
    full_picture: raw.full_picture ? String(raw.full_picture) : undefined,
    likes: likeCount,
    comments: commentCount,
    shares: shareCount,
    reactions_total: likeCount,
    reach,
    impressions,
    clicks: 0,
    engagement_rate: reach > 0 ? ((likeCount + commentCount + shareCount) / Math.max(reach, 1)) * 100 : 0,
    is_promoted: false,
  };
}

function normalizeInsights(raw: Record<string, unknown>): MetaInsights {
  const actions = (raw.actions as Record<string, unknown>[]) ?? [];
  const costPerAction = (raw.cost_per_action_type as Record<string, unknown>[]) ?? [];

  const findAction = (type: string) => {
    const a = actions.find((a) => a.action_type === type);
    return a ? Number(a.value ?? 0) : 0;
  };
  const findCostPerAction = (type: string) => {
    const a = costPerAction.find((a) => a.action_type === type);
    return a ? Number(a.value ?? 0) : 0;
  };

  const leads = findAction("lead") || findAction("offsite_conversion.fb_pixel_lead");
  const conversions = findAction("offsite_conversion.fb_pixel_purchase") || findAction("purchase");
  const spend = Number(raw.spend ?? 0);

  return {
    impressions: Number(raw.impressions ?? 0),
    reach: Number(raw.reach ?? 0),
    clicks: Number(raw.clicks ?? 0),
    spend,
    cpc: Number(raw.cpc ?? 0),
    cpm: Number(raw.cpm ?? 0),
    ctr: Number(raw.ctr ?? 0),
    frequency: Number(raw.frequency ?? 0),
    leads,
    conversions,
    cost_per_lead: leads > 0 ? spend / leads : findCostPerAction("lead"),
    cost_per_conversion: conversions > 0 ? spend / conversions : 0,
    conversion_rate: Number(raw.clicks ?? 0) > 0 ? (conversions / Number(raw.clicks)) * 100 : 0,
    post_engagement: findAction("post_engagement"),
    page_engagement: findAction("page_engagement"),
    link_clicks: findAction("link_click"),
    video_views: findAction("video_view") || undefined,
    date_start: String(raw.date_start ?? ""),
    date_stop: String(raw.date_stop ?? ""),
  };
}

function normalizeInsightPoint(raw: Record<string, unknown>): MetaInsightPoint {
  const actions = (raw.actions as Record<string, unknown>[]) ?? [];
  const findAction = (type: string) => {
    const a = actions.find((a) => a.action_type === type);
    return a ? Number(a.value ?? 0) : 0;
  };

  const impressions = Number(raw.impressions ?? 0);
  const clicks = Number(raw.clicks ?? 0);
  const spend = Number(raw.spend ?? 0);
  const leads = findAction("lead") || findAction("offsite_conversion.fb_pixel_lead");

  return {
    date: String(raw.date_start ?? ""),
    impressions,
    reach: Number(raw.reach ?? 0),
    clicks,
    spend,
    leads,
    conversions: findAction("offsite_conversion.fb_pixel_purchase") || findAction("purchase"),
    cpl: leads > 0 ? spend / leads : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    engagement: findAction("post_engagement"),
  };
}

// ─── Demo data (when Meta API not configured) ───

function getDemoCampaigns(): MetaCampaign[] {
  const now = new Date();
  return [
    {
      id: "demo-camp-1", name: "ARA Cocinas — Lead Gen Q1 2026", status: "ACTIVE",
      objective: "OUTCOME_LEADS", daily_budget: 25, start_time: "2026-01-15T00:00:00",
      created_time: "2026-01-14T10:00:00", updated_time: now.toISOString(),
      insights: { impressions: 145200, reach: 89400, clicks: 4230, spend: 1875, cpc: 0.44, cpm: 12.91, ctr: 2.91, frequency: 1.62, leads: 187, conversions: 23, cost_per_lead: 10.03, cost_per_conversion: 81.52, conversion_rate: 0.54, post_engagement: 8920, page_engagement: 3210, link_clicks: 3890, date_start: "2026-01-15", date_stop: now.toISOString().slice(0, 10) },
    },
    {
      id: "demo-camp-2", name: "Hogares Funcionales — Reconocimiento", status: "ACTIVE",
      objective: "OUTCOME_AWARENESS", daily_budget: 15, start_time: "2026-02-01T00:00:00",
      created_time: "2026-01-31T10:00:00", updated_time: now.toISOString(),
      insights: { impressions: 234500, reach: 156000, clicks: 3120, spend: 945, cpc: 0.30, cpm: 4.03, ctr: 1.33, frequency: 1.50, leads: 45, conversions: 5, cost_per_lead: 21.0, cost_per_conversion: 189.0, conversion_rate: 0.16, post_engagement: 12400, page_engagement: 5600, link_clicks: 2800, date_start: "2026-02-01", date_stop: now.toISOString().slice(0, 10) },
    },
    {
      id: "demo-camp-3", name: "Remodelaciones — Conversiones", status: "ACTIVE",
      objective: "OUTCOME_SALES", daily_budget: 30, start_time: "2026-02-10T00:00:00",
      created_time: "2026-02-09T10:00:00", updated_time: now.toISOString(),
      insights: { impressions: 67800, reach: 45200, clicks: 2890, spend: 1230, cpc: 0.43, cpm: 18.14, ctr: 4.26, frequency: 1.50, leads: 134, conversions: 18, cost_per_lead: 9.18, cost_per_conversion: 68.33, conversion_rate: 0.62, post_engagement: 5670, page_engagement: 2340, link_clicks: 2650, date_start: "2026-02-10", date_stop: now.toISOString().slice(0, 10) },
    },
    {
      id: "demo-camp-4", name: "Closets Premium — Retargeting", status: "PAUSED",
      objective: "OUTCOME_LEADS", daily_budget: 20, start_time: "2026-01-20T00:00:00",
      stop_time: "2026-02-15T00:00:00",
      created_time: "2026-01-19T10:00:00", updated_time: "2026-02-15T10:00:00",
      insights: { impressions: 34500, reach: 21000, clicks: 1560, spend: 620, cpc: 0.40, cpm: 17.97, ctr: 4.52, frequency: 1.64, leads: 67, conversions: 8, cost_per_lead: 9.25, cost_per_conversion: 77.50, conversion_rate: 0.51, post_engagement: 2340, page_engagement: 890, link_clicks: 1400, date_start: "2026-01-20", date_stop: "2026-02-15" },
    },
  ];
}

function getDemoAdSets(): MetaAdSet[] {
  return [
    { id: "demo-adset-1", campaign_id: "demo-camp-1", name: "Lookalike — Compradores Cocinas", status: "ACTIVE", daily_budget: 12, start_time: "2026-01-15T00:00:00" },
    { id: "demo-adset-2", campaign_id: "demo-camp-1", name: "Intereses — Diseño Interior", status: "ACTIVE", daily_budget: 13, start_time: "2026-01-15T00:00:00" },
    { id: "demo-adset-3", campaign_id: "demo-camp-2", name: "Broad — GAM 25-55", status: "ACTIVE", daily_budget: 15, start_time: "2026-02-01T00:00:00" },
    { id: "demo-adset-4", campaign_id: "demo-camp-3", name: "Retargeting — Web Visitors", status: "ACTIVE", daily_budget: 15, start_time: "2026-02-10T00:00:00" },
    { id: "demo-adset-5", campaign_id: "demo-camp-3", name: "Custom — CRM Leads", status: "ACTIVE", daily_budget: 15, start_time: "2026-02-10T00:00:00" },
  ];
}

function getDemoAds(): MetaAd[] {
  return [
    { id: "demo-ad-1", ad_set_id: "demo-adset-1", campaign_id: "demo-camp-1", name: "Cocina Moderna — Video", status: "ACTIVE", creative_title: "Tu cocina soñada", creative_body: "Diseño 3D gratis. Cotiza hoy.", created_time: "2026-01-15T10:00:00", updated_time: "2026-02-19T10:00:00", insights: { impressions: 78000, reach: 52000, clicks: 2340, spend: 980, cpc: 0.42, cpm: 12.56, ctr: 3.0, frequency: 1.5, leads: 98, conversions: 12, cost_per_lead: 10.0, cost_per_conversion: 81.67, conversion_rate: 0.51, post_engagement: 4500, page_engagement: 1800, link_clicks: 2100, date_start: "2026-01-15", date_stop: "2026-02-19" } },
    { id: "demo-ad-2", ad_set_id: "demo-adset-1", campaign_id: "demo-camp-1", name: "Cocina Clásica — Carrusel", status: "ACTIVE", creative_title: "Antes y Después", creative_body: "Transformamos tu espacio", created_time: "2026-01-15T10:00:00", updated_time: "2026-02-19T10:00:00", insights: { impressions: 67200, reach: 37400, clicks: 1890, spend: 895, cpc: 0.47, cpm: 13.32, ctr: 2.81, frequency: 1.8, leads: 89, conversions: 11, cost_per_lead: 10.06, cost_per_conversion: 81.36, conversion_rate: 0.58, post_engagement: 4420, page_engagement: 1410, link_clicks: 1790, date_start: "2026-01-15", date_stop: "2026-02-19" } },
    { id: "demo-ad-3", ad_set_id: "demo-adset-3", campaign_id: "demo-camp-2", name: "Brand Awareness — Reel", status: "ACTIVE", creative_title: "ARA Group", creative_body: "Cocinas que inspiran", created_time: "2026-02-01T10:00:00", updated_time: "2026-02-19T10:00:00", insights: { impressions: 234500, reach: 156000, clicks: 3120, spend: 945, cpc: 0.30, cpm: 4.03, ctr: 1.33, frequency: 1.5, leads: 45, conversions: 5, cost_per_lead: 21.0, cost_per_conversion: 189.0, conversion_rate: 0.16, post_engagement: 12400, page_engagement: 5600, link_clicks: 2800, date_start: "2026-02-01", date_stop: "2026-02-19" } },
    { id: "demo-ad-4", ad_set_id: "demo-adset-4", campaign_id: "demo-camp-3", name: "Remodelación — Testimonio", status: "ACTIVE", creative_title: "Cliente Feliz", creative_body: "Vea la transformación", created_time: "2026-02-10T10:00:00", updated_time: "2026-02-19T10:00:00", insights: { impressions: 34500, reach: 23000, clicks: 1560, spend: 650, cpc: 0.42, cpm: 18.84, ctr: 4.52, frequency: 1.5, leads: 72, conversions: 10, cost_per_lead: 9.03, cost_per_conversion: 65.0, conversion_rate: 0.64, post_engagement: 3200, page_engagement: 1200, link_clicks: 1400, date_start: "2026-02-10", date_stop: "2026-02-19" } },
    { id: "demo-ad-5", ad_set_id: "demo-adset-5", campaign_id: "demo-camp-3", name: "Closet Walk-in — Foto", status: "PAUSED", creative_title: "Closet de ensueño", creative_body: "Diseño personalizado", created_time: "2026-02-10T10:00:00", updated_time: "2026-02-15T10:00:00", insights: { impressions: 12000, reach: 8000, clicks: 450, spend: 280, cpc: 0.62, cpm: 23.33, ctr: 3.75, frequency: 1.5, leads: 23, conversions: 2, cost_per_lead: 12.17, cost_per_conversion: 140.0, conversion_rate: 0.44, post_engagement: 1200, page_engagement: 450, link_clicks: 400, date_start: "2026-02-10", date_stop: "2026-02-15" } },
  ];
}

function getDemoPosts(): MetaPost[] {
  const types: MetaPost["type"][] = ["photo", "video", "carousel", "reel", "link", "photo", "video", "reel", "photo", "carousel", "video", "reel"];
  const messages = [
    "✨ Nueva cocina integral instalada en Escazú. Diseño moderno con isla central. ¡Cotiza gratis!",
    "🎬 Proceso completo: del diseño 3D a la instalación en 3 semanas. Mira el video.",
    "📸 Antes y después de remodelación completa. 4 fotos que te van a sorprender.",
    "🔥 Reel: Tour por nuestro showroom. ¡Ven a conocernos!",
    "📰 Blog: 5 tendencias en cocinas para 2026. Lee más en nuestro sitio.",
    "🏠 Closet walk-in terminado. Diseño personalizado para cada espacio.",
    "🎥 Testimonio: 'ARA transformó nuestra cocina y nuestra vida' — Familia Rodríguez",
    "⚡ Reel: 30 segundos de transformación. De vacío a cocina soñada.",
    "🌿 Cocina con acabados en madera natural. Tendencia eco-friendly.",
    "📸 Carrusel: 6 diseños de cocinas para diferentes presupuestos.",
    "🎬 Video: Cómo elegir la cocina perfecta para tu hogar — Guía completa",
    "🔥 Reel: Instalación express en 48 horas. ¡Sí se puede!",
  ];

  return types.map((type, i) => {
    const daysAgo = (types.length - i) * 3;
    const date = new Date(Date.now() - daysAgo * 86400000);
    const likes = Math.round(40 + Math.random() * 200);
    const comments = Math.round(5 + Math.random() * 40);
    const shares = Math.round(2 + Math.random() * 25);
    const reach = Math.round(800 + Math.random() * 5000);
    const impressions = Math.round(reach * (1.2 + Math.random() * 0.5));
    const clicks = Math.round(reach * (0.02 + Math.random() * 0.06));
    const engRate = ((likes + comments + shares) / Math.max(reach, 1)) * 100;

    return {
      id: `demo-post-${i + 1}`,
      message: messages[i],
      created_time: date.toISOString(),
      type,
      likes,
      comments,
      shares,
      reactions_total: likes,
      reach,
      impressions,
      clicks,
      engagement_rate: Math.round(engRate * 100) / 100,
      is_promoted: i < 4,
      effectiveness_score: Math.round(engRate * 10 + clicks / 10 + shares * 3),
    };
  });
}

function getDemoTimeSeries(): MetaInsightPoint[] {
  const points: MetaInsightPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const dayOfWeek = date.getDay();
    const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.0;
    const trendFactor = 1 + (29 - i) * 0.01;

    const spend = Math.round((120 + Math.random() * 40) * weekendFactor * trendFactor);
    const impressions = Math.round((12000 + Math.random() * 5000) * weekendFactor * trendFactor);
    const reach = Math.round(impressions * (0.6 + Math.random() * 0.15));
    const clicks = Math.round(impressions * (0.025 + Math.random() * 0.015));
    const leads = Math.round(clicks * (0.04 + Math.random() * 0.03));
    const conversions = Math.round(leads * (0.1 + Math.random() * 0.08));

    points.push({
      date: date.toISOString().slice(0, 10),
      impressions,
      reach,
      clicks,
      spend,
      leads,
      conversions,
      cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      engagement: Math.round(clicks * 1.5 + Math.random() * 200),
    });
  }
  return points;
}
