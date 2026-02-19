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
  LineChart,
  Line,
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
  responseTimeTrend,
} from "@/lib/analytics-engine";
import { CHANNEL_LABELS } from "@/types/ecs";
import type { ECSLead, ECSInteraction, EmployeeStats } from "@/types/ecs";
import { MetaAdsPanel } from "./MetaAdsPanel";

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
  const respTrend = responseTimeTrend(interactions);

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
              const n = funnel.length;
              const svgW = 400;
              const cx = svgW / 2;
              const bodyH = 52;
              const ellipseRy = 18;
              const maxRx = svgW * 0.46;
              const minRx = svgW * 0.09;

              // Force linear taper: stage 0 = widest, last = narrowest
              const rxList = funnel.map((_, idx) => {
                const t = idx / Math.max(n - 1, 1);
                return maxRx - t * (maxRx - minRx);
              });

              // Y positions: each stage starts after the previous body + overlap for ellipse
              const yPositions: number[] = [];
              for (let i = 0; i < n; i++) {
                yPositions.push(i === 0 ? ellipseRy + 2 : yPositions[i - 1] + bodyH);
              }
              const totalH = yPositions[n - 1] + bodyH + ellipseRy + 4;

              return (
                <div className="relative mx-auto" style={{ width: "100%", maxWidth: svgW }}>
                  <svg
                    viewBox={`0 0 ${svgW} ${totalH}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="w-full"
                  >
                    <defs>
                      {funnel.map((_, idx) => {
                        const color = FUNNEL_COLORS[idx] ?? FUNNEL_COLORS[FUNNEL_COLORS.length - 1];
                        return (
                          <linearGradient key={`body-${idx}`} id={`fb-${idx}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                            <stop offset="30%" stopColor={color} stopOpacity={0.95} />
                            <stop offset="50%" stopColor={color} stopOpacity={1} />
                            <stop offset="70%" stopColor={color} stopOpacity={0.95} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.55} />
                          </linearGradient>
                        );
                      })}
                    </defs>

                    {/* Draw stages bottom-to-top so upper stages overlap lower ones */}
                    {[...funnel].map((_, i) => n - 1 - i).map((idx) => {
                      const stage = funnel[idx];
                      const topY = yPositions[idx];
                      const botY = topY + bodyH;
                      const topRx = rxList[idx];
                      const botRx = idx < n - 1 ? rxList[idx + 1] : topRx * 0.5;
                      const topRy = ellipseRy * (topRx / maxRx);
                      const botRy = ellipseRy * (botRx / maxRx);
                      const color = FUNNEL_COLORS[idx] ?? FUNNEL_COLORS[FUNNEL_COLORS.length - 1];

                      // 3D body: front-face arc at top → lines down → back-face arc at bottom
                      const bodyPath = [
                        `M ${cx - topRx} ${topY}`,
                        `A ${topRx} ${topRy} 0 0 1 ${cx + topRx} ${topY}`,
                        `L ${cx + botRx} ${botY}`,
                        `A ${botRx} ${botRy} 0 0 1 ${cx - botRx} ${botY}`,
                        `Z`,
                      ].join(" ");

                      return (
                        <g key={stage.stage}>
                          {/* Body */}
                          <path d={bodyPath} fill={`url(#fb-${idx})`} />
                          {/* Bottom rim ellipse (darker = depth) */}
                          <ellipse
                            cx={cx} cy={botY} rx={botRx} ry={botRy}
                            fill={color} opacity={0.7}
                          />
                          {/* Top cap ellipse (lighter = 3D highlight) */}
                          <ellipse
                            cx={cx} cy={topY} rx={topRx} ry={topRy}
                            fill={color} opacity={0.45}
                          />
                          {/* Top rim stroke for 3D edge */}
                          <ellipse
                            cx={cx} cy={topY} rx={topRx} ry={topRy}
                            fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1}
                          />
                        </g>
                      );
                    })}

                    {/* Labels on top of everything */}
                    {funnel.map((stage, idx) => {
                      const labelY = yPositions[idx] + bodyH / 2 + 5;
                      return (
                        <text
                          key={`lbl-${idx}`}
                          x={cx}
                          y={labelY}
                          textAnchor="middle"
                          className="fill-white font-semibold"
                          style={{ fontSize: 11, textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}
                        >
                          {stage.stage} — {stage.count.toLocaleString("es-CR")}
                          {idx > 0 ? ` (${stage.rate}%)` : ""}
                        </text>
                      );
                    })}
                  </svg>
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
            <ResponsiveContainer width="100%" height={180}>
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
            {respTrend.length > 1 && (
              <div className="mt-3 border-t pt-3">
                <p className="mb-1 text-[10px] font-medium text-muted-foreground">Tendencia — Tiempo Promedio de Respuesta (min)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={respTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "0.75rem",
                      }}
                      formatter={(v) => [`${v ?? 0} min`, "Promedio"]}
                    />
                    <Line type="monotone" dataKey="avgMinutes" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} name="Promedio (min)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
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

      {/* Meta Ads — Diagnostic */}
      <div className="mt-6 border-t pt-6">
        <h3 className="mb-4 font-display text-lg font-bold flex items-center gap-2">
          📣 Marketing & Ads — Diagnóstico
        </h3>
        <MetaAdsPanel mode="diagnostic" />
      </div>
    </div>
  );
}
