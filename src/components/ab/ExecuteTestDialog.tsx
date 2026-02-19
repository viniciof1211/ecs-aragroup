import { useState, useMemo, useCallback } from "react";
import {
  Play,
  Users,
  CheckCircle2,
  Target,
  Sparkles,
  Loader2,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLeads } from "@/hooks/useLeads";
import { recommendLeadsForTest, type ABTest } from "@/lib/ab-engine";
import {
  useExperimentStore,
  generateExperimentId,
  computeProjections,
  type EnrolledLead,
} from "@/stores/useExperimentStore";
import { getSegmentConfig, getSegmentFromScore } from "@/types/ecs";

interface ExecuteTestDialogProps {
  test: ABTest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecuteTestDialog({ test, open, onOpenChange }: ExecuteTestDialogProps) {
  const { data: leads = [] } = useLeads();
  const addExperiment = useExperimentStore((s) => s.addExperiment);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);

  const recommended = useMemo(() => {
    if (!test) return [];
    return recommendLeadsForTest(test, leads, 80);
  }, [test, leads]);

  const filtered = useMemo(() => {
    if (!search) return recommended;
    const q = search.toLowerCase();
    return recommended.filter(
      (r) =>
        r.lead.name?.toLowerCase().includes(q) ||
        r.lead.email?.toLowerCase().includes(q) ||
        r.lead.company?.toLowerCase().includes(q)
    );
  }, [recommended, search]);

  const toggleLead = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filtered.map((r) => r.lead.id)));
  }, [filtered]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectTop = useCallback(
    (n: number) => {
      setSelectedIds(new Set(recommended.slice(0, n).map((r) => r.lead.id)));
    },
    [recommended]
  );

  const handleLaunch = useCallback(() => {
    if (!test || selectedIds.size === 0) return;
    setLaunching(true);

    const now = new Date().toISOString();
    const endsAt = new Date(Date.now() + test.durationDays * 86400000).toISOString();

    // Assign variants: alternate A/B
    const selectedLeads = recommended.filter((r) => selectedIds.has(r.lead.id));
    const enrolled: EnrolledLead[] = selectedLeads.map((r, i) => ({
      leadId: r.lead.id,
      leadName: r.lead.name,
      variant: i % 2 === 0 ? "A" : "B",
      enrolledScore: r.lead.current_score,
      enrolledStatus: r.lead.status,
      enrolledSegment: r.lead.segment,
      enrolledAt: now,
    }));

    const projections = computeProjections(test, enrolled.length);

    addExperiment({
      id: generateExperimentId(),
      test,
      status: "active",
      createdAt: now,
      startedAt: now,
      endsAt,
      leads: enrolled,
      snapshots: [],
      projections,
      notes: "",
    });

    setTimeout(() => {
      setLaunching(false);
      setLaunched(true);
    }, 800);
  }, [test, selectedIds, recommended, addExperiment]);

  const handleClose = useCallback(() => {
    setSelectedIds(new Set());
    setSearch("");
    setLaunching(false);
    setLaunched(false);
    onOpenChange(false);
  }, [onOpenChange]);

  if (!test) return null;

  const variantACount = Math.ceil(selectedIds.size / 2);
  const variantBCount = Math.floor(selectedIds.size / 2);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {launched ? "✅ Experimento Lanzado" : "Ejecutar Prueba A/B"}
          </DialogTitle>
        </DialogHeader>

        {launched ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <h3 className="font-display text-xl font-bold text-center">{test.title}</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Se creó el experimento con {selectedIds.size} leads ({variantACount} en Variante A, {variantBCount} en Variante B).
              Puedes monitorear el progreso en la pestaña "Experimentos Activos".
            </p>
            <Button onClick={handleClose} className="bg-[#1A4A28] hover:bg-[#2A6A3A]">
              Ir a Experimentos
            </Button>
          </div>
        ) : (
          <>
            {/* Test Summary */}
            <Card className="shrink-0">
              <CardContent className="p-4">
                <h3 className="font-display text-sm font-bold">{test.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{test.hypothesis}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px]">{test.funnelStage}</Badge>
                  <Badge variant="outline" className="text-[10px]">{test.channel}</Badge>
                  <Badge variant="outline" className="text-[10px]">{test.durationDays} días</Badge>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      test.estimatedImpact === "alto" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" :
                      test.estimatedImpact === "medio" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    )}
                  >
                    Impacto {test.estimatedImpact}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Lead Selection Header */}
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">
                  {recommended.length} leads recomendados por IA
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => selectTop(10)}>
                  Top 10
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => selectTop(20)}>
                  Top 20
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectAll}>
                  Todos
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectNone}>
                  Ninguno
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar lead por nombre, email, empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>

            {/* Lead List */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1">
              {filtered.map((rec) => {
                const selected = selectedIds.has(rec.lead.id);
                const segConfig = getSegmentConfig(rec.lead.segment || getSegmentFromScore(rec.lead.current_score));
                return (
                  <div
                    key={rec.lead.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors",
                      selected
                        ? "border-[#1A4A28] bg-[#1A4A28]/5 dark:bg-[#1A4A28]/20"
                        : "border-transparent hover:bg-muted/50"
                    )}
                    onClick={() => toggleLead(rec.lead.id)}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                        selected
                          ? "border-[#1A4A28] bg-[#1A4A28] text-white"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {selected && <CheckCircle2 className="h-3 w-3" />}
                    </div>

                    {/* Lead info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{rec.lead.name}</span>
                        <Badge
                          className="text-[9px] text-white shrink-0"
                          style={{ backgroundColor: segConfig.color }}
                        >
                          {rec.lead.current_score}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {rec.lead.company || rec.lead.email || "—"} · {rec.lead.status}
                      </p>
                    </div>

                    {/* Fit score */}
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3 text-amber-500" />
                        <span className={cn(
                          "text-xs font-bold",
                          rec.fitScore >= 60 ? "text-emerald-600" :
                          rec.fitScore >= 40 ? "text-amber-600" : "text-muted-foreground"
                        )}>
                          {rec.fitScore}%
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground max-w-[140px] truncate text-right">
                        {rec.reasons[0]}
                      </p>
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 opacity-30" />
                  <p className="mt-2 text-sm">No se encontraron leads</p>
                </div>
              )}
            </div>

            {/* Footer — Launch */}
            <div className="flex items-center justify-between border-t pt-3 shrink-0">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{selectedIds.size}</span> leads seleccionados
                {selectedIds.size > 0 && (
                  <span className="ml-2">
                    (A: {variantACount} · B: {variantBCount})
                  </span>
                )}
              </div>
              <Button
                onClick={handleLaunch}
                disabled={selectedIds.size === 0 || launching}
                className="gap-2 bg-[#1A4A28] hover:bg-[#2A6A3A]"
              >
                {launching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {launching ? "Lanzando..." : "Lanzar Experimento"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
