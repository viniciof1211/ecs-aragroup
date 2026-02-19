import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
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

interface PredictiveTabProps {
  leads: ECSLead[];
  interactions: ECSInteraction[];
}

export function PredictiveTab({ leads, interactions }: PredictiveTabProps) {
  const navigate = useNavigate();
  const forecasts = scoreForecasts(leads, interactions, 30);
  const churnRisks = churnRiskAnalysis(leads, interactions).slice(0, 20);
  const segments = segmentDistribution(leads);

  // Conversion probability for warm/hot leads
  const conversionCandidates = leads
    .filter((l) => l.current_score >= 60)
    .map((l) => {
      const trend = l.current_score - l.previous_score;
      const interactionCount = l.interaction_count ?? 0;
      let probability = 0;

      // Simple heuristic model
      probability += Math.min(l.current_score * 0.4, 40);
      probability += Math.min(interactionCount * 2, 20);
      if (trend > 0) probability += Math.min(trend * 2, 20);
      if (l.status === "negotiation") probability += 15;
      else if (l.status === "proposal") probability += 10;
      else if (l.status === "qualified") probability += 5;

      return {
        id: l.id,
        name: l.name,
        score: l.current_score,
        status: l.status,
        probability: Math.min(Math.round(probability), 95),
        trend,
      };
    })
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 15);

  // Revenue impact
  const avgDealValue = 2_500_000; // ₡2.5M average deal
  const decliningLeads = leads.filter((l) => l.current_score < l.previous_score - 5);
  const risingLeads = leads.filter((l) => l.current_score > l.previous_score + 5);
  const revenueAtRisk = decliningLeads.length * avgDealValue * 0.3;
  const revenuePotential = risingLeads.length * avgDealValue * 0.5;

  return (
    <div className="space-y-6">
      {/* Score Forecast */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">
            Pronóstico de Puntaje ECS (30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {forecasts.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={forecasts}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} className="fill-muted-foreground" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#1A4A28"
                  strokeWidth={2}
                  dot={false}
                  name="Actual"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#1A4A28"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={false}
                  name="Pronóstico"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Datos insuficientes para generar pronóstico
            </p>
          )}
        </CardContent>
      </Card>

      {/* Revenue Impact + Segment Forecast */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              Impacto en Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  Ingresos en Riesgo
                </span>
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-red-600 dark:text-red-400">
                ₡{(revenueAtRisk / 1_000_000).toFixed(1)}M
              </p>
              <p className="text-xs text-red-600/70 dark:text-red-400/70">
                {decliningLeads.length} leads en descenso
              </p>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Ingresos Potenciales
                </span>
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ₡{(revenuePotential / 1_000_000).toFixed(1)}M
              </p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                {risingLeads.length} leads en ascenso
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Distribución de Segmentos Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {segments.map((seg) => (
                <div key={seg.segment} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{seg.segment}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${seg.percentage}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-sm text-muted-foreground">
                      {seg.count} ({seg.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Churn Risk */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Modelo de Riesgo de Abandono (Top 20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
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
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin leads en riesgo significativo
                    </TableCell>
                  </TableRow>
                ) : (
                  churnRisks.map((risk) => (
                    <TableRow key={risk.leadId} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/leads/${risk.leadId}`)}>
                      <TableCell className="font-medium text-primary hover:underline">{risk.leadName}</TableCell>
                      <TableCell className="text-right">{risk.currentScore}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            risk.riskProbability >= 60
                              ? "destructive"
                              : risk.riskProbability >= 30
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {risk.riskProbability}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {risk.riskFactors.slice(0, 2).map((f) => (
                            <Badge key={f} variant="outline" className="text-[10px]">
                              {f}
                            </Badge>
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

      {/* Conversion Probability */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">
            Probabilidad de Conversión (Leads Calientes/Tibios)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Estado</TableHead>
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
                      <Badge variant="outline" className="text-xs">
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.trend > 0 ? (
                        <span className="text-emerald-500">+{c.trend}</span>
                      ) : c.trend < 0 ? (
                        <span className="text-red-500">{c.trend}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={c.probability >= 70 ? "default" : "secondary"}
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
    </div>
  );
}
