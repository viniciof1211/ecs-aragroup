import { useMemo, useState, useEffect } from "react";
import {
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  Settings2,
  DollarSign,
  Target,
  BarChart3,
  Users,
  Megaphone,
  Shield,
} from "lucide-react";
import { format } from "date-fns";
import { useKPIStore } from "@/stores/useKPIStore";
import { KPIEditorDialog } from "./KPIEditorDialog";
import {
  KPI_VARIABLES,
  KPI_CATEGORY_LABELS,
  KPI_CATEGORY_COLORS,
  evaluateKPIFormula,
  computeBusinessVars,
  type KPICategory,
  type CustomKPIDefinition,
} from "@/types/employee-kpi";
import type { ECSLead, ECSInteraction } from "@/types/ecs";

interface KPITabProps {
  leads: ECSLead[];
  interactions: ECSInteraction[];
}

const CATEGORY_ICONS: Record<KPICategory, typeof Target> = {
  employee: Users,
  commercial: Target,
  marketing: Megaphone,
  operations: BarChart3,
  financial: DollarSign,
  board: Shield,
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
};

export function KPITab({ leads, interactions }: KPITabProps) {
  const { allKPIs, loadKPIs, snapshots, loadSnapshots, addSnapshots } = useKPIStore();
  const [kpiEditorOpen, setKpiEditorOpen] = useState(false);
  const [adSpend, setAdSpend] = useState(() => {
    const saved = localStorage.getItem("ecs-ad-spend");
    return saved ? parseFloat(saved) : 0;
  });
  const [adSpendInput, setAdSpendInput] = useState(adSpend.toString());
  const [activeCategory, setActiveCategory] = useState<KPICategory | "all">("all");

  useEffect(() => {
    loadKPIs();
    loadSnapshots();
  }, [loadKPIs, loadSnapshots]);

  const businessVars = useMemo(
    () => computeBusinessVars(leads, interactions, adSpend),
    [leads, interactions, adSpend]
  );

  const kpiDefs = allKPIs();

  const kpiValues = useMemo(() => {
    return kpiDefs.map((kpi) => ({
      kpi,
      value: evaluateKPIFormula(kpi.formula, businessVars),
    }));
  }, [kpiDefs, businessVars]);

  const filteredKPIs = activeCategory === "all"
    ? kpiValues
    : kpiValues.filter((kv) => kv.kpi.category === activeCategory);

  // Group by category for summary cards
  const categoryGroups = useMemo(() => {
    const groups: Record<string, { kpi: CustomKPIDefinition; value: number }[]> = {};
    for (const kv of kpiValues) {
      const cat = kv.kpi.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(kv);
    }
    return groups;
  }, [kpiValues]);

  // Historical data from snapshots
  const historicalData = useMemo(() => {
    if (snapshots.length === 0) return [];
    const dateMap = new Map<string, Record<string, number>>();
    for (const snap of snapshots) {
      if (!dateMap.has(snap.snapshot_date)) dateMap.set(snap.snapshot_date, {});
      dateMap.get(snap.snapshot_date)![snap.kpi_name] = snap.value;
    }
    return Array.from(dateMap.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots]);

  // Radar data for board-level overview
  const radarData = useMemo(() => {
    const boardKPIs = kpiValues.filter((kv) => kv.kpi.category === "board" || kv.kpi.id === "builtin-win-rate" || kv.kpi.id === "builtin-lead-quality");
    return boardKPIs.map((kv) => ({
      subject: kv.kpi.name.length > 15 ? kv.kpi.name.slice(0, 15) + "…" : kv.kpi.name,
      value: Math.min(kv.value, 100),
      fullMark: 100,
    }));
  }, [kpiValues]);

  function handleSaveAdSpend() {
    const val = parseFloat(adSpendInput) || 0;
    setAdSpend(val);
    localStorage.setItem("ecs-ad-spend", val.toString());
  }

  async function handleSaveSnapshot() {
    const now = new Date();
    const dateStr = format(now, "yyyy-MM-dd");
    const snaps = kpiValues.map((kv) => ({
      id: `bsnap-${kv.kpi.id}-${dateStr}-${Math.random().toString(36).slice(2, 6)}`,
      employee_name: "__business__",
      kpi_id: kv.kpi.id,
      kpi_name: kv.kpi.name,
      value: kv.value,
      snapshot_date: dateStr,
      created_at: now.toISOString(),
    }));
    await addSnapshots(snaps);
  }

  const categories: (KPICategory | "all")[] = ["all", "employee", "commercial", "marketing", "operations", "financial", "board"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">KPI Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            Indicadores clave de rendimiento — Empleados, Comercial, Marketing, Financiero y Junta Directiva
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setKpiEditorOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            Gestionar KPIs
          </Button>
          <Button variant="default" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSaveSnapshot}>
            <Save className="h-3.5 w-3.5" />
            Guardar Snapshot
          </Button>
        </div>
      </div>

      {/* Meta Ads Spend Input */}
      <Card className="shadow-card">
        <CardContent className="flex items-center gap-4 py-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Inversión Meta Ads ($):</span>
          </div>
          <Input
            type="number"
            value={adSpendInput}
            onChange={(e) => setAdSpendInput(e.target.value)}
            className="h-8 w-40 text-sm"
            placeholder="0"
          />
          <Button size="sm" className="h-8 text-xs" onClick={handleSaveAdSpend}>
            Aplicar
          </Button>
          {adSpend > 0 && (
            <span className="text-xs text-muted-foreground">
              CPL: <span className="font-semibold text-primary">${businessVars.costPerLead?.toFixed(2)}</span>
              {" · "}ROAS: <span className="font-semibold text-primary">{businessVars.roas?.toFixed(1)}x</span>
            </span>
          )}
        </CardContent>
      </Card>

      {/* Category filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto">
        {categories.map((cat) => {
          const Icon = cat === "all" ? BarChart3 : CATEGORY_ICONS[cat];
          const count = cat === "all" ? kpiValues.length : (categoryGroups[cat]?.length ?? 0);
          return (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              className="h-7 gap-1 text-[10px] shrink-0"
              style={activeCategory === cat && cat !== "all" ? { backgroundColor: KPI_CATEGORY_COLORS[cat] } : undefined}
              onClick={() => setActiveCategory(cat)}
            >
              <Icon className="h-3 w-3" />
              {cat === "all" ? "Todos" : KPI_CATEGORY_LABELS[cat]}
              <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[8px]">{count}</Badge>
            </Button>
          );
        })}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filteredKPIs.map(({ kpi, value }) => {
          const catColor = KPI_CATEGORY_COLORS[kpi.category] ?? "#666";
          const Icon = CATEGORY_ICONS[kpi.category] ?? Target;
          const formatted = kpi.unit === "$"
            ? `$${value.toLocaleString("es-CR", { maximumFractionDigits: 0 })}`
            : kpi.unit === "%"
            ? `${value.toFixed(1)}%`
            : kpi.unit === "x"
            ? `${value.toFixed(1)}x`
            : value.toLocaleString("es-CR", { maximumFractionDigits: 1 });
          return (
            <Card key={kpi.id} className="shadow-card">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: catColor }} />
                    <span className="text-[9px] text-muted-foreground">{KPI_CATEGORY_LABELS[kpi.category]}</span>
                  </div>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="mt-1 text-lg font-bold" style={{ color: catColor }}>
                  {formatted}
                </p>
                <p className="text-[10px] font-medium leading-tight">{kpi.name}</p>
                <p className="mt-0.5 text-[9px] text-muted-foreground leading-tight">{kpi.description}</p>
                <div className="mt-1 flex items-center gap-1">
                  {kpi.higher_is_better ? (
                    <TrendingUp className="h-2.5 w-2.5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5 text-blue-500" />
                  )}
                  <span className="text-[8px] text-muted-foreground">
                    {kpi.higher_is_better ? "Mayor = Mejor" : "Menor = Mejor"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Row: Radar + Historical Trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Board-level Radar */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              Vista Ejecutiva — Junta Directiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis tick={{ fontSize: 8 }} domain={[0, 100]} />
                  <Radar
                    name="KPIs"
                    dataKey="value"
                    stroke="#EF4444"
                    fill="#EF4444"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay KPIs de nivel ejecutivo configurados
              </p>
            )}
          </CardContent>
        </Card>

        {/* Historical Trend */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">
              Tendencia Histórica de KPIs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historicalData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {Object.keys(historicalData[0] ?? {})
                    .filter((k) => k !== "date")
                    .slice(0, 6)
                    .map((key, idx) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={Object.values(KPI_CATEGORY_COLORS)[idx % 6]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Minus className="h-8 w-8 opacity-30" />
                <p className="mt-2 text-sm">Sin datos históricos</p>
                <p className="text-xs">Guarda snapshots periódicamente para ver tendencias</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Business Variables Table */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">
            Variables del Negocio (Datos en Tiempo Real)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variable</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Categoría</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(businessVars)
                  .filter(([, v]) => v !== 0 || true)
                  .map(([key, value]) => {
                    const varDef = KPI_VARIABLES.find((v) => v.key === key);
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-mono text-xs">{key}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {varDef?.label ?? key}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          {typeof value === "number" ? value.toLocaleString("es-CR", { maximumFractionDigits: 2 }) : value}
                        </TableCell>
                        <TableCell>
                          {varDef && (
                            <Badge variant="secondary" className="text-[8px]">
                              {KPI_CATEGORY_LABELS[varDef.category as KPICategory] ?? varDef.category}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* KPI Definitions Table */}
      <Card className="shadow-card">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="font-display text-lg">
            Catálogo de KPIs ({kpiDefs.length})
          </CardTitle>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setKpiEditorOpen(true)}>
            <Settings2 className="h-3 w-3" /> Editar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Fórmula</TableHead>
                  <TableHead className="text-right">Valor Actual</TableHead>
                  <TableHead className="text-right">Unidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiValues.map(({ kpi, value }) => (
                  <TableRow key={kpi.id}>
                    <TableCell>
                      <div>
                        <span className="text-sm font-medium">{kpi.name}</span>
                        <p className="text-[10px] text-muted-foreground">{kpi.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-[8px]"
                        style={{ borderColor: KPI_CATEGORY_COLORS[kpi.category] }}
                      >
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: KPI_CATEGORY_COLORS[kpi.category] }} />
                        {KPI_CATEGORY_LABELS[kpi.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground">
                      {kpi.formula}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold" style={{ color: KPI_CATEGORY_COLORS[kpi.category] }}>
                      {value.toLocaleString("es-CR", { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{kpi.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <KPIEditorDialog open={kpiEditorOpen} onOpenChange={setKpiEditorOpen} />
    </div>
  );
}
