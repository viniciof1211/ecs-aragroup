import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Area,
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
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  Download,
  Building2,
  Clock,
  Users,
  CalendarCheck,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Target,
  AlertTriangle,
  CheckCircle2,
  Info,
  FlaskConical,
  Activity,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  computeBoardKPIs,
  saveBoardKPIResults,
  loadBoardSnapshots,
  KPI_COLOR_HEX,
  KPI_COLOR_BG,
  KPI_COLOR_TEXT,
  KPI_COLOR_LABELS,
  UDN_LABELS,
  MANDATORY_KPIS,
  type UDN,
  type BoardKPIResult,
  type MonthlyUDNMetrics,
  type KPIColor,
  type MandatoryKPIId,
} from "@/lib/board-kpi-engine";
import type { ECSLead, ECSInteraction } from "@/types/ecs";
import { useExperimentStore } from "@/stores/useExperimentStore";
import { getSegmentFromScore } from "@/types/ecs";

// ─── Data fetching ───

async function fetchLeads(): Promise<ECSLead[]> {
  const res = await fetch("/data/leads.json");
  return res.json();
}

async function fetchInteractions(): Promise<ECSInteraction[]> {
  const res = await fetch("/data/interactions.json");
  return res.json();
}

// ─── Tooltip style ───

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
};

// ─── KPI Icon map ───

const KPI_ICONS: Record<MandatoryKPIId, typeof Target> = {
  lead_growth: Users,
  response_time: Clock,
  appointment_growth: CalendarCheck,
  conversion_rate: FileCheck,
};

// ─── Color indicator component ───

function ColorIndicator({ color, size = "md" }: { color: KPIColor; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-6 w-6",
  };
  return (
    <div
      className={cn("rounded-full ring-2 ring-offset-1 ring-offset-background", sizeClasses[size])}
      style={{ backgroundColor: KPI_COLOR_HEX[color], boxShadow: `0 0 8px ${KPI_COLOR_HEX[color]}40` }}
      title={KPI_COLOR_LABELS[color]}
    />
  );
}

// ─── Gauge component for KPI cards ───

function KPIGauge({ color, value, label }: { color: KPIColor; value: string; label: string }) {
  const colorIdx = { azul: 3, verde: 2, amarillo: 1, rojo: 0 }[color];
  const pct = ((colorIdx + 1) / 4) * 100;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            backgroundColor: KPI_COLOR_HEX[color],
            boxShadow: `0 0 6px ${KPI_COLOR_HEX[color]}60`,
          }}
        />
        {/* Threshold markers */}
        <div className="absolute inset-y-0 left-[25%] w-px bg-border" />
        <div className="absolute inset-y-0 left-[50%] w-px bg-border" />
        <div className="absolute inset-y-0 left-[75%] w-px bg-border" />
      </div>
      <div className="flex w-full justify-between text-[8px] text-muted-foreground">
        <span>Rojo</span>
        <span>Amarillo</span>
        <span>Verde</span>
        <span>Azul</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: KPI_COLOR_HEX[color] }}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground text-center leading-tight">{label}</p>
    </div>
  );
}

// ─── UDN Section ───

function UDNSection({
  udn,
  results,
  monthlyMetrics,
}: {
  udn: UDN;
  results: BoardKPIResult[];
  monthlyMetrics: MonthlyUDNMetrics[];
}) {
  const [expanded, setExpanded] = useState(true);
  const udnMetrics = monthlyMetrics.filter((m) => m.udn === udn);

  // Overall health: count colors
  const colorCounts = { azul: 0, verde: 0, amarillo: 0, rojo: 0 };
  for (const r of results) colorCounts[r.color]++;

  const overallHealth: KPIColor =
    colorCounts.rojo >= 2 ? "rojo" :
    colorCounts.amarillo >= 2 ? "amarillo" :
    colorCounts.azul >= 3 ? "azul" : "verde";

  const OverallIcon =
    overallHealth === "azul" ? CheckCircle2 :
    overallHealth === "verde" ? CheckCircle2 :
    overallHealth === "amarillo" ? AlertTriangle :
    AlertTriangle;

  return (
    <div className="space-y-4">
      {/* UDN Header */}
      <button
        className={cn(
          "flex w-full items-center justify-between rounded-xl border-2 p-4 transition-all hover:shadow-md",
          overallHealth === "azul" && "border-blue-400/50 bg-blue-50/50 dark:bg-blue-950/20",
          overallHealth === "verde" && "border-green-400/50 bg-green-50/50 dark:bg-green-950/20",
          overallHealth === "amarillo" && "border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-950/20",
          overallHealth === "rojo" && "border-red-400/50 bg-red-50/50 dark:bg-red-950/20",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6" style={{ color: KPI_COLOR_HEX[overallHealth] }} />
          <div className="text-left">
            <h3 className="text-lg font-bold font-display">{UDN_LABELS[udn]}</h3>
            <p className="text-xs text-muted-foreground">
              {results.length} KPIs obligatorios · Estado general:{" "}
              <span className={KPI_COLOR_TEXT[overallHealth]} style={{ fontWeight: 700 }}>
                {KPI_COLOR_LABELS[overallHealth]}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {results.map((r) => (
              <ColorIndicator key={r.kpiId} color={r.color} size="sm" />
            ))}
          </div>
          <OverallIcon className="h-5 w-5" style={{ color: KPI_COLOR_HEX[overallHealth] }} />
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {results.map((r) => {
              const Icon = KPI_ICONS[r.kpiId];
              const trendIcon = r.changePercent > 0 ? TrendingUp : r.changePercent < 0 ? TrendingDown : Minus;
              const TrendIcon = trendIcon;

              return (
                <Card
                  key={r.kpiId}
                  className={cn("shadow-card border-l-4 transition-all hover:shadow-lg")}
                  style={{ borderLeftColor: KPI_COLOR_HEX[r.color] }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn("rounded-lg p-1.5", KPI_COLOR_BG[r.color])}
                        >
                          <Icon className="h-4 w-4" style={{ color: KPI_COLOR_HEX[r.color] }} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold leading-tight">{r.kpiName}</p>
                          <p className="text-[9px] text-muted-foreground">{r.department}</p>
                        </div>
                      </div>
                      <ColorIndicator color={r.color} size="md" />
                    </div>

                    <KPIGauge
                      color={r.color}
                      value={r.displayValue}
                      label={r.targetDescription}
                    />

                    <div className="mt-3 flex items-center justify-between border-t pt-2">
                      <div className="flex items-center gap-1">
                        <TrendIcon
                          className="h-3 w-3"
                          style={{ color: r.changePercent >= 0 ? "#22C55E" : "#EF4444" }}
                        />
                        <span className="text-[10px] font-medium" style={{ color: r.changePercent >= 0 ? "#22C55E" : "#EF4444" }}>
                          {r.changePercent >= 0 ? "+" : ""}{r.changePercent.toFixed(1)}% vs U3M
                        </span>
                      </div>
                      <Badge
                        className="text-[8px] px-1.5 py-0"
                        style={{
                          backgroundColor: `${KPI_COLOR_HEX[r.color]}20`,
                          color: KPI_COLOR_HEX[r.color],
                          borderColor: `${KPI_COLOR_HEX[r.color]}40`,
                        }}
                      >
                        {KPI_COLOR_LABELS[r.color]}
                      </Badge>
                    </div>

                    <p className="mt-1.5 text-[9px] text-muted-foreground">
                      Responsable: <span className="font-medium">{r.responsible}</span>
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Monthly Trend Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Leads & Appointments Trend */}
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Leads y Citas — Tendencia Mensual
                  <InfoTooltip text="Muestra la cantidad de leads generados, citas agendadas y contratos con depósito por mes para esta UDN. Los datos provienen de Bitrix24 y se segmentan por marca/división del lead. Permite identificar tendencias de crecimiento o contracción mensual." />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={udnMetrics}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 9 }}
                      className="fill-muted-foreground"
                      tickFormatter={(v: string) => {
                        const [, m] = v.split("-");
                        const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                        return months[parseInt(m, 10) - 1] ?? v;
                      }}
                    />
                    <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="leadsGenerated" name="Leads Generados" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="appointmentsGenerated" name="Citas Generadas" fill="#22C55E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="contractsWithDeposit" name="Contratos c/ Depósito" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Response Time Trend */}
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  Tiempo de Respuesta — Tendencia Mensual
                  <InfoTooltip text="Tiempo promedio en minutos desde que un lead envía un mensaje entrante hasta la primera respuesta saliente del equipo. Se calcula por pares entrante→saliente en las interacciones de Bitrix24. La línea roja punteada indica la meta establecida por la Gerencia Comercial." />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={udnMetrics}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 9 }}
                      className="fill-muted-foreground"
                      tickFormatter={(v: string) => {
                        const [, m] = v.split("-");
                        const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                        return months[parseInt(m, 10) - 1] ?? v;
                      }}
                    />
                    <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" unit=" min" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v ?? 0).toFixed(1)} min`, "Tiempo Resp."]} />
                    <Line
                      type="monotone"
                      dataKey="avgResponseTimeMinutes"
                      name="Tiempo Respuesta (min)"
                      stroke="#8B5CF6"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#8B5CF6" }}
                    />
                    {/* Target line at 5 min */}
                    <Line
                      type="monotone"
                      dataKey={() => udn === "euromobilia" ? 5 : 4}
                      name={`Meta (${udn === "euromobilia" ? 5 : 4} min)`}
                      stroke="#EF4444"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page Component ───

export default function BoardKPIs() {
  const { data: leads = [] } = useQuery<ECSLead[]>({ queryKey: ["leads"], queryFn: fetchLeads });
  const { data: interactions = [] } = useQuery<ECSInteraction[]>({ queryKey: ["interactions"], queryFn: fetchInteractions });

  const { results, monthlyMetrics } = useMemo(
    () => computeBoardKPIs(leads, interactions),
    [leads, interactions]
  );

  const euromobiliaResults = results.filter((r) => r.udn === "euromobilia");
  const nouvellResults = results.filter((r) => r.udn === "nouvell");

  const historicalSnapshots = useMemo(() => loadBoardSnapshots(), []);

  const handleSaveSnapshot = useCallback(() => {
    saveBoardKPIResults(results);
    alert("Snapshot guardado exitosamente para el mes actual.");
  }, [results]);

  // Radar data for executive overview
  const radarData = useMemo(() => {
    return MANDATORY_KPIS.map((kpi) => {
      const euroResult = results.find((r) => r.udn === "euromobilia" && r.kpiId === kpi.id);
      const nouvResult = results.find((r) => r.udn === "nouvell" && r.kpiId === kpi.id);
      const colorToScore = (c: KPIColor) => ({ azul: 100, verde: 75, amarillo: 50, rojo: 25 }[c]);
      return {
        kpi: kpi.name.length > 18 ? kpi.name.slice(0, 18) + "…" : kpi.name,
        Euromobilia: colorToScore(euroResult?.color ?? "rojo"),
        Nouvell: colorToScore(nouvResult?.color ?? "rojo"),
      };
    });
  }, [results]);

  // Summary counts
  const allColors = results.map((r) => r.color);
  const colorSummary = {
    azul: allColors.filter((c) => c === "azul").length,
    verde: allColors.filter((c) => c === "verde").length,
    amarillo: allColors.filter((c) => c === "amarillo").length,
    rojo: allColors.filter((c) => c === "rojo").length,
  };

  // Historical trend chart data
  const historicalChartData = useMemo(() => {
    const months = [...new Set(historicalSnapshots.map((s) => s.month))].sort();
    return months.map((month) => {
      const monthSnaps = historicalSnapshots.filter((s) => s.month === month);
      const entry: Record<string, string | number> = { month };
      for (const snap of monthSnaps) {
        const label = `${UDN_LABELS[snap.udn].split(" ")[0]}-${snap.kpiId.replace("_", " ")}`;
        entry[label] = snap.changePercent;
      }
      return entry;
    });
  }, [historicalSnapshots]);

  // ─── A/B Test Experiment Data ───
  const { experiments, hydrate: hydrateExperiments } = useExperimentStore();
  useMemo(() => { hydrateExperiments(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeExperiments = experiments.filter((e) => e.status === "active");

  // Build lead lookup for current scores
  const leadMap = useMemo(() => {
    const m = new Map<string, ECSLead>();
    for (const l of leads) m.set(l.id, l);
    return m;
  }, [leads]);

  // Composite chart data: per-experiment, per-lead current vs enrolled score + forecast
  const abCompositeData = useMemo(() => {
    if (activeExperiments.length === 0 || leads.length === 0) return [];

    // Aggregate across all active experiments
    const allEnrolledLeadIds = new Set<string>();
    let totalEnrolled = 0;
    let sumCurrentScore = 0;
    let sumEnrolledScore = 0;

    for (const exp of activeExperiments) {
      for (const el of exp.leads) {
        allEnrolledLeadIds.add(el.leadId);
        totalEnrolled++;
        const currentLead = leadMap.get(el.leadId);
        sumCurrentScore += currentLead?.current_score ?? el.enrolledScore;
        sumEnrolledScore += el.enrolledScore;
      }
    }

    const avgCurrentScore = totalEnrolled > 0 ? sumCurrentScore / totalEnrolled : 0;
    const avgEnrolledScore = totalEnrolled > 0 ? sumEnrolledScore / totalEnrolled : 0;
    const scoreDelta = avgCurrentScore - avgEnrolledScore;

    // Segment transitions: leads NOT in tests that changed segment recently
    const nonTestLeads = leads.filter((l) => !allEnrolledLeadIds.has(l.id));
    const transitioned = nonTestLeads.filter((l) => {
      const currentSeg = l.segment || getSegmentFromScore(l.current_score);
      const prevSeg = getSegmentFromScore(l.previous_score);
      return currentSeg !== prevSeg && l.previous_score > 0;
    });

    // Segment breakdown of transitions
    const warmToHot = transitioned.filter((l) => getSegmentFromScore(l.previous_score) === "warm" && (l.segment === "hot")).length;
    const coldToWarm = transitioned.filter((l) => getSegmentFromScore(l.previous_score) === "cold" && (l.segment === "warm")).length;
    const dormantToActive = transitioned.filter((l) => getSegmentFromScore(l.previous_score) === "dormant" && ["cold", "warm", "hot"].includes(l.segment)).length;
    const downgraded = transitioned.filter((l) => l.current_score < l.previous_score).length;

    // CAC & CPL computation
    const adSpendRaw = localStorage.getItem("ecs-ad-spend");
    const adSpend = adSpendRaw ? parseFloat(adSpendRaw) : 0;
    const wonLeads = leads.filter((l) => l.status === "won").length;
    const actualCAC = wonLeads > 0 && adSpend > 0 ? adSpend / wonLeads : 0;
    const actualCPL = leads.length > 0 && adSpend > 0 ? adSpend / leads.length : 0;

    // Forecast: project improvement based on experiment lift projections
    const avgLift = activeExperiments.length > 0
      ? activeExperiments.reduce((s, e) => s + e.projections.expectedLiftPct, 0) / activeExperiments.length
      : 0;
    const forecastCAC = actualCAC > 0 ? actualCAC * (1 - avgLift / 200) : 0;
    const forecastCPL = actualCPL > 0 ? actualCPL * (1 - avgLift / 300) : 0;

    // Build time-series data points for the composite chart (using experiment snapshots)
    const timePoints: {
      label: string;
      avgScore: number;
      forecastScore: number;
      leadsInTest: number;
      leadsTransitioned: number;
      warmToHot: number;
      coldToWarm: number;
      dormantToActive: number;
      downgraded: number;
      actualCAC: number;
      forecastCAC: number;
      actualCPL: number;
      forecastCPL: number;
    }[] = [];

    // Use snapshots from experiments to build time series
    const allSnapshots = activeExperiments.flatMap((exp) =>
      exp.snapshots.map((s) => ({ ...s, expId: exp.id }))
    );
    const snapshotDates = [...new Set(allSnapshots.map((s) => s.date))].sort();

    if (snapshotDates.length > 0) {
      for (const date of snapshotDates) {
        const daySnaps = allSnapshots.filter((s) => s.date === date);
        const avgA = daySnaps.reduce((s, d) => s + d.variantA.avgScore, 0) / daySnaps.length;
        const avgB = daySnaps.reduce((s, d) => s + d.variantB.avgScore, 0) / daySnaps.length;
        const avgSnap = (avgA + avgB) / 2;
        const totalCount = daySnaps.reduce((s, d) => s + d.variantA.count + d.variantB.count, 0);

        timePoints.push({
          label: date.slice(5), // MM-DD
          avgScore: Math.round(avgSnap * 10) / 10,
          forecastScore: Math.round((avgSnap + scoreDelta * 0.3) * 10) / 10,
          leadsInTest: totalCount,
          leadsTransitioned: Math.round(transitioned.length / Math.max(snapshotDates.length, 1)),
          warmToHot, coldToWarm, dormantToActive, downgraded,
          actualCAC: Math.round(actualCAC * 100) / 100,
          forecastCAC: Math.round(forecastCAC * 100) / 100,
          actualCPL: Math.round(actualCPL * 100) / 100,
          forecastCPL: Math.round(forecastCPL * 100) / 100,
        });
      }
    }

    // Always add a "current" point
    timePoints.push({
      label: "Actual",
      avgScore: Math.round(avgCurrentScore * 10) / 10,
      forecastScore: Math.round((avgCurrentScore + scoreDelta * 0.5) * 10) / 10,
      leadsInTest: totalEnrolled,
      leadsTransitioned: transitioned.length,
      warmToHot, coldToWarm, dormantToActive, downgraded,
      actualCAC: Math.round(actualCAC * 100) / 100,
      forecastCAC: Math.round(forecastCAC * 100) / 100,
      actualCPL: Math.round(actualCPL * 100) / 100,
      forecastCPL: Math.round(forecastCPL * 100) / 100,
    });

    // Add forecast points
    for (let i = 1; i <= 3; i++) {
      const projScore = avgCurrentScore + scoreDelta * (0.5 + i * 0.15);
      const projCAC = forecastCAC * (1 - i * 0.02);
      const projCPL = forecastCPL * (1 - i * 0.015);
      timePoints.push({
        label: `+${i * 7}d`,
        avgScore: 0, // no actual data for future
        forecastScore: Math.round(Math.max(0, Math.min(100, projScore)) * 10) / 10,
        leadsInTest: totalEnrolled,
        leadsTransitioned: Math.round(transitioned.length * (1 + i * 0.1)),
        warmToHot: Math.round(warmToHot * (1 + i * 0.15)),
        coldToWarm: Math.round(coldToWarm * (1 + i * 0.1)),
        dormantToActive: Math.round(dormantToActive * (1 + i * 0.08)),
        downgraded: Math.max(0, Math.round(downgraded * (1 - i * 0.1))),
        actualCAC: 0,
        forecastCAC: Math.round(Math.max(0, projCAC) * 100) / 100,
        actualCPL: 0,
        forecastCPL: Math.round(Math.max(0, projCPL) * 100) / 100,
      });
    }

    return timePoints;
  }, [activeExperiments, leads, leadMap]);

  // Segment transition summary for the bar chart
  const segmentTransitionData = useMemo(() => {
    if (leads.length === 0) return [];

    const allEnrolledIds = new Set<string>();
    for (const exp of activeExperiments) {
      for (const el of exp.leads) allEnrolledIds.add(el.leadId);
    }

    const segments = ["hot", "warm", "cool", "cold", "dormant", "lost"] as const;
    const segLabels: Record<string, string> = {
      hot: "Caliente", warm: "Tibio", cool: "Fresco",
      cold: "Frío", dormant: "Inactivo", lost: "Perdido",
    };

    return segments.map((seg) => {
      const inTest = leads.filter((l) => allEnrolledIds.has(l.id) && (l.segment === seg || getSegmentFromScore(l.current_score) === seg)).length;
      const notInTest = leads.filter((l) => !allEnrolledIds.has(l.id) && (l.segment === seg || getSegmentFromScore(l.current_score) === seg)).length;
      const transUp = leads.filter((l) => {
        if (l.previous_score <= 0) return false;
        const prev = getSegmentFromScore(l.previous_score);
        const curr = l.segment || getSegmentFromScore(l.current_score);
        return curr === seg && prev !== seg && l.current_score > l.previous_score;
      }).length;
      const transDown = leads.filter((l) => {
        if (l.previous_score <= 0) return false;
        const prev = getSegmentFromScore(l.previous_score);
        const curr = l.segment || getSegmentFromScore(l.current_score);
        return curr === seg && prev !== seg && l.current_score < l.previous_score;
      }).length;

      return {
        segment: segLabels[seg] ?? seg,
        "En Test A/B": inTest,
        "Fuera de Test": notInTest,
        "Transición ↑": transUp,
        "Transición ↓": transDown,
      };
    });
  }, [leads, activeExperiments]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-red-500 to-red-700 p-2.5 shadow-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              KPIs Obligatorios — Junta Directiva
            </h1>
            <p className="text-sm text-muted-foreground">
              Indicadores mandatorios por la Gerencia Comercial · Seguimiento por UDN con metas de color
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSaveSnapshot}>
            <Save className="h-3.5 w-3.5" />
            Guardar Snapshot
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()}>
            <Download className="h-3.5 w-3.5" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Executive Summary Bar */}
      <Card className="shadow-card border-t-4 border-t-red-500">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(["azul", "verde", "amarillo", "rojo"] as KPIColor[]).map((color) => (
              <div
                key={color}
                className={cn("flex items-center gap-3 rounded-lg p-3", KPI_COLOR_BG[color])}
              >
                <ColorIndicator color={color} size="lg" />
                <div>
                  <p className="text-2xl font-bold" style={{ color: KPI_COLOR_HEX[color] }}>
                    {colorSummary[color]}
                  </p>
                  <p className="text-xs font-medium" style={{ color: KPI_COLOR_HEX[color] }}>
                    {KPI_COLOR_LABELS[color]}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            <span>
              {results.length} KPIs evaluados · {format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
              {" · "}Datos: {leads.length.toLocaleString("es-CR")} leads, {interactions.length.toLocaleString("es-CR")} interacciones
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Radar Comparison */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-red-500" />
            Comparativa Ejecutiva — Euromobilia vs Nouvell
            <InfoTooltip text="Radar que compara el estado de los 4 KPIs obligatorios entre ambas UDNs. Cada eje representa un KPI y el valor se deriva del color semáforo: Azul=100, Verde=75, Amarillo=50, Rojo=25. Un polígono más amplio indica mejor desempeño general." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="kpi" tick={{ fontSize: 9 }} />
              <PolarRadiusAxis tick={{ fontSize: 8 }} domain={[0, 100]} />
              <Radar name="Euromobilia" dataKey="Euromobilia" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} />
              <Radar name="Nouvell" dataKey="Nouvell" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.25} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* UDN Sections */}
      <UDNSection udn="euromobilia" results={euromobiliaResults} monthlyMetrics={monthlyMetrics} />
      <UDNSection udn="nouvell" results={nouvellResults} monthlyMetrics={monthlyMetrics} />

      {/* Detailed Table for Board Presentation */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Tabla Detallada — Presentación a Junta Directiva
            <InfoTooltip text="Tabla consolidada con los 8 KPIs obligatorios (4 por UDN). Valor Actual = dato del mes corriente. Baseline U3M = promedio de los últimos 3 meses. Cambio % = variación porcentual vs U3M. El color semáforo se asigna según umbrales definidos por la Gerencia Comercial en kpis.xlsx." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">UDN</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>KPI</TableHead>
                  <TableHead className="text-center">Valor Actual</TableHead>
                  <TableHead className="text-center">Baseline U3M</TableHead>
                  <TableHead className="text-center">Cambio %</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Responsable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={`${r.udn}-${r.kpiId}`}>
                    <TableCell className="font-medium text-sm">{r.udnLabel}</TableCell>
                    <TableCell className="text-xs">{r.department}</TableCell>
                    <TableCell className="text-xs font-medium">{r.kpiName}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-sm font-bold" style={{ color: KPI_COLOR_HEX[r.color] }}>
                        {r.displayValue}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground font-mono">
                      {r.kpiId === "response_time"
                        ? `${r.baselineU3M.toFixed(1)} min`
                        : r.kpiId === "conversion_rate"
                        ? `${r.baselineU3M.toFixed(1)}%`
                        : Math.round(r.baselineU3M).toLocaleString("es-CR")}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium"
                        style={{ color: r.changePercent >= 0 ? "#22C55E" : "#EF4444" }}
                      >
                        {r.changePercent >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {r.changePercent >= 0 ? "+" : ""}{r.changePercent.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <ColorIndicator color={r.color} size="sm" />
                        <Badge
                          className="text-[9px] px-1.5"
                          style={{
                            backgroundColor: `${KPI_COLOR_HEX[r.color]}15`,
                            color: KPI_COLOR_HEX[r.color],
                            borderColor: `${KPI_COLOR_HEX[r.color]}30`,
                          }}
                        >
                          {KPI_COLOR_LABELS[r.color]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground max-w-[200px]">
                      {r.targetDescription}
                    </TableCell>
                    <TableCell className="text-xs">{r.responsible}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Historical Snapshots */}
      {historicalChartData.length > 1 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Evolución Histórica de KPIs
              <InfoTooltip text="Evolución mes a mes de los KPIs obligatorios a partir de snapshots guardados manualmente. Cada línea representa el cambio porcentual vs U3M de un KPI+UDN específico. Permite visualizar la mejora o deterioro sostenido a lo largo del tiempo." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={historicalChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                {Object.keys(historicalChartData[0] ?? {})
                  .filter((k) => k !== "month")
                  .map((key, idx) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#14B8A6"][idx % 8]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           A/B Test Execution — Composite Dashboard
           ═══════════════════════════════════════════════════════════════ */}
      <Card className="shadow-card border-t-4 border-t-emerald-500">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-emerald-500" />
            Pruebas A/B en Ejecución — Impacto en Tiempo Real
            <InfoTooltip text="Dashboard compuesto que muestra el impacto de las pruebas A/B activas. Incluye: ECS Score actual vs pronóstico por lead, CAC y CPL con tendencias predictivas, distribución de leads por segmento dentro y fuera de las pruebas, y transiciones de segmento como consecuencia directa o indirecta de campañas." />
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {activeExperiments.length > 0
              ? `${activeExperiments.length} experimento(s) activo(s) · ${activeExperiments.reduce((s, e) => s + e.leads.length, 0)} leads en prueba`
              : "Sin experimentos activos — los datos se poblarán al ejecutar pruebas A/B"}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {abCompositeData.length > 0 ? (
            <>
              {/* Row 1: ECS Score Actual vs Forecast + CAC/CPL */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* ECS Score: Actual line + Forecast trend + Leads bar */}
                <Card className="shadow-sm border">
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      ECS Score — Actual vs Pronóstico
                      <InfoTooltip text="Línea sólida: promedio del ECS Score actual de los leads inscritos en pruebas A/B. Línea punteada: pronóstico basado en el delta de mejora observado desde la inscripción, proyectado a +7, +14 y +21 días. Las barras muestran la cantidad de leads en test y los que transicionaron de segmento." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-3">
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={abCompositeData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                        <YAxis yAxisId="score" tick={{ fontSize: 9 }} className="fill-muted-foreground" domain={[0, 100]} />
                        <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        <Bar yAxisId="count" dataKey="leadsInTest" name="Leads en Test" fill="#1A4A2830" radius={[3, 3, 0, 0]} />
                        <Bar yAxisId="count" dataKey="leadsTransitioned" name="Leads Transicionados" fill="#8B5CF620" radius={[3, 3, 0, 0]} />
                        <Line yAxisId="score" type="monotone" dataKey="avgScore" name="ECS Score Actual" stroke="#22C55E" strokeWidth={2.5} dot={{ r: 4, fill: "#22C55E" }} connectNulls={false} />
                        <Line yAxisId="score" type="monotone" dataKey="forecastScore" name="Pronóstico ECS" stroke="#22C55E" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3, fill: "#22C55E", strokeDasharray: "" }} />
                        <Area yAxisId="score" type="monotone" dataKey="forecastScore" fill="#22C55E" fillOpacity={0.08} stroke="none" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* CAC & CPL: Actual vs Forecast */}
                <Card className="shadow-sm border">
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-amber-500" />
                      CAC y CPL — Actual vs Pronóstico
                      <InfoTooltip text="CAC (Costo de Adquisición de Cliente) = Inversión publicitaria / Leads ganados. CPL (Costo por Lead) = Inversión publicitaria / Total de leads. La inversión se configura manualmente en el módulo KPI. Las líneas punteadas proyectan la reducción esperada según el lift promedio de las pruebas A/B activas." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-3">
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={abCompositeData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                        <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" unit="$" />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v ?? 0).toFixed(2)}`, ""]} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        <Line type="monotone" dataKey="actualCAC" name="CAC Actual" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 4, fill: "#EF4444" }} connectNulls={false} />
                        <Line type="monotone" dataKey="forecastCAC" name="CAC Pronóstico" stroke="#EF4444" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3, fill: "#EF4444", strokeDasharray: "" }} />
                        <Area type="monotone" dataKey="forecastCAC" fill="#EF4444" fillOpacity={0.06} stroke="none" />
                        <Line type="monotone" dataKey="actualCPL" name="CPL Actual" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4, fill: "#3B82F6" }} connectNulls={false} />
                        <Line type="monotone" dataKey="forecastCPL" name="CPL Pronóstico" stroke="#3B82F6" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3, fill: "#3B82F6", strokeDasharray: "" }} />
                        <Area type="monotone" dataKey="forecastCPL" fill="#3B82F6" fillOpacity={0.06} stroke="none" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Row 2: Segment Impact — Leads in test vs transitions */}
              <Card className="shadow-sm border">
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-500" />
                    Impacto por Segmento — Leads en Test y Transiciones
                    <InfoTooltip text="Barras apiladas: leads dentro de pruebas A/B vs fuera, por segmento ECS (Caliente a Perdido). Barras separadas: Transición ↑ = leads que subieron de segmento (ej. frío→tibio), Transición ↓ = leads que bajaron. Los segmentos se determinan por el ECS Score: Hot ≥80, Warm ≥60, Cool ≥40, Cold ≥20, Dormant <20." />
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">
                    Distribución de leads impactados directa e indirectamente por pruebas A/B, campañas y acciones comerciales
                  </p>
                </CardHeader>
                <CardContent className="px-2 pb-3">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={segmentTransitionData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="segment" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                      <Bar dataKey="En Test A/B" stackId="a" fill="#22C55E" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Fuera de Test" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Transición ↑" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Transición ↓" fill="#EF4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Active Experiments Summary Table */}
              {activeExperiments.length > 0 && (
                <Card className="shadow-sm border">
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-emerald-500" />
                      Experimentos Activos — Resumen
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[180px]">Experimento</TableHead>
                            <TableHead className="text-center">Categoría</TableHead>
                            <TableHead className="text-center">Leads</TableHead>
                            <TableHead className="text-center">Lift Esperado</TableHead>
                            <TableHead className="text-center">Conv. Esperadas</TableHead>
                            <TableHead className="text-center">Snapshots</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeExperiments.map((exp) => (
                            <TableRow key={exp.id}>
                              <TableCell className="text-xs font-medium whitespace-normal break-words max-w-[220px]">
                                {exp.test.title}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="text-[9px]">
                                  {exp.test.category}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-xs font-mono">{exp.leads.length}</TableCell>
                              <TableCell className="text-center text-xs font-mono text-emerald-600">
                                +{exp.projections.expectedLiftPct}%
                              </TableCell>
                              <TableCell className="text-center text-xs font-mono">
                                {exp.projections.expectedConversions}
                              </TableCell>
                              <TableCell className="text-center text-xs font-mono">
                                {exp.snapshots.length}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                                  Activo
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FlaskConical className="h-12 w-12 opacity-20" />
              <p className="mt-3 text-sm font-medium">Sin Pruebas A/B Activas</p>
              <p className="text-xs mt-1">
                Ejecuta pruebas desde la sección "Pruebas A/B" para ver el impacto en tiempo real aquí.
              </p>
              <p className="text-[10px] mt-3 max-w-md text-center">
                Este panel mostrará: ECS Score actual vs pronóstico, CAC y CPL con tendencias predictivas,
                cantidad de leads impactados dentro y fuera de las pruebas, y transiciones de segmento.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Methodology Reference */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Metodología y Definiciones
            <InfoTooltip text="Referencia de los umbrales de color para cada KPI obligatorio. Los valores se expresan como Euromobilia / Nouvell. Los umbrales fueron definidos por la Gerencia Comercial y se comparan contra el baseline U3M (promedio de los últimos 3 meses). El sistema evalúa automáticamente el color de cada KPI en tiempo real." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[15%]">KPI</TableHead>
                  <TableHead className="w-[37%]">Metodología</TableHead>
                  <TableHead className="w-[12%] text-center">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500 mr-1" />Azul
                  </TableHead>
                  <TableHead className="w-[12%] text-center">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 mr-1" />Verde
                  </TableHead>
                  <TableHead className="w-[12%] text-center">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500 mr-1" />Amarillo
                  </TableHead>
                  <TableHead className="w-[12%] text-center">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 mr-1" />Rojo
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MANDATORY_KPIS.map((kpi) => (
                  <TableRow key={kpi.id}>
                    <TableCell className="font-medium text-xs whitespace-normal break-words align-top">{kpi.name}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground whitespace-normal break-words leading-relaxed align-top">{kpi.methodology}</TableCell>
                    <TableCell className="text-center text-[10px] font-medium text-blue-600 whitespace-normal align-top">
                      {kpi.id === "response_time"
                        ? "≤5 / ≤4 min"
                        : `≥+${kpi.thresholds.euromobilia.azul.min}% / ≥+${kpi.thresholds.nouvell.azul.min}%`}
                    </TableCell>
                    <TableCell className="text-center text-[10px] font-medium text-green-600 whitespace-normal align-top">
                      {kpi.id === "response_time"
                        ? "5-7 / 4-5 min"
                        : `+${kpi.thresholds.euromobilia.verde.min}-${kpi.thresholds.euromobilia.verde.max}% / +${kpi.thresholds.nouvell.verde.min}-${kpi.thresholds.nouvell.verde.max}%`}
                    </TableCell>
                    <TableCell className="text-center text-[10px] font-medium text-yellow-600 whitespace-normal align-top">
                      {kpi.id === "response_time"
                        ? "7-10 / 5-7.5 min"
                        : `+${kpi.thresholds.euromobilia.amarillo.min}-${kpi.thresholds.euromobilia.amarillo.max}% / +${kpi.thresholds.nouvell.amarillo.min}-${kpi.thresholds.nouvell.amarillo.max}%`}
                    </TableCell>
                    <TableCell className="text-center text-[10px] font-medium text-red-600 whitespace-normal align-top">
                      {kpi.id === "response_time"
                        ? ">10 / >7.5 min"
                        : `<+${kpi.thresholds.euromobilia.amarillo.min}% / <+${kpi.thresholds.nouvell.amarillo.min}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Print-friendly footer */}
      <div className="text-center text-xs text-muted-foreground print:block hidden">
        <p>ECS Lead Intelligence — ARA Group · Generado: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
      </div>
    </div>
  );
}
