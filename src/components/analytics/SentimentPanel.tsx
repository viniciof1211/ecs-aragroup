import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSentiment, useSentimentHealth } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { translateFreeText } from "@/lib/translate-es";
import type { ECSLead, ECSInteraction, SentimentResult } from "@/types/ecs";
import { MetaAdsPanel } from "./MetaAdsPanel";

const SENTIMENT_LABELS: Record<string, string> = {
  very_positive: "Muy Positivo",
  positive: "Positivo",
  neutral: "Neutral",
  negative: "Negativo",
  very_negative: "Muy Negativo",
};

const SENTIMENT_COLORS: Record<string, string> = {
  very_positive: "#22c55e",
  positive: "#4ade80",
  neutral: "#facc15",
  negative: "#f97316",
  very_negative: "#ef4444",
};

const QUALITY_LABELS: Record<string, string> = {
  excellent: "Excelente",
  good: "Bueno",
  moderate: "Moderado",
  poor: "Pobre",
  minimal: "Mínimo",
};

const QUALITY_COLORS = ["#22c55e", "#4ade80", "#facc15", "#f97316", "#ef4444"];

interface SentimentPanelProps {
  leads: ECSLead[];
  interactions: ECSInteraction[];
}

export function SentimentPanel({ leads, interactions }: SentimentPanelProps) {
  const navigate = useNavigate();
  const health = useSentimentHealth();
  const sentiment = useSentiment(leads, interactions);
  const [sortBy, setSortBy] = useState<"score" | "sentiment" | "bonus">("sentiment");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [visibleCount, setVisibleCount] = useState(50);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOnline = health.isSuccess && health.data?.status === "ok";

  // ─── Aggregated Stats ───
  const stats = useMemo(() => {
    const results = Object.values(sentiment.results);
    if (results.length === 0) {
      return { avgScore: 0, positiveCount: 0, riskCount: 0, intentCount: 0 };
    }

    let totalScore = 0;
    let positiveCount = 0;
    let riskCount = 0;
    let intentCount = 0;

    for (const r of results) {
      totalScore += r.sentiment_score;
      if (r.sentiment_score > 0.3) positiveCount++;
      if (r.risk_flags.length > 0) riskCount++;
      if (r.intent_signals.length > 0) intentCount++;
    }

    return {
      avgScore: totalScore / results.length,
      positiveCount,
      riskCount,
      intentCount,
    };
  }, [sentiment.results]);

  // ─── Sentiment Distribution ───
  const sentimentDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of Object.values(sentiment.results)) {
      counts[r.sentiment_label] = (counts[r.sentiment_label] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({
      name: SENTIMENT_LABELS[name] || name,
      value,
      color: SENTIMENT_COLORS[name] || "#94a3b8",
    }));
  }, [sentiment.results]);

  // ─── Engagement Quality Distribution ───
  const qualityDist = useMemo(() => {
    const order = ["excellent", "good", "moderate", "poor", "minimal"];
    const counts: Record<string, number> = {};
    for (const r of Object.values(sentiment.results)) {
      counts[r.engagement_quality] = (counts[r.engagement_quality] || 0) + 1;
    }
    return order.map((q, i) => ({
      name: QUALITY_LABELS[q] || q,
      value: counts[q] || 0,
      color: QUALITY_COLORS[i],
    }));
  }, [sentiment.results]);

  // ─── Top Intent Signals ───
  const topIntents = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of Object.values(sentiment.results)) {
      for (const s of r.intent_signals) {
        counts[s] = (counts[s] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [sentiment.results]);

  // ─── Top Risk Flags ───
  const topRisks = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of Object.values(sentiment.results)) {
      for (const f of r.risk_flags) {
        counts[f] = (counts[f] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [sentiment.results]);

  // ─── Scatter data: ECS Score vs Sentiment ───
  const scatterData = useMemo(() => {
    return leads
      .filter((l) => sentiment.results[l.id])
      .map((l) => {
        const r = sentiment.results[l.id];
        return {
          x: l.current_score,
          y: r.sentiment_score,
          name: l.name,
          bonus: r.ecs_sentiment_bonus,
        };
      });
  }, [leads, sentiment.results]);

  // ─── Sorted leads table ───
  const sortedLeads = useMemo(() => {
    return leads
      .filter((l) => sentiment.results[l.id])
      .sort((a, b) => {
        const ra = sentiment.results[a.id];
        const rb = sentiment.results[b.id];
        let diff = 0;
        if (sortBy === "score") diff = a.current_score - b.current_score;
        else if (sortBy === "sentiment") diff = ra.sentiment_score - rb.sentiment_score;
        else diff = ra.ecs_sentiment_bonus - rb.ecs_sentiment_bonus;
        return sortDir === "desc" ? -diff : diff;
      });
  }, [leads, sentiment.results, sortBy, sortDir]);

  const visibleLeads = useMemo(() => sortedLeads.slice(0, visibleCount), [sortedLeads, visibleCount]);

  const toggleSort = (col: "score" | "sentiment" | "bonus") => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
    setVisibleCount(50);
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      setVisibleCount((prev) => Math.min(prev + 50, sortedLeads.length));
    }
  }, [sortedLeads.length]);

  const pct = sentiment.progress
    ? Math.round((sentiment.progress.done / Math.max(sentiment.progress.total, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="shadow-card">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-purple-500" />
            <div>
              <h2 className="font-display text-lg font-bold">
                Agente de Análisis de Sentimiento
              </h2>
              <p className="text-xs text-muted-foreground">
                Modelo: openai/gpt-4o-mini vía OpenRouter
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {health.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isOnline ? (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> En línea
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-red-500">
                <XCircle className="h-4 w-4" /> Sin conexión
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cobertura</p>
            <p className="font-display text-2xl font-bold">{sentiment.coverage}%</p>
            <p className="text-xs text-muted-foreground">
              {sentiment.analyzedCount.toLocaleString("es-CR")} / {sentiment.totalLeads.toLocaleString("es-CR")}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sentimiento Prom.</p>
            <p className={cn("font-display text-2xl font-bold", stats.avgScore > 0.3 ? "text-emerald-600" : stats.avgScore < -0.3 ? "text-red-500" : "text-amber-500")}>
              {stats.avgScore > 0 ? "+" : ""}{stats.avgScore.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Positivos</p>
            <p className="font-display text-2xl font-bold text-emerald-600">
              {stats.positiveCount.toLocaleString("es-CR")}
            </p>
            <p className="text-xs text-muted-foreground">leads</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">En Riesgo</p>
            <p className="font-display text-2xl font-bold text-red-500">
              {stats.riskCount.toLocaleString("es-CR")}
            </p>
            <p className="text-xs text-muted-foreground">leads con alertas</p>
          </CardContent>
        </Card>
      </div>

      {/* Run Controls */}
      <Card className="shadow-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {!sentiment.isRunning ? (
              <>
                <Button onClick={() => sentiment.analyzeAll()} disabled={!isOnline}>
                  <Play className="mr-2 h-4 w-4" />
                  Analizar Todos ({sentiment.totalLeads.toLocaleString("es-CR")} Leads)
                </Button>
                {sentiment.analyzedCount > 0 && sentiment.analyzedCount < sentiment.totalLeads && (
                  <Button variant="outline" onClick={() => sentiment.analyzeNew()} disabled={!isOnline}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Analizar Nuevos ({(sentiment.totalLeads - sentiment.analyzedCount).toLocaleString("es-CR")})
                  </Button>
                )}
                {sentiment.analyzedCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={sentiment.clearResults}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Limpiar Caché
                  </Button>
                )}
              </>
            ) : (
              <Button variant="destructive" onClick={sentiment.cancel}>
                <Square className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            )}
          </div>

          {sentiment.isRunning && sentiment.progress && (
            <div className="space-y-1.5">
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {pct}% — Lote {sentiment.progress.currentBatch}/{sentiment.progress.totalBatches}
                {" · "}{sentiment.progress.done.toLocaleString("es-CR")} procesados
                {sentiment.progress.failed > 0 && (
                  <span className="text-red-500"> · {sentiment.progress.failed} fallidos</span>
                )}
              </p>
              {sentiment.progress.lastError && (
                <p className="text-xs text-red-500 truncate" title={sentiment.progress.lastError}>
                  ⚠ {sentiment.progress.lastError}
                </p>
              )}
            </div>
          )}

          {!sentiment.isRunning && sentiment.progress && sentiment.progress.failed > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
              <XCircle className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{sentiment.progress.failed} leads fallaron el análisis</p>
                {sentiment.progress.lastError && (
                  <p className="text-xs mt-0.5 opacity-80">{sentiment.progress.lastError}</p>
                )}
                <p className="text-xs mt-1">
                  {sentiment.progress.done > 0
                    ? `${sentiment.progress.done} leads se analizaron exitosamente.`
                    : "Verifique la conexión al agente de sentimiento."}
                </p>
              </div>
            </div>
          )}

          {sentiment.lastAnalyzedAt && !sentiment.isRunning && (
            <p className="text-xs text-muted-foreground">
              Último análisis: {new Date(sentiment.lastAnalyzedAt).toLocaleString("es-CR")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Charts — only show if we have results */}
      {sentiment.analyzedCount > 0 && (
        <>
          {/* Row: Sentiment Dist + Quality Dist */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg">
                  Distribución de Sentimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={sentimentDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {sentimentDist.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg">
                  Calidad de Engagement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={qualityDist}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                      }}
                    />
                    <Bar dataKey="value" name="Leads" radius={[4, 4, 0, 0]}>
                      {qualityDist.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row: Scatter + Bonus Histogram */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg">
                  ECS Score vs Sentimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" dataKey="x" name="ECS Score" domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis type="number" dataKey="y" name="Sentimiento" domain={[-1, 1]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <ZAxis range={[20, 60]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "0.75rem",
                      }}
                      formatter={((value: unknown, name?: string) => [
                        name === "ECS Score" ? String(value) : Number(value).toFixed(2),
                        name === "x" ? "ECS Score" : "Sentimiento",
                      ]) as never}
                    />
                    <Scatter data={scatterData} fill="#8b5cf6" fillOpacity={0.5} />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Intent Signals + Risk Flags */}
            <div className="space-y-6">
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-lg">
                    Señales de Intención (Top 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topIntents.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
                  ) : (
                    <div className="space-y-1.5">
                      {topIntents.map(([signal, count]) => (
                        <div key={signal} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                          <span>{signal}</span>
                          <Badge variant="secondary">{count.toLocaleString("es-CR")}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-lg">
                    Alertas de Riesgo (Top 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topRisks.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Sin datos</p>
                  ) : (
                    <div className="space-y-1.5">
                      {topRisks.map(([flag, count]) => (
                        <div key={flag} className="flex items-center justify-between rounded-md bg-destructive/5 px-3 py-1.5 text-sm">
                          <span>{flag}</span>
                          <Badge variant="destructive">{count.toLocaleString("es-CR")}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Leads Table */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg">
                  Leads por Sentimiento
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {visibleCount >= sortedLeads.length
                    ? `${sortedLeads.length} leads`
                    : `${visibleCount} de ${sortedLeads.length} leads`}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] overflow-auto" onScroll={handleScroll} ref={scrollRef}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("score")}>
                        Score {sortBy === "score" && (sortDir === "desc" ? "↓" : "↑")}
                      </TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("sentiment")}>
                        Sentimiento {sortBy === "sentiment" && (sortDir === "desc" ? "↓" : "↑")}
                      </TableHead>
                      <TableHead>Calidad</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("bonus")}>
                        Bonus {sortBy === "bonus" && (sortDir === "desc" ? "↓" : "↑")}
                      </TableHead>
                      <TableHead>Acción Recomendada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleLeads.map((lead) => {
                      const r = sentiment.results[lead.id] as SentimentResult;
                      return (
                        <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/leads/${lead.id}`)}>
                          <TableCell className="font-medium text-primary hover:underline">{lead.name}</TableCell>
                          <TableCell className="text-right">{lead.current_score}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  r.sentiment_score > 0.3 ? "bg-green-500" :
                                  r.sentiment_score > -0.3 ? "bg-yellow-500" :
                                  "bg-red-500"
                                )}
                              />
                              <span className="text-xs">
                                {r.sentiment_score > 0 ? "+" : ""}{r.sentiment_score.toFixed(2)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {QUALITY_LABELS[r.engagement_quality] || r.engagement_quality}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn("text-right font-display font-semibold", r.ecs_sentiment_bonus >= 0 ? "text-emerald-600" : "text-red-500")}>
                            {r.ecs_sentiment_bonus >= 0 ? "+" : ""}{r.ecs_sentiment_bonus.toFixed(1)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {translateFreeText(r.recommended_action)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {visibleCount < sortedLeads.length && (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-xs text-muted-foreground">Cargando m\u00e1s...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Meta Ads — Sentiment */}
      <div className="mt-6 border-t pt-6">
        <h3 className="mb-4 font-display text-lg font-bold flex items-center gap-2">
          📣 Marketing & Ads — Sentimiento
        </h3>
        <MetaAdsPanel mode="sentiment" />
      </div>
    </div>
  );
}
