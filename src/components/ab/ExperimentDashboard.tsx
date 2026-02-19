import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Pause,
  Play,
  Trash2,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus,
  FlaskConical,
  Clock,
  BookOpen,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLeads } from "@/hooks/useLeads";
import {
  useExperimentStore,
  type Experiment,
} from "@/stores/useExperimentStore";
import { STATUS_LABELS } from "@/types/ecs";
import type { ECSLead } from "@/types/ecs";
import { CookbookPanel } from "./CookbookPanel";

// ─── Compute live tracking data from current lead state ───
interface LiveTracking {
  variantA: VariantMetrics;
  variantB: VariantMetrics;
  overallLift: number;
}

interface VariantMetrics {
  avgCurrentScore: number;
  avgEnrolledScore: number;
  scoreDelta: number;
  statusChanges: number;
  improved: number;
  declined: number;
  unchanged: number;
  leads: Array<{
    leadId: string;
    leadName: string;
    variant: "A" | "B";
    enrolledScore: number;
    currentScore: number;
    enrolledStatus: string;
    currentStatus: string;
    delta: number;
  }>;
}

function computeLiveTracking(experiment: Experiment, allLeads: ECSLead[]): LiveTracking {
  const leadMap = new Map(allLeads.map((l) => [l.id, l]));

  const buildMetrics = (variant: "A" | "B"): VariantMetrics => {
    const enrolled = experiment.leads.filter((l) => l.variant === variant);
    let totalEnrolled = 0;
    let totalCurrent = 0;
    let statusChanges = 0;
    let improved = 0;
    let declined = 0;
    let unchanged = 0;
    const leads: VariantMetrics["leads"] = [];

    for (const el of enrolled) {
      const current = leadMap.get(el.leadId);
      const currentScore = current?.current_score ?? el.enrolledScore;
      const currentStatus = current?.status ?? el.enrolledStatus;
      const delta = currentScore - el.enrolledScore;

      totalEnrolled += el.enrolledScore;
      totalCurrent += currentScore;
      if (currentStatus !== el.enrolledStatus) statusChanges++;
      if (delta > 2) improved++;
      else if (delta < -2) declined++;
      else unchanged++;

      leads.push({
        leadId: el.leadId,
        leadName: el.leadName,
        variant,
        enrolledScore: el.enrolledScore,
        currentScore,
        enrolledStatus: el.enrolledStatus,
        currentStatus,
        delta,
      });
    }

    const count = enrolled.length || 1;
    return {
      avgCurrentScore: Math.round(totalCurrent / count),
      avgEnrolledScore: Math.round(totalEnrolled / count),
      scoreDelta: Math.round((totalCurrent - totalEnrolled) / count * 10) / 10,
      statusChanges,
      improved,
      declined,
      unchanged,
      leads,
    };
  };

  const variantA = buildMetrics("A");
  const variantB = buildMetrics("B");
  const overallLift = variantA.scoreDelta - variantB.scoreDelta;

  return { variantA, variantB, overallLift };
}

// ─── Single Experiment Card ───
function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const { data: allLeads = [] } = useLeads();
  const updateExperiment = useExperimentStore((s) => s.updateExperiment);
  const removeExperiment = useExperimentStore((s) => s.removeExperiment);

  const tracking = useMemo(
    () => computeLiveTracking(experiment, allLeads),
    [experiment, allLeads]
  );

  const daysElapsed = Math.floor(
    (Date.now() - new Date(experiment.startedAt).getTime()) / 86400000
  );
  const daysRemaining = Math.max(0, experiment.test.durationDays - daysElapsed);
  const progressPct = Math.min(100, Math.round((daysElapsed / experiment.test.durationDays) * 100));

  const variantALeads = experiment.leads.filter((l) => l.variant === "A").length;
  const variantBLeads = experiment.leads.filter((l) => l.variant === "B").length;

  // Chart data: projected vs actual
  const chartData = useMemo(() => [
    {
      name: "Variante A (Tratamiento)",
      "Score Inicial": tracking.variantA.avgEnrolledScore,
      "Score Actual": tracking.variantA.avgCurrentScore,
      "Proyección": Math.round(tracking.variantA.avgEnrolledScore * (1 + experiment.projections.expectedLiftPct / 100)),
    },
    {
      name: "Variante B (Control)",
      "Score Inicial": tracking.variantB.avgEnrolledScore,
      "Score Actual": tracking.variantB.avgCurrentScore,
      "Proyección": tracking.variantB.avgEnrolledScore,
    },
  ], [tracking, experiment.projections.expectedLiftPct]);

  const toggleStatus = useCallback(() => {
    updateExperiment(experiment.id, {
      status: experiment.status === "active" ? "paused" : "active",
    });
  }, [experiment.id, experiment.status, updateExperiment]);

  const markComplete = useCallback(() => {
    updateExperiment(experiment.id, { status: "completed" });
  }, [experiment.id, updateExperiment]);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={cn(
                  "text-[10px]",
                  experiment.status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                  experiment.status === "paused" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                  "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300"
                )}
              >
                {experiment.status === "active" ? "Activo" : experiment.status === "paused" ? "Pausado" : "Completado"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {experiment.test.category === "conversion" ? "Conversión" :
                 experiment.test.category === "reactivation" ? "Reactivación" : "Fidelización"}
              </Badge>
            </div>
            <CardTitle className="mt-1.5 font-display text-base leading-tight">
              {experiment.test.title}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{experiment.test.hypothesis}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleStatus} title={experiment.status === "active" ? "Pausar" : "Reanudar"}>
              {experiment.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            {experiment.status !== "completed" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={markComplete} title="Completar">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => removeExperiment(experiment.id)} title="Eliminar">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Día {daysElapsed} de {experiment.test.durationDays}</span>
            <span>{daysRemaining > 0 ? `${daysRemaining} días restantes` : "Período completado"}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progressPct >= 100 ? "bg-emerald-500" : "bg-[#1A4A28]"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Leads</p>
            <p className="mt-0.5 font-display text-lg font-bold">{experiment.leads.length}</p>
            <p className="text-[10px] text-muted-foreground">A: {variantALeads} · B: {variantBLeads}</p>
          </div>
          <div className="rounded-lg border p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lift Proyectado</p>
            <p className="mt-0.5 font-display text-lg font-bold text-blue-600">+{experiment.projections.expectedLiftPct}%</p>
            <p className="text-[10px] text-muted-foreground">vs baseline {experiment.projections.baselineConversionPct}%</p>
          </div>
          <div className="rounded-lg border p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lift Real (A vs B)</p>
            <p className={cn(
              "mt-0.5 font-display text-lg font-bold",
              tracking.overallLift > 0 ? "text-emerald-600" : tracking.overallLift < 0 ? "text-red-500" : "text-muted-foreground"
            )}>
              {tracking.overallLift > 0 ? "+" : ""}{tracking.overallLift.toFixed(1)}
            </p>
            <p className="text-[10px] text-muted-foreground">puntos score promedio</p>
          </div>
          <div className="rounded-lg border p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cambios Estado</p>
            <p className="mt-0.5 font-display text-lg font-bold">{tracking.variantA.statusChanges + tracking.variantB.statusChanges}</p>
            <p className="text-[10px] text-muted-foreground">A: {tracking.variantA.statusChanges} · B: {tracking.variantB.statusChanges}</p>
          </div>
        </div>

        {/* Chart: Projected vs Actual */}
        <div className="rounded-lg border p-3">
          <p className="text-xs font-bold mb-2">Proyección BI vs Tracking Real</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Score Inicial" fill="#94a3b8" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Score Actual" fill="#1A4A28" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Proyección" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Variant Comparison Table */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <VariantSummary
            label="Variante A (Tratamiento)"
            color="emerald"
            metrics={tracking.variantA}
            test={experiment.test}
          />
          <VariantSummary
            label="Variante B (Control)"
            color="blue"
            metrics={tracking.variantB}
            test={experiment.test}
          />
        </div>

        {/* Lead-level detail (collapsed by default) */}
        <LeadDetailTable tracking={tracking} />

        {/* Cookbook Execution */}
        <CookbookSection experiment={experiment} />
      </CardContent>
    </Card>
  );
}

// ─── Variant Summary Card ───
function VariantSummary({
  label,
  color,
  metrics,
}: {
  label: string;
  color: "emerald" | "blue";
  metrics: VariantMetrics;
  test: any;
}) {
  const borderClass = color === "emerald" ? "border-emerald-200 dark:border-emerald-800" : "border-blue-200 dark:border-blue-800";
  const bgClass = color === "emerald" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-blue-50/50 dark:bg-blue-950/20";
  const titleClass = color === "emerald" ? "text-emerald-700 dark:text-emerald-400" : "text-blue-700 dark:text-blue-400";

  return (
    <div className={cn("rounded-lg border p-3", borderClass, bgClass)}>
      <p className={cn("text-[10px] font-bold uppercase tracking-wider", titleClass)}>{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Score Promedio</p>
          <p className="font-bold">{metrics.avgCurrentScore}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Δ Score</p>
          <p className={cn("font-bold", metrics.scoreDelta > 0 ? "text-emerald-600" : metrics.scoreDelta < 0 ? "text-red-500" : "")}>
            {metrics.scoreDelta > 0 ? "+" : ""}{metrics.scoreDelta}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Mejoraron</p>
          <p className="font-bold text-emerald-600">{metrics.improved}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Declinaron</p>
          <p className="font-bold text-red-500">{metrics.declined}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Detail Table ───
function LeadDetailTable({ tracking }: { tracking: LiveTracking }) {
  const [expanded, setExpanded] = useState(false);
  const allLeads = [...tracking.variantA.leads, ...tracking.variantB.leads];
  allLeads.sort((a, b) => b.delta - a.delta);

  if (allLeads.length === 0) return null;

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs w-full"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Ocultar detalle por lead" : `Ver detalle por lead (${allLeads.length})`}
      </Button>
      {expanded && (
        <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="p-2 text-left font-medium">Lead</th>
                <th className="p-2 text-center font-medium">Var.</th>
                <th className="p-2 text-center font-medium">Score Ini.</th>
                <th className="p-2 text-center font-medium">Score Act.</th>
                <th className="p-2 text-center font-medium">Δ</th>
                <th className="p-2 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {allLeads.map((l) => (
                <tr key={l.leadId} className="border-t hover:bg-muted/30">
                  <td className="p-2 truncate max-w-[150px]">{l.leadName}</td>
                  <td className="p-2 text-center">
                    <Badge variant="outline" className={cn("text-[9px]", l.variant === "A" ? "border-emerald-300" : "border-blue-300")}>
                      {l.variant}
                    </Badge>
                  </td>
                  <td className="p-2 text-center">{l.enrolledScore}</td>
                  <td className="p-2 text-center font-medium">{l.currentScore}</td>
                  <td className="p-2 text-center">
                    <span className={cn(
                      "inline-flex items-center gap-0.5 font-medium",
                      l.delta > 2 ? "text-emerald-600" : l.delta < -2 ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {l.delta > 2 ? <ArrowUp className="h-3 w-3" /> : l.delta < -2 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {l.delta > 0 ? "+" : ""}{l.delta}
                    </span>
                  </td>
                  <td className="p-2">
                    {l.currentStatus !== l.enrolledStatus ? (
                      <span className="text-amber-600">
                        {STATUS_LABELS[l.enrolledStatus as keyof typeof STATUS_LABELS] || l.enrolledStatus} → {STATUS_LABELS[l.currentStatus as keyof typeof STATUS_LABELS] || l.currentStatus}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{STATUS_LABELS[l.currentStatus as keyof typeof STATUS_LABELS] || l.currentStatus}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Cookbook Section (collapsible) ───
function CookbookSection({ experiment }: { experiment: Experiment }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t pt-3">
      <Button
        variant={open ? "default" : "outline"}
        size="sm"
        className={cn("w-full gap-2 text-xs", open && "bg-[#1A4A28] hover:bg-[#2A6A3A]")}
        onClick={() => setOpen(!open)}
      >
        <BookOpen className="h-3.5 w-3.5" />
        {open ? "Ocultar Cookbook de Ejecución" : "📖 Abrir Cookbook de Ejecución"}
      </Button>
      {open && (
        <div className="mt-4">
          <CookbookPanel experiment={experiment} />
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───
export function ExperimentDashboard() {
  const experiments = useExperimentStore((s) => s.experiments);
  const hydrate = useExperimentStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = experiments.filter((e) => e.status === "active");
  const paused = experiments.filter((e) => e.status === "paused");
  const completed = experiments.filter((e) => e.status === "completed");

  if (experiments.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FlaskConical className="h-16 w-16 text-muted-foreground/20" />
          <h3 className="mt-4 font-display text-lg font-bold">Sin Experimentos</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
            Selecciona una prueba A/B de la pestaña "Recomendaciones" y haz clic en
            "Ejecutar Prueba" para crear tu primer experimento con leads reales.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
              <Play className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{active.length}</p>
              <p className="text-xs text-muted-foreground">Activos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
              <Pause className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{paused.length}</p>
              <p className="text-xs text-muted-foreground">Pausados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <CheckCircle2 className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completed.length}</p>
              <p className="text-xs text-muted-foreground">Completados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Experiment Cards */}
      {active.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Play className="h-4 w-4 text-emerald-600" /> Experimentos Activos
          </h2>
          {active.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </div>
      )}

      {paused.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Pause className="h-4 w-4 text-amber-600" /> Pausados
          </h2>
          {paused.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-slate-500" /> Completados
          </h2>
          {completed.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </div>
      )}
    </div>
  );
}
