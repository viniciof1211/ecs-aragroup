import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { EmployeeDetailDialog } from "./EmployeeDetailDialog";
import { KPIEditorDialog } from "./KPIEditorDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  scoreDistribution,
  channelStats,
  employeeStats,
  interactionHeatmap,
  funnelAnalysis,
  brandComparison,
  responseTimeDistribution,
} from "@/lib/analytics-engine";
import { CHANNEL_LABELS } from "@/types/ecs";
import type { ECSLead, ECSInteraction, EmployeeStats } from "@/types/ecs";

const COLORS = ["#1A4A28", "#2A6A3A", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#14B8A6", "#F97316"];
const FUNNEL_COLORS = ["#1A4A28", "#2A6A3A", "#3B82F6", "#F59E0B", "#8B5CF6", "#EF4444"];

interface DiagnosticTabProps {
  leads: ECSLead[];
  interactions: ECSInteraction[];
}

export function DiagnosticTab({ leads, interactions }: DiagnosticTabProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeStats | null>(null);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [kpiEditorOpen, setKpiEditorOpen] = useState(false);

  const distData = scoreDistribution(leads);
  const chStats = channelStats(leads, interactions);
  const empStats = employeeStats(leads, interactions);
  const heatmapData = interactionHeatmap(interactions);
  const funnel = funnelAnalysis(leads);
  const brands = brandComparison(leads);
  const respDist = responseTimeDistribution(interactions);

  // Heatmap: find max for color scaling
  const heatMax = Math.max(...heatmapData.map((h) => h.count), 1);

  return (
    <div className="space-y-6">
      {/* Row 1: Score Distribution + Funnel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Distribución de Puntajes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                />
                <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                  {distData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Embudo de Conversión
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const stageH = 44;
              const gap = 2;
              const totalH = funnel.length * stageH + (funnel.length - 1) * gap;
              const svgW = 400;
              const cx = svgW / 2;
              const maxHalf = svgW * 0.48;
              const minHalf = svgW * 0.08;
              const maxCount = funnel[0]?.count || 1;

              const halfWidths = funnel.map((s) => {
                const ratio = Math.max(0.15, s.count / maxCount);
                return minHalf + (maxHalf - minHalf) * ratio;
              });

              return (
                <div className="relative mx-auto" style={{ width: "100%", maxWidth: svgW, height: totalH }}>
                  <svg
                    viewBox={`0 0 ${svgW} ${totalH}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="h-full w-full"
                  >
                    <defs>
                      {funnel.map((_, idx) => {
                        const color = FUNNEL_COLORS[idx] ?? FUNNEL_COLORS[FUNNEL_COLORS.length - 1];
                        return (
                          <linearGradient key={idx} id={`fg-${idx}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                            <stop offset="50%" stopColor={color} stopOpacity={1} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.85} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    {funnel.map((stage, idx) => {
                      const y = idx * (stageH + gap);
                      const topHalf = halfWidths[idx];
                      const botHalf = idx < funnel.length - 1 ? halfWidths[idx + 1] : topHalf * 0.6;
                      const points = [
                        `${cx - topHalf},${y}`,
                        `${cx + topHalf},${y}`,
                        `${cx + botHalf},${y + stageH}`,
                        `${cx - botHalf},${y + stageH}`,
                      ].join(" ");
                      return (
                        <polygon
                          key={stage.stage}
                          points={points}
                          fill={`url(#fg-${idx})`}
                          className="transition-all duration-500 hover:brightness-110"
                          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }}
                        />
                      );
                    })}
                  </svg>
                  {funnel.map((stage, idx) => {
                    const y = idx * (stageH + gap);
                    return (
                      <div
                        key={`label-${stage.stage}`}
                        className="pointer-events-none absolute left-0 flex w-full items-center justify-center gap-2"
                        style={{ top: y, height: stageH }}
                      >
                        <span className="text-xs font-semibold text-white drop-shadow-sm">
                          {stage.stage}
                        </span>
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          {stage.count.toLocaleString("es-CR")}
                          {idx > 0 && ` · ${stage.rate}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Channel Effectiveness + Response Time */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Efectividad por Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Interacciones</TableHead>
                  <TableHead className="text-right">Puntaje Prom.</TableHead>
                  <TableHead className="text-right">Resp. Prom.</TableHead>
                  <TableHead className="text-right">Conversión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chStats.map((ch) => (
                  <TableRow key={ch.channel}>
                    <TableCell className="font-medium">
                      {CHANNEL_LABELS[ch.channel] || ch.channel}
                    </TableCell>
                    <TableCell className="text-right">{ch.count.toLocaleString("es-CR")}</TableCell>
                    <TableCell className="text-right">{ch.avgScore}</TableCell>
                    <TableCell className="text-right">
                      {ch.avgResponseTime > 0
                        ? `${Math.round(ch.avgResponseTime / 60)} min`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">{ch.conversionRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Tiempo de Respuesta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={respDist}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="bucket" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                />
                <Bar dataKey="count" name="Interacciones" fill="#1A4A28" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Employee Leaderboard */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="font-display text-lg">
            Rendimiento por Empleado
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setKpiEditorOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Gestionar KPIs
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead className="text-right">Puntaje Prom.</TableHead>
                <TableHead className="text-right">Resp. Prom.</TableHead>
                <TableHead className="text-right">Conversión</TableHead>
                <TableHead className="text-right">Leads Activos</TableHead>
                <TableHead className="text-right">Interacciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empStats.map((emp, idx) => (
                <TableRow
                  key={emp.employee}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onDoubleClick={() => {
                    setSelectedEmployee(emp);
                    setEmployeeDialogOpen(true);
                  }}
                  title="Doble click para ver detalle"
                >
                  <TableCell className="font-display font-bold">{idx + 1}</TableCell>
                  <TableCell className="font-medium text-primary hover:underline">{emp.employee}</TableCell>
                  <TableCell className="text-right">{emp.avgScore}</TableCell>
                  <TableCell className="text-right">
                    {emp.responseTime > 0 ? `${Math.round(emp.responseTime / 60)} min` : "—"}
                  </TableCell>
                  <TableCell className="text-right">{emp.conversionRate}%</TableCell>
                  <TableCell className="text-right">{emp.activeLeads}</TableCell>
                  <TableCell className="text-right">{emp.totalInteractions.toLocaleString("es-CR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Row 4: Heatmap + Brand Comparison */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Mapa de Calor de Interacciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="mb-1 flex">
                  <div className="w-10" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
                      {h}
                    </div>
                  ))}
                </div>
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day, dayIdx) => (
                  <div key={day} className="flex items-center">
                    <div className="w-10 text-[10px] text-muted-foreground">{day}</div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const entry = heatmapData[dayIdx * 24 + h];
                      const intensity = entry ? entry.count / heatMax : 0;
                      return (
                        <div
                          key={h}
                          className="m-[1px] flex-1 rounded-sm"
                          style={{
                            height: "18px",
                            backgroundColor: `rgba(26, 74, 40, ${Math.max(intensity * 0.9, 0.05)})`,
                          }}
                          title={`${day} ${h}:00 — ${entry?.count ?? 0} interacciones`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Comparación por Marca
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Puntaje Prom.</TableHead>
                  <TableHead className="text-right">Conversión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((b) => (
                  <TableRow key={b.brand}>
                    <TableCell className="font-medium">{b.brand}</TableCell>
                    <TableCell className="text-right">{b.count.toLocaleString("es-CR")}</TableCell>
                    <TableCell className="text-right">{b.avgScore}</TableCell>
                    <TableCell className="text-right">{b.conversionRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <EmployeeDetailDialog
        open={employeeDialogOpen}
        onOpenChange={setEmployeeDialogOpen}
        employee={selectedEmployee}
        leads={leads}
        interactions={interactions}
      />
      <KPIEditorDialog
        open={kpiEditorOpen}
        onOpenChange={setKpiEditorOpen}
      />
    </div>
  );
}
