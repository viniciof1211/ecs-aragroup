import { useState, useMemo, useCallback, useEffect } from "react";
import {
  RefreshCw,
  FlaskConical,
  TrendingUp,
  UserCheck,
  Heart,
  ChevronDown,
  ChevronUp,
  Target,
  Clock,
  Users,
  Zap,
  Filter,
  Play,
  BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useLeads } from "@/hooks/useLeads";
import { generateABTests, type ABTest, type ABCategory } from "@/lib/ab-engine";
import { ExecuteTestDialog } from "@/components/ab/ExecuteTestDialog";
import { ExperimentDashboard } from "@/components/ab/ExperimentDashboard";
import { useExperimentStore } from "@/stores/useExperimentStore";

const CATEGORY_CONFIG: Record<
  ABCategory | "all",
  { label: string; icon: typeof FlaskConical; color: string; bg: string }
> = {
  all: { label: "Todas", icon: FlaskConical, color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
  conversion: { label: "Conversión", icon: TrendingUp, color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  reactivation: { label: "Reactivación", icon: UserCheck, color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40" },
  retention: { label: "Fidelización", icon: Heart, color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-950/40" },
};

const IMPACT_CONFIG: Record<string, { label: string; color: string }> = {
  alto: { label: "Alto", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  medio: { label: "Medio", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  bajo: { label: "Bajo", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
};

function ABTestCard({
  test,
  index,
  onExecute,
}: {
  test: ABTest;
  index: number;
  onExecute: (test: ABTest) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const catConfig = CATEGORY_CONFIG[test.category];
  const impactConfig = IMPACT_CONFIG[test.estimatedImpact];
  const CatIcon = catConfig.icon;

  return (
    <Card className={cn("shadow-card transition-all hover:shadow-md", expanded && "ring-2 ring-[#1A4A28]/20")}>
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", catConfig.bg)}>
              <CatIcon className={cn("h-4.5 w-4.5", catConfig.color)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                <Badge variant="outline" className={cn("text-[10px]", catConfig.color)}>
                  {catConfig.label}
                </Badge>
                <Badge className={cn("text-[10px]", impactConfig.color)}>
                  Impacto {impactConfig.label}
                </Badge>
              </div>
              <h3 className="mt-1 font-display text-sm font-bold leading-tight">{test.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{test.hypothesis}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-[#1A4A28] hover:bg-[#2A6A3A] h-7"
              onClick={() => onExecute(test)}
            >
              <Play className="h-3 w-3" />
              Ejecutar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Collapsed summary */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            {test.funnelStage}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {test.durationDays}d
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            n={test.sampleSize}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {test.channel}
          </span>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Variante A (Tratamiento)
                </p>
                <p className="mt-1 text-xs leading-relaxed">{test.variantA}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Variante B (Control)
                </p>
                <p className="mt-1 text-xs leading-relaxed">{test.variantB}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Métrica</p>
                <p className="mt-0.5 text-xs">{test.metric}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Segmento</p>
                <p className="mt-0.5 text-xs">{test.targetSegment}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Duración</p>
                <p className="mt-0.5 text-xs">{test.durationDays} días</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Muestra</p>
                <p className="mt-0.5 text-xs">{test.sampleSize} leads por variante</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ABTesting() {
  const { data: leads = [] } = useLeads();
  const [category, setCategory] = useState<ABCategory | "all">("all");
  const [seed, setSeed] = useState(Date.now());
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("recommendations");

  const experiments = useExperimentStore((s) => s.experiments);
  const hydrate = useExperimentStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tests = useMemo(
    () => generateABTests(leads, category, category === "all" ? 12 : 10, seed),
    [leads, category, seed]
  );

  const handleRefresh = useCallback(() => {
    setSeed(Date.now());
  }, []);

  const handleExecute = useCallback((test: ABTest) => {
    setSelectedTest(test);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // If an experiment was just created, switch to experiments tab
      setActiveTab("experiments");
    }
  }, []);

  // Stats
  const conversionTests = tests.filter((t) => t.category === "conversion");
  const reactivationTests = tests.filter((t) => t.category === "reactivation");
  const retentionTests = tests.filter((t) => t.category === "retention");
  const activeExperiments = experiments.filter((e) => e.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Motor de Pruebas A/B
          </h1>
          <p className="text-sm text-muted-foreground">
            Recomendaciones IA para optimizar conversión, reactivación y fidelización
          </p>
        </div>
        {activeTab === "recommendations" && (
          <Button
            onClick={handleRefresh}
            className="gap-2 bg-[#1A4A28] hover:bg-[#2A6A3A]"
          >
            <RefreshCw className="h-4 w-4" />
            Generar Nuevas Pruebas
          </Button>
        )}
      </div>

      {/* Tabs: Recommendations vs Experiments */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-2">
          <TabsTrigger value="recommendations" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Recomendaciones
          </TabsTrigger>
          <TabsTrigger value="experiments" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Experimentos
            {activeExperiments > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] justify-center bg-[#1A4A28] text-[10px] text-white">
                {activeExperiments}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Recommendations Tab ─── */}
        <TabsContent value="recommendations" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card className="shadow-card">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <FlaskConical className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tests.length}</p>
                  <p className="text-xs text-muted-foreground">Pruebas Generadas</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conversionTests.length}</p>
                  <p className="text-xs text-muted-foreground">Conversión</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
                  <UserCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{reactivationTests.length}</p>
                  <p className="text-xs text-muted-foreground">Reactivación</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/40">
                  <Heart className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{retentionTests.length}</p>
                  <p className="text-xs text-muted-foreground">Fidelización</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(Object.keys(CATEGORY_CONFIG) as (ABCategory | "all")[]).map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const Icon = cfg.icon;
              return (
                <Button
                  key={cat}
                  variant={category === cat ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "gap-1.5 text-xs",
                    category === cat && "bg-[#1A4A28] hover:bg-[#2A6A3A]"
                  )}
                  onClick={() => setCategory(cat)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </Button>
              );
            })}
          </div>

          {/* A/B Test Cards */}
          <div className="space-y-3">
            {tests.map((test, idx) => (
              <ABTestCard key={test.id} test={test} index={idx} onExecute={handleExecute} />
            ))}
          </div>

          {tests.length === 0 && (
            <Card className="shadow-card">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FlaskConical className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No hay pruebas para esta categoría. Haz clic en "Generar Nuevas Pruebas".
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Experiments Tab ─── */}
        <TabsContent value="experiments">
          <ExperimentDashboard />
        </TabsContent>
      </Tabs>

      {/* Execute Test Dialog */}
      <ExecuteTestDialog
        test={selectedTest}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
      />
    </div>
  );
}
