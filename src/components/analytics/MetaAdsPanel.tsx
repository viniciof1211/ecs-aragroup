/**
 * Meta Ads Marketing Panel — shared analytics component for all tabs.
 * Renders different chart sets depending on the `mode` prop.
 */
import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  TrendingUp, DollarSign, Eye, MousePointerClick,
  Users, Megaphone, Target, Sparkles, BarChart3, Lightbulb, Flame,
} from "lucide-react";
import { useMetaAdsStore } from "@/stores/useMetaAdsStore";
import {
  POST_TYPE_LABELS, CAMPAIGN_STATUS_LABELS,
} from "@/types/meta-ads";
import type { MetaAdRecommendation } from "@/types/meta-ads";

type PanelMode = "diagnostic" | "sentiment" | "predictive" | "prescriptive";

interface MetaAdsPanelProps {
  mode: PanelMode;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: "0.7rem",
};

const COLORS = ["#1A4A28", "#2A6A3A", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"];

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  high: { color: "text-red-600", label: "Alta" },
  medium: { color: "text-yellow-600", label: "Media" },
  low: { color: "text-blue-600", label: "Baja" },
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n % 1 === 0 ? 0 : 2);
}

export function MetaAdsPanel({ mode }: MetaAdsPanelProps) {
  const {
    campaigns, ads, posts, timeSeries, aggregates,
    recommendations, postEffectiveness, lastFetchAt,
  } = useMetaAdsStore();

  // ─── Derived data ───

  const spendByDay = useMemo(() => timeSeries.map((p) => ({
    date: p.date.slice(5),
    spend: p.spend,
    leads: p.leads,
    cpl: p.cpl,
    clicks: p.clicks,
    impressions: p.impressions,
    ctr: p.ctr,
    engagement: p.engagement,
    conversions: p.conversions,
  })), [timeSeries]);

  const campaignPerformance = useMemo(() =>
    campaigns
      .filter((c) => c.insights)
      .map((c) => ({
        name: c.name.length > 25 ? c.name.slice(0, 25) + "…" : c.name,
        fullName: c.name,
        spend: c.insights!.spend,
        leads: c.insights!.leads,
        cpl: c.insights!.cost_per_lead,
        ctr: c.insights!.ctr,
        conversions: c.insights!.conversions,
        status: c.status,
        objective: c.objective,
      }))
      .sort((a, b) => b.leads - a.leads),
    [campaigns]
  );

  const adPerformance = useMemo(() =>
    ads
      .filter((a) => a.insights)
      .map((a) => ({
        name: a.name.length > 20 ? a.name.slice(0, 20) + "…" : a.name,
        fullName: a.name,
        spend: a.insights!.spend,
        ctr: a.insights!.ctr,
        cpl: a.insights!.cost_per_lead,
        leads: a.insights!.leads,
        impressions: a.insights!.impressions,
        status: a.status,
      }))
      .sort((a, b) => b.ctr - a.ctr),
    [ads]
  );

  const postTypeStats = useMemo(() => {
    const map = new Map<string, { count: number; totalEng: number; totalReach: number; totalClicks: number }>();
    for (const p of posts) {
      if (!map.has(p.type)) map.set(p.type, { count: 0, totalEng: 0, totalReach: 0, totalClicks: 0 });
      const e = map.get(p.type)!;
      e.count++;
      e.totalEng += p.engagement_rate;
      e.totalReach += p.reach;
      e.totalClicks += p.clicks;
    }
    return Array.from(map.entries()).map(([type, d]) => ({
      type: POST_TYPE_LABELS[type] || type,
      count: d.count,
      avgEngagement: Math.round((d.totalEng / d.count) * 100) / 100,
      totalReach: d.totalReach,
      avgClicks: Math.round(d.totalClicks / d.count),
    })).sort((a, b) => b.avgEngagement - a.avgEngagement);
  }, [posts]);

  const postScatter = useMemo(() =>
    posts.map((p) => ({
      name: (p.message || p.story || "Post").slice(0, 30),
      engagement: p.engagement_rate,
      reach: p.reach,
      type: POST_TYPE_LABELS[p.type] || p.type,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
    })),
    [posts]
  );

  // Predictive: trend extrapolation
  const trendForecast = useMemo(() => {
    if (spendByDay.length < 7) return [];
    const last7 = spendByDay.slice(-7);
    const avgSpend = last7.reduce((s, p) => s + p.spend, 0) / 7;
    const avgLeads = last7.reduce((s, p) => s + p.leads, 0) / 7;
    const avgCpl = last7.reduce((s, p) => s + p.cpl, 0) / 7;
    const spendTrend = (last7[6].spend - last7[0].spend) / 7;
    const leadsTrend = (last7[6].leads - last7[0].leads) / 7;

    const forecast: { date: string; spend: number; leads: number; cpl: number; type: string }[] = [];
    for (const p of spendByDay) {
      forecast.push({ ...p, type: "actual" });
    }
    for (let i = 1; i <= 14; i++) {
      const d = new Date(Date.now() + i * 86400000);
      forecast.push({
        date: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        spend: Math.max(0, Math.round(avgSpend + spendTrend * i)),
        leads: Math.max(0, Math.round(avgLeads + leadsTrend * i)),
        cpl: avgCpl > 0 ? Math.round(((avgSpend + spendTrend * i) / Math.max(1, avgLeads + leadsTrend * i)) * 100) / 100 : 0,
        type: "forecast",
      });
    }
    return forecast;
  }, [spendByDay]);

  // Health radar for ads
  const adsHealthRadar = useMemo(() => {
    if (!aggregates) return [];
    return [
      { metric: "CTR", value: Math.min(aggregates.avg_ctr * 20, 100) },
      { metric: "CPL Eficiencia", value: Math.max(0, 100 - aggregates.avg_cpl * 2) },
      { metric: "Alcance", value: Math.min(aggregates.total_reach / 10000, 100) },
      { metric: "Engagement", value: Math.min(aggregates.avg_post_engagement_rate * 15, 100) },
      { metric: "Conversiones", value: Math.min(aggregates.total_conversions * 2, 100) },
      { metric: "ROAS", value: Math.min(aggregates.roas * 10, 100) },
    ];
  }, [aggregates]);

  if (!aggregates && campaigns.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Megaphone className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          Cargando datos de Meta Marketing...
          {lastFetchAt && <p className="mt-1 text-[10px]">Última actualización: {lastFetchAt.toLocaleTimeString()}</p>}
        </CardContent>
      </Card>
    );
  }

  // ─── DIAGNOSTIC MODE ───
  if (mode === "diagnostic") return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {aggregates && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {[
            { label: "Inversión Total", value: `$${fmtNum(aggregates.total_spend)}`, icon: DollarSign, color: "text-green-600" },
            { label: "Leads Generados", value: fmtNum(aggregates.total_leads), icon: Users, color: "text-blue-600" },
            { label: "CPL Promedio", value: `$${aggregates.avg_cpl.toFixed(2)}`, icon: Target, color: "text-purple-600" },
            { label: "CTR Promedio", value: `${aggregates.avg_ctr.toFixed(2)}%`, icon: MousePointerClick, color: "text-amber-600" },
            { label: "Alcance Total", value: fmtNum(aggregates.total_reach), icon: Eye, color: "text-cyan-600" },
            { label: "Campañas Activas", value: String(aggregates.active_campaigns), icon: Megaphone, color: "text-red-600" },
          ].map((kpi) => (
            <Card key={kpi.label} className="shadow-card">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
                </div>
                <p className="mt-1 font-display text-lg font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Spend & Leads over time */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Inversión y Leads Diarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={spendByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <YAxis yAxisId="left" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar yAxisId="left" dataKey="spend" name="Inversión ($)" fill="#1A4A28" radius={[2, 2, 0, 0]} />
                <Bar yAxisId="right" dataKey="leads" name="Leads" fill="#3B82F6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <MousePointerClick className="h-5 w-5 text-amber-500" />
              CTR y CPL Diarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={spendByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <YAxis yAxisId="left" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Line yAxisId="left" type="monotone" dataKey="ctr" name="CTR %" stroke="#F59E0B" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="cpl" name="CPL ($)" stroke="#EF4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance + Ad Performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Rendimiento por Campaña</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={campaignPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 7 }} width={100} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="leads" name="Leads" fill="#1A4A28" radius={[0, 4, 4, 0]} />
                <Bar dataKey="conversions" name="Conversiones" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Rendimiento por Anuncio (CTR)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={adPerformance}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 7 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="ctr" name="CTR %" radius={[4, 4, 0, 0]}>
                  {adPerformance.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Post Type Effectiveness */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            Efectividad por Tipo de Publicación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={postTypeStats}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="type" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="avgEngagement" name="Engagement %" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgClicks" name="Clicks Prom." fill="#06B6D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={postTypeStats} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {postTypeStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ─── SENTIMENT MODE ───
  if (mode === "sentiment") return (
    <div className="space-y-6">
      {/* Post Engagement Scatter */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Sentimiento de Engagement por Publicación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" dataKey="reach" name="Alcance" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
              <YAxis type="number" dataKey="engagement" name="Engagement %" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
              <ZAxis type="number" dataKey="likes" range={[20, 300]} />
              <Tooltip
                contentStyle={tooltipStyle}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border bg-card p-2 text-xs shadow-md">
                      <p className="font-semibold">{d?.name}</p>
                      <p>Tipo: {d?.type} · Alcance: {fmtNum(d?.reach ?? 0)}</p>
                      <p>Engagement: {d?.engagement?.toFixed(2)}%</p>
                      <p>❤️ {d?.likes} · 💬 {d?.comments} · 🔄 {d?.shares}</p>
                    </div>
                  );
                }}
              />
              <Scatter data={postScatter} fill="#1A4A28" opacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Post Effectiveness Over Time */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Efectividad de Publicaciones en el Tiempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={postEffectiveness}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 8 }} className="fill-muted-foreground" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Area type="monotone" dataKey="effectiveness_score" name="Score Efectividad" stroke="#1A4A28" fill="#1A4A28" fillOpacity={0.2} />
              <Area type="monotone" dataKey="engagement_rate" name="Engagement %" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Ad Sentiment Table */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">Análisis de Sentimiento por Anuncio</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anuncio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead>Sentimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adPerformance.map((ad) => {
                  const sentiment = ad.ctr >= 3 ? "positive" : ad.ctr >= 1.5 ? "neutral" : "negative";
                  return (
                    <TableRow key={ad.fullName}>
                      <TableCell className="font-medium text-sm">{ad.fullName}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px]">{CAMPAIGN_STATUS_LABELS[ad.status] || ad.status}</Badge></TableCell>
                      <TableCell className="text-right">{ad.ctr.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">${ad.cpl.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{ad.leads}</TableCell>
                      <TableCell>
                        <Badge variant={sentiment === "positive" ? "default" : sentiment === "neutral" ? "secondary" : "destructive"} className={sentiment === "positive" ? "bg-green-600" : ""}>
                          {sentiment === "positive" ? "👍 Positivo" : sentiment === "neutral" ? "😐 Neutral" : "👎 Negativo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  // ─── PREDICTIVE MODE ───
  if (mode === "predictive") return (
    <div className="space-y-6">
      {/* Trend Forecast */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Pronóstico de Inversión y Leads (14 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendForecast}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 7 }} className="fill-muted-foreground" />
              <YAxis yAxisId="left" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Line yAxisId="left" type="monotone" dataKey="spend" name="Inversión ($)" stroke="#1A4A28" strokeWidth={2} dot={false} strokeDasharray={undefined} />
              <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[9px] text-muted-foreground text-center">Líneas continuas = datos reales · Últimos 14 puntos = pronóstico basado en tendencia</p>
        </CardContent>
      </Card>

      {/* Ads Health Radar + Post Type Trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-500" />
              Radar de Salud Publicitaria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={adsHealthRadar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
                <PolarRadiusAxis tick={{ fontSize: 7 }} domain={[0, 100]} />
                <Radar name="Salud Ads" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-500" />
              Tendencia de Efectividad por Tipo de Post
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={postEffectiveness}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 7 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Line type="monotone" dataKey="effectiveness_score" name="Score" stroke="#1A4A28" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="engagement_rate" name="Engagement %" stroke="#F59E0B" strokeWidth={1.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* CPL Trend Forecast */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-red-500" />
            Pronóstico de Costo por Lead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendForecast}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 7 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 8 }} className="fill-muted-foreground" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v ?? 0}`, "CPL"]} />
              <Area type="monotone" dataKey="cpl" name="CPL ($)" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  // ─── PRESCRIPTIVE MODE ───
  return (
    <div className="space-y-6">
      {/* AI Recommendations */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Recomendaciones IA — Marketing y Ads ({recommendations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content Suggestions + Segment Heating */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Sugerencias de Contenido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { type: "🎬 Video Testimonial", desc: "Clientes reales mostrando su cocina terminada. Alto engagement y confianza.", impact: "+3x engagement vs foto estática", audience: "Leads tibios y fríos" },
              { type: "📸 Carrusel Antes/Después", desc: "4-6 fotos del proceso de transformación. Genera curiosidad y saves.", impact: "+45% saves, +2x shares", audience: "Audiencia broad, intereses diseño" },
              { type: "⚡ Reel de Proceso", desc: "30s mostrando instalación acelerada. Contenido viral potencial.", impact: "+5x alcance orgánico", audience: "Nuevos seguidores, awareness" },
              { type: "📊 Infografía de Precios", desc: "Rangos de inversión por tipo de cocina. Califica leads automáticamente.", impact: "Leads más calificados, -20% CPL", audience: "Leads calientes, retargeting" },
            ].map((s) => (
              <div key={s.type} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{s.type}</h4>
                  <Badge variant="outline" className="text-[9px]">{s.audience}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
                <p className="text-[10px] font-medium text-emerald-600">{s.impact}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Activar Segmentos (Heat Up)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { segment: "Web Visitors (no convertidos)", action: "Retargeting con cotización express", budget: "$15/día", expected: "12-18% tasa de conversión" },
              { segment: "Engagement con Posts (últimos 30d)", action: "Campaña de lead gen con formulario", budget: "$10/día", expected: "8-12 leads/día" },
              { segment: "Lookalike de Compradores", action: "Awareness + Lead Gen secuencial", budget: "$20/día", expected: "CPL $8-12" },
              { segment: "Lista A/B Test — Grupo Ganador", action: "Escalar campaña ganadora 2x", budget: "2x presupuesto actual", expected: "+50% leads manteniendo CPL" },
            ].map((s) => (
              <div key={s.segment} className="rounded-lg border p-3 space-y-1">
                <h4 className="text-sm font-semibold">{s.segment}</h4>
                <p className="text-xs text-muted-foreground">{s.action}</p>
                <div className="flex gap-3 text-[10px]">
                  <span>💰 {s.budget}</span>
                  <span className="text-emerald-600 font-medium">📈 {s.expected}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: MetaAdRecommendation }) {
  const pConfig = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.medium;
  const typeIcons: Record<string, string> = {
    optimize_ad: "🎯", pause_ad: "⏸️", increase_budget: "💰",
    new_content: "✨", retarget: "🔄", ab_test: "🧪", heat_segment: "🔥",
  };

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeIcons[rec.type] || "💡"}</span>
          <div>
            <h4 className="text-sm font-semibold">{rec.title}</h4>
            {rec.target_name && <span className="text-[10px] text-muted-foreground">→ {rec.target_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[9px] ${pConfig.color}`}>
            {pConfig.label}
          </Badge>
          <Badge variant="secondary" className="text-[9px]">{rec.expected_impact}</Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{rec.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {rec.action_items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[9px]">
            <span className="text-primary">•</span> {item}
          </span>
        ))}
      </div>
    </div>
  );
}
