import { useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Activity, Target, Clock, Users, MessageSquare } from "lucide-react";
import { useKPIStore } from "@/stores/useKPIStore";
import { evaluateKPIFormula } from "@/types/employee-kpi";
import type { EmployeeStats } from "@/types/ecs";
import type { ECSLead, ECSInteraction } from "@/types/ecs";
import { format, subDays } from "date-fns";

const CHART_COLORS = ["#1A4A28", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#14B8A6"];

interface EmployeeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeStats | null;
  leads: ECSLead[];
  interactions: ECSInteraction[];
}

export function EmployeeDetailDialog({
  open,
  onOpenChange,
  employee,
  leads,
  interactions,
}: EmployeeDetailDialogProps) {
  const { allKPIs, loadKPIs, snapshots, loadSnapshots, addSnapshots } = useKPIStore();

  useEffect(() => {
    if (open && employee) {
      loadKPIs();
      loadSnapshots(employee.employee);
    }
  }, [open, employee, loadKPIs, loadSnapshots]);

  const kpiDefs = allKPIs();

  // Compute current KPI values
  const currentKPIValues = useMemo(() => {
    if (!employee) return [];
    const vars: Record<string, number> = {
      avgScore: employee.avgScore,
      responseTime: employee.responseTime,
      conversionRate: employee.conversionRate,
      activeLeads: employee.activeLeads,
      totalInteractions: employee.totalInteractions,
    };
    return kpiDefs.map((kpi) => ({
      kpi,
      value: evaluateKPIFormula(kpi.formula, vars),
    }));
  }, [employee, kpiDefs]);

  // Build historical data from snapshots for trend charts
  const historicalData = useMemo(() => {
    if (!employee || snapshots.length === 0) return [];
    const dateMap = new Map<string, Record<string, number>>();
    for (const snap of snapshots) {
      if (snap.employee_name !== employee.employee) continue;
      if (!dateMap.has(snap.snapshot_date)) dateMap.set(snap.snapshot_date, {});
      dateMap.get(snap.snapshot_date)![snap.kpi_name] = snap.value;
    }
    return Array.from(dateMap.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [employee, snapshots]);

  // Employee's leads
  const employeeLeads = useMemo(() => {
    if (!employee) return [];
    return leads.filter((l) => l.employees?.includes(employee.employee));
  }, [employee, leads]);

  // Employee's interactions over time (last 30 days, daily)
  const activityTimeline = useMemo(() => {
    if (!employee) return [];
    const empInteractions = interactions.filter(
      (i) => i.employee === employee.employee
    );
    const now = new Date();
    const days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(now, i), "yyyy-MM-dd");
      days.push({ date: d, count: 0 });
    }
    for (const inter of empInteractions) {
      const d = format(new Date(inter.timestamp), "yyyy-MM-dd");
      const entry = days.find((day) => day.date === d);
      if (entry) entry.count++;
    }
    return days.map((d) => ({
      ...d,
      date: format(new Date(d.date), "dd/MM"),
    }));
  }, [employee, interactions]);

  // Radar chart: normalize employee stats for comparison
  const radarData = useMemo(() => {
    if (!employee) return [];
    return [
      { subject: "Puntaje", value: Math.min(employee.avgScore, 100), max: 100 },
      { subject: "Conversión", value: Math.min(employee.conversionRate, 100), max: 100 },
      { subject: "Leads", value: Math.min(employee.activeLeads, 100), max: 100 },
      { subject: "Interacciones", value: Math.min(employee.totalInteractions / 10, 100), max: 100 },
      { subject: "Resp. Rápida", value: employee.responseTime > 0 ? Math.max(0, 100 - employee.responseTime / 60) : 50, max: 100 },
    ];
  }, [employee]);

  // Segment distribution of employee's leads
  const segmentDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of employeeLeads) {
      const seg = l.segment || "lost";
      counts[seg] = (counts[seg] || 0) + 1;
    }
    return Object.entries(counts).map(([segment, count]) => ({
      segment,
      count,
    }));
  }, [employeeLeads]);

  // Save current snapshot
  async function handleSaveSnapshot() {
    if (!employee) return;
    const now = new Date();
    const dateStr = format(now, "yyyy-MM-dd");
    const snaps = currentKPIValues.map((kv) => ({
      id: `snap-${employee.employee}-${kv.kpi.id}-${dateStr}-${Math.random().toString(36).slice(2, 6)}`,
      employee_name: employee.employee,
      kpi_id: kv.kpi.id,
      kpi_name: kv.kpi.name,
      value: kv.value,
      snapshot_date: dateStr,
      created_at: now.toISOString(),
    }));
    await addSnapshots(snaps);
  }

  if (!employee) return null;

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.5rem",
    fontSize: "0.75rem",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              {employee.employee.charAt(0).toUpperCase()}
            </div>
            {employee.employee}
          </DialogTitle>
        </DialogHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SummaryCard
            icon={<Target className="h-4 w-4" />}
            label="Puntaje Prom."
            value={employee.avgScore.toString()}
            color="text-primary"
          />
          <SummaryCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Conversión"
            value={`${employee.conversionRate}%`}
            color="text-emerald-600"
          />
          <SummaryCard
            icon={<Clock className="h-4 w-4" />}
            label="Resp. Prom."
            value={employee.responseTime > 0 ? `${Math.round(employee.responseTime / 60)} min` : "—"}
            color="text-blue-600"
          />
          <SummaryCard
            icon={<Users className="h-4 w-4" />}
            label="Leads Activos"
            value={employee.activeLeads.toString()}
            color="text-amber-600"
          />
          <SummaryCard
            icon={<MessageSquare className="h-4 w-4" />}
            label="Interacciones"
            value={employee.totalInteractions.toLocaleString("es-CR")}
            color="text-purple-600"
          />
        </div>

        {/* Row 1: Radar + Segment Distribution */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Perfil de Rendimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid className="stroke-border" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                  <Radar name="Rendimiento" dataKey="value" stroke="#1A4A28" fill="#1A4A28" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribución de Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={segmentDist} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis dataKey="segment" type="category" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={70} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name="Leads" fill="#1A4A28" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Activity timeline */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Actividad Diaria (Últimos 30 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={activityTimeline}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} className="fill-muted-foreground" interval={4} />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Interacciones" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Row 3: Custom KPIs */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">
              KPIs Personalizados
            </CardTitle>
            <button
              onClick={handleSaveSnapshot}
              className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              📸 Guardar Snapshot
            </button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {currentKPIValues.map((kv, idx) => (
                <div
                  key={kv.kpi.id}
                  className="rounded-lg border bg-muted/30 p-3 text-center"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {kv.kpi.name}
                  </p>
                  <p
                    className="mt-1 font-display text-xl font-bold"
                    style={{ color: CHART_COLORS[idx % CHART_COLORS.length] }}
                  >
                    {kv.value}
                    {kv.kpi.unit && (
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                        {kv.kpi.unit}
                      </span>
                    )}
                  </p>
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                    {kv.kpi.higher_is_better ? (
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-blue-500" />
                    )}
                    {kv.kpi.higher_is_better ? "Mayor = Mejor" : "Menor = Mejor"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Row 4: Historical KPI trends */}
        {historicalData.length > 1 && (
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Tendencia Histórica de KPIs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  {kpiDefs.map((kpi, idx) => (
                    <Line
                      key={kpi.id}
                      type="monotone"
                      dataKey={kpi.name}
                      stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Predictive section */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-primary" />
              Predicción de Rendimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PredictiveInsights employee={employee} activityTimeline={activityTimeline} />
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center shadow-sm">
      <div className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted ${color}`}>
        {icon}
      </div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`font-display text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function PredictiveInsights({
  employee,
  activityTimeline,
}: {
  employee: EmployeeStats;
  activityTimeline: { date: string; count: number }[];
}) {
  // Simple trend analysis
  const recentActivity = activityTimeline.slice(-7);
  const olderActivity = activityTimeline.slice(-14, -7);
  const recentAvg =
    recentActivity.length > 0
      ? recentActivity.reduce((s, d) => s + d.count, 0) / recentActivity.length
      : 0;
  const olderAvg =
    olderActivity.length > 0
      ? olderActivity.reduce((s, d) => s + d.count, 0) / olderActivity.length
      : 0;

  const activityTrend =
    recentAvg > olderAvg * 1.1
      ? "increasing"
      : recentAvg < olderAvg * 0.9
        ? "decreasing"
        : "stable";

  const conversionHealth =
    employee.conversionRate >= 30
      ? "excellent"
      : employee.conversionRate >= 15
        ? "good"
        : employee.conversionRate >= 5
          ? "moderate"
          : "needs_attention";

  const responseHealth =
    employee.responseTime <= 300
      ? "excellent"
      : employee.responseTime <= 900
        ? "good"
        : employee.responseTime <= 3600
          ? "moderate"
          : "needs_attention";

  const insights = [
    {
      label: "Tendencia de Actividad",
      value:
        activityTrend === "increasing"
          ? "En aumento"
          : activityTrend === "decreasing"
            ? "En descenso"
            : "Estable",
      icon:
        activityTrend === "increasing" ? (
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        ) : activityTrend === "decreasing" ? (
          <TrendingDown className="h-4 w-4 text-red-500" />
        ) : (
          <Minus className="h-4 w-4 text-amber-500" />
        ),
      color:
        activityTrend === "increasing"
          ? "text-emerald-600"
          : activityTrend === "decreasing"
            ? "text-red-600"
            : "text-amber-600",
    },
    {
      label: "Salud de Conversión",
      value:
        conversionHealth === "excellent"
          ? "Excelente"
          : conversionHealth === "good"
            ? "Buena"
            : conversionHealth === "moderate"
              ? "Moderada"
              : "Requiere atención",
      icon: <Target className="h-4 w-4" />,
      color:
        conversionHealth === "excellent" || conversionHealth === "good"
          ? "text-emerald-600"
          : conversionHealth === "moderate"
            ? "text-amber-600"
            : "text-red-600",
    },
    {
      label: "Velocidad de Respuesta",
      value:
        responseHealth === "excellent"
          ? "Excelente"
          : responseHealth === "good"
            ? "Buena"
            : responseHealth === "moderate"
              ? "Moderada"
              : "Requiere atención",
      icon: <Clock className="h-4 w-4" />,
      color:
        responseHealth === "excellent" || responseHealth === "good"
          ? "text-emerald-600"
          : responseHealth === "moderate"
            ? "text-amber-600"
            : "text-red-600",
    },
    {
      label: "Carga de Trabajo",
      value:
        employee.activeLeads > 50
          ? "Alta"
          : employee.activeLeads > 20
            ? "Moderada"
            : "Baja",
      icon: <Users className="h-4 w-4" />,
      color:
        employee.activeLeads > 50
          ? "text-red-600"
          : employee.activeLeads > 20
            ? "text-amber-600"
            : "text-emerald-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {insights.map((insight) => (
        <div
          key={insight.label}
          className="rounded-lg border bg-muted/30 p-3 text-center"
        >
          <div className={`mx-auto mb-1 ${insight.color}`}>{insight.icon}</div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {insight.label}
          </p>
          <p className={`text-sm font-semibold ${insight.color}`}>
            {insight.value}
          </p>
        </div>
      ))}
    </div>
  );
}
