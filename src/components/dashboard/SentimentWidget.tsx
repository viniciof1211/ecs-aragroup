import { useMemo } from "react";
import { Brain, CheckCircle2, XCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSentimentStore } from "@/stores/useSentimentStore";
import { useSentimentHealth } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface SentimentWidgetProps {
  totalLeads: number;
}

export function SentimentWidget({ totalLeads }: SentimentWidgetProps) {
  const navigate = useNavigate();
  const health = useSentimentHealth();
  const { results, isRunning, progress } = useSentimentStore();

  const isOnline = health.isSuccess && health.data?.status === "ok";
  const analyzedCount = Object.keys(results).length;
  const coverage = totalLeads > 0 ? Math.round((analyzedCount / totalLeads) * 100) : 0;

  const stats = useMemo(() => {
    const all = Object.values(results);
    if (all.length === 0) return { avg: 0, positive: 0, neutral: 0, negative: 0, riskCount: 0, intentCount: 0 };

    let total = 0;
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    let riskCount = 0;
    let intentCount = 0;

    for (const r of all) {
      total += r.sentiment_score;
      if (r.sentiment_score > 0.3) positive++;
      else if (r.sentiment_score < -0.3) negative++;
      else neutral++;
      if (r.risk_flags.length > 0) riskCount++;
      if (r.intent_signals.length > 0) intentCount++;
    }

    const len = all.length || 1;
    return {
      avg: total / len,
      positive: Math.round((positive / len) * 100),
      neutral: Math.round((neutral / len) * 100),
      negative: Math.round((negative / len) * 100),
      riskCount,
      intentCount,
    };
  }, [results]);

  const pct = progress
    ? Math.round((progress.done / Math.max(progress.total, 1)) * 100)
    : 0;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Brain className="h-5 w-5 text-purple-500" />
          Sentimiento IA
          <InfoTooltip text="Resumen del análisis de sentimiento por IA (GPT-4o-mini). Cobertura = % de leads analizados. Sentimiento Prom. = promedio del puntaje de sentimiento (-1 a +1). Positivo/Neutral/Negativo = distribución porcentual. Leads en riesgo = con alertas de IA. Señales de compra = leads con intención detectada." />
          {isOnline ? (
            <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="ml-auto h-4 w-4 text-red-400" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Coverage */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cobertura</span>
            <span className="font-display font-bold">
              {analyzedCount.toLocaleString("es-CR")} / {totalLeads.toLocaleString("es-CR")} ({coverage}%)
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{ width: `${coverage}%` }}
            />
          </div>
        </div>

        {/* Running progress */}
        {isRunning && progress && (
          <div className="rounded-lg bg-purple-50 p-2 text-xs text-purple-700 dark:bg-purple-950/30 dark:text-purple-300">
            Analizando... {pct}% — Lote {progress.currentBatch}/{progress.totalBatches}
          </div>
        )}

        {/* Stats */}
        {analyzedCount > 0 && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sentimiento Prom.</span>
              <span className={cn(
                "font-display font-bold",
                stats.avg > 0.3 ? "text-emerald-600" :
                stats.avg < -0.3 ? "text-red-500" : "text-amber-500"
              )}>
                {stats.avg > 0 ? "+" : ""}{stats.avg.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-600">Positivo: {stats.positive}%</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-amber-500">Neutral: {stats.neutral}%</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-red-500">Negativo: {stats.negative}%</span>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-400" />
                {stats.riskCount} leads en riesgo
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                {stats.intentCount} con señales de compra
              </span>
            </div>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate("/analytics")}
        >
          {analyzedCount === 0 ? "Ejecutar Análisis →" : "Ver Detalles →"}
        </Button>
      </CardContent>
    </Card>
  );
}
