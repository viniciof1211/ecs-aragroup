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
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
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
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string) => [`${Number(v).toFixed(1)} min`, "Tiempo Resp."]} />
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

      {/* Methodology Reference */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Metodología y Definiciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead>Metodología</TableHead>
                  <TableHead className="text-center">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500 mr-1" />Azul
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 mr-1" />Verde
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500 mr-1" />Amarillo
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 mr-1" />Rojo
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MANDATORY_KPIS.map((kpi) => (
                  <TableRow key={kpi.id}>
                    <TableCell className="font-medium text-xs">{kpi.name}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground max-w-[300px]">{kpi.methodology}</TableCell>
                    <TableCell className="text-center text-[10px] font-medium text-blue-600">
                      {kpi.id === "response_time"
                        ? "≤5 / ≤4 min"
                        : `≥+${kpi.thresholds.euromobilia.azul.min}% / ≥+${kpi.thresholds.nouvell.azul.min}%`}
                    </TableCell>
                    <TableCell className="text-center text-[10px] font-medium text-green-600">
                      {kpi.id === "response_time"
                        ? "5-7 / 4-5 min"
                        : `+${kpi.thresholds.euromobilia.verde.min}-${kpi.thresholds.euromobilia.verde.max}% / +${kpi.thresholds.nouvell.verde.min}-${kpi.thresholds.nouvell.verde.max}%`}
                    </TableCell>
                    <TableCell className="text-center text-[10px] font-medium text-yellow-600">
                      {kpi.id === "response_time"
                        ? "7-10 / 5-7.5 min"
                        : `+${kpi.thresholds.euromobilia.amarillo.min}-${kpi.thresholds.euromobilia.amarillo.max}% / +${kpi.thresholds.nouvell.amarillo.min}-${kpi.thresholds.nouvell.amarillo.max}%`}
                    </TableCell>
                    <TableCell className="text-center text-[10px] font-medium text-red-600">
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
