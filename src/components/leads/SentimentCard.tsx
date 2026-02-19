import { useState } from "react";
import { Brain, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSentimentStore } from "@/stores/useSentimentStore";
import { buildLeadPayload, SINGLE_LEAD_TIMEOUT_MS } from "@/lib/sentiment";
import { analyzeSentimentSingle } from "@/lib/api";
import { cn } from "@/lib/utils";
import { translateSentimentResult } from "@/lib/translate-es";
import type { ECSLead, ECSInteraction } from "@/types/ecs";

const SENTIMENT_LABELS: Record<string, string> = {
  very_positive: "Muy Positivo",
  positive: "Positivo",
  neutral: "Neutral",
  negative: "Negativo",
  very_negative: "Muy Negativo",
};

const QUALITY_LABELS: Record<string, string> = {
  excellent: "Excelente",
  good: "Bueno",
  moderate: "Moderado",
  poor: "Pobre",
  minimal: "Mínimo",
};

interface SentimentCardProps {
  lead: ECSLead;
  interactions: ECSInteraction[];
}

export function SentimentCard({ lead, interactions }: SentimentCardProps) {
  const store = useSentimentStore();
  const rawResult = store.results[lead.id] ?? null;
  const result = rawResult ? translateSentimentResult(rawResult) : null;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const payload = buildLeadPayload(lead, interactions);
      const res = await analyzeSentimentSingle(
        payload,
        AbortSignal.timeout(SINGLE_LEAD_TIMEOUT_MS)
      );
      store.mergeResults({ [res.lead_id]: res });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Brain className="h-5 w-5 text-purple-500" />
          Análisis de Sentimiento IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* No result yet */}
        {!result && !isAnalyzing && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              ⚠️ Aún no analizado
            </p>
            <Button onClick={handleAnalyze} className="w-full" variant="outline">
              <Brain className="mr-2 h-4 w-4" />
              Analizar Este Lead
            </Button>
            <p className="text-xs text-muted-foreground">
              O ejecute el análisis masivo desde la página de Analytics.
            </p>
          </div>
        )}

        {/* Loading */}
        {isAnalyzing && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            <span className="ml-2 text-sm text-muted-foreground">
              Analizando con IA...
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Result */}
        {result && !isAnalyzing && (
          <div className="space-y-3">
            {/* Sentiment bar */}
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sentimiento</span>
                <span className={cn(
                  "font-display font-bold",
                  result.sentiment_score > 0.3 ? "text-emerald-600" :
                  result.sentiment_score < -0.3 ? "text-red-500" : "text-amber-500"
                )}>
                  {result.sentiment_score > 0 ? "+" : ""}{result.sentiment_score.toFixed(2)}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    result.sentiment_score > 0.3 ? "bg-emerald-500" :
                    result.sentiment_score < -0.3 ? "bg-red-500" : "bg-amber-500"
                  )}
                  style={{ width: `${Math.round((result.sentiment_score + 1) / 2 * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <Badge
                  variant={
                    result.sentiment_label.includes("positive") ? "default" :
                    result.sentiment_label.includes("negative") ? "destructive" : "secondary"
                  }
                  className="text-[10px]"
                >
                  {SENTIMENT_LABELS[result.sentiment_label] || result.sentiment_label}
                </Badge>
              </div>
            </div>

            {/* Quality + Bonus */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Calidad</span>
              <Badge variant="outline">
                {QUALITY_LABELS[result.engagement_quality] || result.engagement_quality}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Bonus ECS</span>
              <span className={cn(
                "font-display font-bold",
                result.ecs_sentiment_bonus >= 0 ? "text-emerald-600" : "text-red-500"
              )}>
                {result.ecs_sentiment_bonus >= 0 ? "+" : ""}{result.ecs_sentiment_bonus.toFixed(1)} pts
              </span>
            </div>

            {/* Intent Signals */}
            {result.intent_signals.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Señales de intención
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.intent_signals.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Flags */}
            {result.risk_flags.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Riesgos
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.risk_flags.map((f) => (
                    <Badge key={f} variant="destructive" className="text-[10px]">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Action */}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Acción recomendada
              </p>
              <p className="mt-1 text-sm">{result.recommended_action}</p>
            </div>

            {/* Reasoning */}
            {result.reasoning && (
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Razonamiento IA
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{result.reasoning}</p>
              </div>
            )}

            {/* Re-analyze */}
            <Button
              onClick={handleAnalyze}
              variant="ghost"
              size="sm"
              className="w-full"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Re-analizar este lead
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
