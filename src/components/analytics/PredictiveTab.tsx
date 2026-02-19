import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, TrendingDown, TrendingUp, Brain, Target, Zap, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { scoreForecasts, churnRiskAnalysis, segmentDistribution } from "@/lib/analytics-engine";
import type { ECSLead, ECSInteraction } from "@/types/ecs";
import { STATUS_LABELS } from "@/types/ecs";
import { MetaAdsPanel } from "./MetaAdsPanel";

interface PredictiveTabProps {
  leads: ECSLead[];
  activeLeads: ECSLead[];
  interactions: ECSInteraction[];
}

const SEGMENT_COLORS: Record<string, string> = {
  hot: "#EF4444",
  warm: "#F59E0B",
  cool: "#3B82F6",
  cold: "#6366F1",
  dormant: "#9CA3AF",
  lost: "#374151",
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
};

export function PredictiveTab({ leads, activeLeads, interactions }: PredictiveTabProps) {
  const navigate = useNavigate();
  const forecasts = scoreForecasts(leads, interactions, 30);
  const churnRisks = churnRiskAnalysis(leads, interactions).slice(0, 20);
  const segments = segmentDistribution(leads);

  // ─── Conversion probability for ALL leads (not just hot/warm) ───
  const conversionCandidates = useMemo(() => {
    const source = activeLeads.length > 0 ? activeLeads : leads;
    return source
      .filter((l) => l.status !== "won" && l.status !== "lost")
      .map((l) => {
        const trend = l.current_score - l.previous_score;
        const interactionCount = l.interaction_count ?? 0;
        let probability = 0;

        // Multi-factor scoring model
        probability += Math.min(l.current_score * 0.35, 35);
        probability += Math.min(interactionCount * 1.5, 15);
        if (trend > 0) probability += Math.min(trend * 1.5, 15);
        else if (trend < -5) probability -= 5;
        if (l.status === "negotiation") probability += 20;
        else if (l.status === "proposal") probability += 15;
        else if (l.status === "qualified") probability += 10;
        else if (l.status === "contacted") probability += 3;
        if (l.segment === "hot") probability += 10;
        else if (l.segment === "warm") probability += 5;
        if (l.total_amount && l.total_amount > 0) probability += 5;

        return {
          id: l.id,
          name: l.name,
          score: l.current_score,
          status: l.status,
          segment: l.segment,
          probability: Math.max(1, Math.min(Math.round(probability), 95)),
          trend,
          interactions: interactionCount,
        };
      })
      .sort((a, b) => b.probability - a.probability);
  }, [leads, activeLeads]);

  // Revenue impact
  const avgDealValue = 2_500_000;
  const decliningLeads = leads.filter((l) => l.current_score < l.previous_score - 5);
  const risingLeads = leads.filter((l) => l.current_score > l.previous_score + 5);
  const revenueAtRisk = decliningLeads.length * avgDealValue * 0.3;
  const revenuePotential = risingLeads.length * avgDealValue * 0.5;

  // ─── NEW: Score vs Interactions Scatter (Lead Quality Matrix) ───
  const scatterData = useMemo(() => {
    return leads
      .filter((l) => l.status !== "won" && l.status !== "lost")
      .map((l) => ({
        name: l.name,
        score: l.current_score,
        interactions: l.interaction_count ?? 0,
        segment: l.segment,
        status: l.status,
        id: l.id,
      }));
  }, [leads]);

  // ─── NEW: Conversion Funnel Velocity (avg days per stage) ───
  const funnelVelocity = useMemo(() => {
    const stages = ["new", "contacted", "qualified", "proposal", "negotiation", "won"];
    const stageLeads: Record<string, number[]> = {};
    for (const s of stages) stageLeads[s] = [];

    for (const l of leads) {
      if (!l.first_seen) continue;
      const daysSinceFirst = Math.max(0, (Date.now() - new Date(l.first_seen).getTime()) / 86400000);
      const stageIdx = stages.indexOf(l.status);
      if (stageIdx >= 0) {
        stageLeads[l.status].push(daysSinceFirst);
      }
    }

    const stageLabels: Record<string, string> = {
      new: "Nuevo", contacted: "Contactado", qualified: "Calificado",
      proposal: "Propuesta", negotiation: "Negociación", won: "Ganado",
    };

    return stages.map((s) => ({
      stage: stageLabels[s] || s,
      avgDays: stageLeads[s].length > 0
        ? Math.round(stageLeads[s].reduce((a, b) => a + b, 0) / stageLeads[s].length)
        : 0,
      count: stageLeads[s].length,
    }));
  }, [leads]);

  // ─── NEW: Lead Scoring Distribution by Segment (stacked area) ───
  const segmentScoreDistribution = useMemo(() => {
    const buckets: Record<string, Record<string, number>> = {};
    for (let i = 0; i < 10; i++) {
      const key = `${i * 10}-${i * 10 + 10}`;
      buckets[key] = { bucket: i * 10, hot: 0, warm: 0, cool: 0, cold: 0, dormant: 0, lost: 0 };
    }
    for (const l of leads) {
      const idx = Math.min(Math.floor(l.current_score / 10), 9);
      const key = `${idx * 10}-${idx * 10 + 10}`;
      const seg = l.segment || "lost";
      if (buckets[key][seg] !== undefined) buckets[key][seg]++;
    }
    return Object.values(buckets);
  }, [leads]);

  // ─── NEW: Channel Conversion Effectiveness ───
  const channelEffectiveness = useMemo(() => {
    const channelMap = new Map<string, { total: number; won: number; avgScore: number; scores: number[] }>();
    for (const l of leads) {
      for (const ch of l.channels ?? []) {
        if (!channelMap.has(ch)) channelMap.set(ch, { total: 0, won: 0, avgScore: 0, scores: [] });
        const entry = channelMap.get(ch)!;
        entry.total++;
        entry.scores.push(l.current_score);
        if (l.status === "won") entry.won++;
      }
    }
    return Array.from(channelMap.entries())
      .map(([channel, data]) => ({
        channel,
        conversionRate: data.total > 0 ? Math.round(data.won / data.total * 100) : 0,
        avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0,
        volume: data.total,
      }))
      .filter((c) => c.volume >= 5)
      .sort((a, b) => b.conversionRate - a.conversionRate);
  }, [leads]);

  // ─── NEW: Predictive Health Radar ───
  const healthRadar = useMemo(() => {
    const total = leads.length || 1;
    const won = leads.filter((l) => l.status === "won").length;
    const lost = leads.filter((l) => l.status === "lost").length;
    const hot = leads.filter((l) => l.segment === "hot").length;
    const warm = leads.filter((l) => l.segment === "warm").length;
    const avgScore = leads.reduce((s, l) => s + l.current_score, 0) / total;
    const rising = risingLeads.length;
    const declining = decliningLeads.length;

    return [
      { metric: "Win Rate", value: Math.min((won + lost) > 0 ? won / (won + lost) * 100 : 0, 100) },
      { metric: "Pipeline Caliente", value: Math.min((hot + warm) / total * 100, 100) },
      { metric: "Score Promedio", value: Math.min(avgScore, 100) },
      { metric: "Momentum (+)", value: Math.min(rising / total * 200, 100) },
      { metric: "Retención", value: Math.max(0, 100 - declining / total * 200) },
      { metric: "Engagement", value: Math.min(interactions.length / total * 5, 100) },
    ];
  }, [leads, interactions, risingLeads, decliningLeads]);

  return (
    <div className="space-y-6">
      {/* Score Forecast */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Pronóstico de Puntaje ECS (30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {forecasts.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={forecasts}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} className="fill-muted-foreground" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="actual" stroke="#1A4A28" strokeWidth={2} dot={false} name="Actual" connectNulls />
                <Line type="monotone" dataKey="forecast" stroke="#1A4A28" strokeWidth={2} strokeDasharray="8 4" dot={false} name="Pronóstico" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Datos insuficientes para generar pronóstico</p>
          )}
        </CardContent>
      </Card>

      {/* Revenue Impact + Predictive Health Radar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Impacto en Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                <span className="text-sm font-medium text-red-700 dark:text-red-400">Ingresos en Riesgo</span>
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-red-600 dark:text-red-400">₡{(revenueAtRisk / 1_000_000).toFixed(1)}M</p>
              <p className="text-xs text-red-600/70 dark:text-red-400/70">{decliningLeads.length} leads en descenso</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Ingresos Potenciales</span>
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">₡{(revenuePotential / 1_000_000).toFixed(1)}M</p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{risingLeads.length} leads en ascenso</p>
            </div>
          </CardContent>
        </Card>

        {/* NEW: Predictive Health Radar */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Radar de Salud Predictiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={healthRadar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
                <PolarRadiusAxis tick={{ fontSize: 8 }} domain={[0, 100]} />
                <Radar name="Salud" dataKey="value" stroke="#1A4A28" fill="#1A4A28" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Lead Quality Matrix (Scatter) + Segment Score Distribution (Stacked Area) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Matriz de Calidad de Leads (Score vs Interacciones)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" dataKey="interactions" name="Interacciones" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <YAxis type="number" dataKey="score" name="Score" domain={[0, 100]} tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <ZAxis type="number" range={[20, 200]} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [value ?? 0, name === "score" ? "Score" : "Interacciones"]}
                  labelFormatter={() => ""}
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border bg-card p-2 text-xs shadow-md">
                        <p className="font-semibold">{d?.name}</p>
                        <p>Score: {d?.score} · Interacciones: {d?.interactions}</p>
                        <p>Segmento: {d?.segment} · Estado: {d?.status}</p>
                      </div>
                    );
                  }}
                />
                {["hot", "warm", "cool", "cold", "dormant"].map((seg) => (
                  <Scatter
                    key={seg}
                    name={seg}
                    data={scatterData.filter((d) => d.segment === seg)}
                    fill={SEGMENT_COLORS[seg] || "#999"}
                    opacity={0.7}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
            <div className="mt-2 flex justify-center gap-3">
              {Object.entries(SEGMENT_COLORS).slice(0, 5).map(([seg, color]) => (
                <span key={seg} className="flex items-center gap-1 text-[9px]">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {seg}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Distribución de Score por Segmento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={segmentScoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="bucket" tick={{ fontSize: 9 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}`} />
                <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Area type="monotone" dataKey="hot" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} name="Hot" />
                <Area type="monotone" dataKey="warm" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} name="Warm" />
                <Area type="monotone" dataKey="cool" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="Cool" />
                <Area type="monotone" dataKey="cold" stackId="1" stroke="#6366F1" fill="#6366F1" fillOpacity={0.6} name="Cold" />
                <Area type="monotone" dataKey="dormant" stackId="1" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.6} name="Dormant" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Funnel Velocity + Channel Effectiveness */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Velocidad del Embudo (Días Promedio por Etapa)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={funnelVelocity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 9 }} width={80} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v ?? 0} días`, "Promedio"]} />
                <Bar dataKey="avgDays" name="Días promedio" radius={[0, 4, 4, 0]}>
                  {funnelVelocity.map((_, idx) => (
                    <Cell key={idx} fill={["#1A4A28", "#2A6A3A", "#3B82F6", "#F59E0B", "#8B5CF6", "#EF4444"][idx] || "#999"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Efectividad de Canales (Tasa de Conversión)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={channelEffectiveness}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="channel" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="conversionRate" name="Conversión %" fill="#1A4A28" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgScore" name="Score Prom." fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Segment Distribution */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">Distribución de Segmentos Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {segments.map((seg) => (
              <div key={seg.segment} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[seg.segment] || "#999" }} />
                  <span className="text-sm font-medium">{seg.segment}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${seg.percentage}%`, backgroundColor: SEGMENT_COLORS[seg.segment] || "#999" }} />
                  </div>
                  <span className="w-20 text-right text-sm text-muted-foreground">{seg.count} ({seg.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Churn Risk */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Modelo de Riesgo de Abandono (Top 20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Riesgo</TableHead>
                  <TableHead>Factores</TableHead>
                  <TableHead>Intervención</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {churnRisks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Sin leads en riesgo significativo</TableCell>
                  </TableRow>
                ) : (
                  churnRisks.map((risk) => (
                    <TableRow key={risk.leadId} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/leads/${risk.leadId}`)}>
                      <TableCell className="font-medium text-primary hover:underline">{risk.leadName}</TableCell>
                      <TableCell className="text-right">{risk.currentScore}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={risk.riskProbability >= 60 ? "destructive" : risk.riskProbability >= 30 ? "secondary" : "outline"}>
                          {risk.riskProbability}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {risk.riskFactors.slice(0, 2).map((f) => (
                            <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{risk.recommendedIntervention}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Conversion Probability — ALL LEADS */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            Probabilidad de Conversión — Todos los Leads ({conversionCandidates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[450px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Interacciones</TableHead>
                  <TableHead className="text-right">Tendencia</TableHead>
                  <TableHead className="text-right">Prob. Conversión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversionCandidates.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/leads/${c.id}`)}>
                    <TableCell className="font-medium text-primary hover:underline">{c.name}</TableCell>
                    <TableCell className="text-right">{c.score}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: SEGMENT_COLORS[c.segment] || "#999", color: SEGMENT_COLORS[c.segment] || "#999" }}>
                        {c.segment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{STATUS_LABELS[c.status] || c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">{c.interactions}</TableCell>
                    <TableCell className="text-right">
                      {c.trend > 0 ? (
                        <span className="text-emerald-500 font-semibold">+{c.trend}</span>
                      ) : c.trend < 0 ? (
                        <span className="text-red-500 font-semibold">{c.trend}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={c.probability >= 70 ? "default" : c.probability >= 40 ? "secondary" : "outline"}
                        className={c.probability >= 70 ? "bg-green-600" : ""}
                      >
                        {c.probability}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Meta Ads — Predictive */}
      <div className="mt-6 border-t pt-6">
        <h3 className="mb-4 font-display text-lg font-bold flex items-center gap-2">
          📣 Marketing & Ads — Predicción
        </h3>
        <MetaAdsPanel mode="predictive" />
      </div>
    </div>
  );
}
