import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, Pencil, Trash2, Variable, Sparkles, Lightbulb } from "lucide-react";
import { useKPIStore } from "@/stores/useKPIStore";
import {
  KPI_VARIABLES,
  KPI_RECOMMENDATIONS,
  KPI_CATEGORY_LABELS,
  KPI_CATEGORY_COLORS,
  evaluateKPIFormula,
  type CustomKPIDefinition,
  type KPICategory,
  type KPIRecommendation,
} from "@/types/employee-kpi";

interface KPIEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_VARS: Record<string, number> = {
  avgScore: 45, responseTime: 1200, conversionRate: 25, activeLeads: 30,
  totalInteractions: 150, totalLeads: 500, newLeads: 80, wonLeads: 50,
  lostLeads: 120, qualifiedLeads: 100, proposalLeads: 60, negotiationLeads: 30,
  contactedLeads: 160, avgECSScore: 42, hotLeads: 40, warmLeads: 80,
  coldLeads: 200, dormantLeads: 130, totalRevenue: 250000, avgDealSize: 5000,
  pipelineValue: 180000, totalInteractionsGlobal: 61000, avgResponseTimeGlobal: 3600,
  channelCount: 8, employeeCount: 12, adSpend: 15000, costPerLead: 30,
  costPerQualifiedLead: 150, costPerConversion: 300, roas: 16.7,
  facebookLeads: 120, winRate: 29.4, pipelineVelocity: 90,
  leadToQualifiedRate: 48, qualifiedToWonRate: 50,
};

const CATEGORY_OPTIONS: KPICategory[] = ["employee", "commercial", "marketing", "operations", "financial", "board"];

export function KPIEditorDialog({ open, onOpenChange }: KPIEditorDialogProps) {
  const { allKPIs, addKPI, updateKPI, removeKPI, loadKPIs } = useKPIStore();

  const [editing, setEditing] = useState<CustomKPIDefinition | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formula, setFormula] = useState("");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState<KPICategory>("employee");
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const [formulaError, setFormulaError] = useState("");
  const [formulaPreview, setFormulaPreview] = useState<number | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [varFilter, setVarFilter] = useState<KPICategory | "all">("all");

  useEffect(() => {
    if (open) loadKPIs();
  }, [open, loadKPIs]);

  useEffect(() => {
    if (!formula.trim()) {
      setFormulaError("");
      setFormulaPreview(null);
      return;
    }
    try {
      const result = evaluateKPIFormula(formula, SAMPLE_VARS);
      setFormulaPreview(result);
      setFormulaError("");
    } catch {
      setFormulaError("Fórmula inválida");
      setFormulaPreview(null);
    }
  }, [formula]);

  function resetForm() {
    setEditing(null);
    setName("");
    setDescription("");
    setFormula("");
    setUnit("");
    setCategory("employee");
    setHigherIsBetter(true);
    setFormulaError("");
    setFormulaPreview(null);
  }

  function startEdit(kpi: CustomKPIDefinition) {
    setEditing(kpi);
    setName(kpi.name);
    setDescription(kpi.description);
    setFormula(kpi.formula);
    setUnit(kpi.unit);
    setCategory(kpi.category);
    setHigherIsBetter(kpi.higher_is_better);
    setShowRecommendations(false);
  }

  function applyRecommendation(rec: KPIRecommendation) {
    setName(rec.name);
    setDescription(rec.description);
    setFormula(rec.formula);
    setUnit(rec.unit);
    setCategory(rec.category);
    setHigherIsBetter(rec.higher_is_better);
    setShowRecommendations(false);
  }

  async function handleSave() {
    if (!name.trim() || !formula.trim()) return;
    const now = new Date().toISOString();
    if (editing) {
      await updateKPI({
        ...editing,
        name: name.trim(),
        description: description.trim(),
        formula: formula.trim(),
        unit: unit.trim(),
        category,
        higher_is_better: higherIsBetter,
        updated_at: now,
      });
    } else {
      await addKPI({
        id: `kpi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        description: description.trim(),
        formula: formula.trim(),
        unit: unit.trim(),
        category,
        higher_is_better: higherIsBetter,
        created_at: now,
        updated_at: now,
      });
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    await removeKPI(id);
    if (editing?.id === id) resetForm();
  }

  const allDefs = allKPIs();
  const filteredVars = varFilter === "all" ? KPI_VARIABLES : KPI_VARIABLES.filter((v) => v.category === varFilter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Gestionar KPIs — Empleados y Negocio
          </DialogTitle>
        </DialogHeader>

        {/* Existing KPIs list grouped by category */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">
            KPIs Activos ({allDefs.length})
          </h4>
          <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-md border p-2">
            {allDefs.map((kpi) => {
              const isBuiltin = kpi.id.startsWith("builtin-");
              const catColor = KPI_CATEGORY_COLORS[kpi.category] ?? "#666";
              return (
                <div
                  key={kpi.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: catColor }}
                      />
                      <span className="text-sm font-medium">{kpi.name}</span>
                      {isBuiltin && (
                        <Badge variant="outline" className="text-[8px]">Integrado</Badge>
                      )}
                      <Badge variant="secondary" className="text-[8px]">
                        {KPI_CATEGORY_LABELS[kpi.category]}
                      </Badge>
                      {kpi.unit && (
                        <span className="text-[9px] text-muted-foreground">{kpi.unit}</span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">{kpi.description}</p>
                  </div>
                  {!isBuiltin && (
                    <div className="ml-2 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(kpi)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(kpi.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommendation Engine */}
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setShowRecommendations(!showRecommendations)}
          >
            <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
            {showRecommendations ? "Ocultar recomendaciones" : "Motor de Recomendaciones de KPIs"}
          </Button>
          {showRecommendations && (
            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-yellow-500/30 bg-yellow-50/50 p-2 dark:bg-yellow-950/20">
              {KPI_RECOMMENDATIONS.map((rec, idx) => (
                <div key={idx} className="rounded-md border bg-background p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-yellow-500" />
                        <span className="text-sm font-semibold">{rec.name}</span>
                        <Badge variant="secondary" className="text-[8px]">
                          {KPI_CATEGORY_LABELS[rec.category]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{rec.description}</p>
                      <p className="mt-0.5 text-[10px] font-mono text-primary/70">{rec.formula}</p>
                      <p className="mt-1 text-[10px] italic text-muted-foreground">💡 {rec.rationale}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 shrink-0 text-[10px]"
                      onClick={() => applyRecommendation(rec)}
                    >
                      Usar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            {editing ? (
              <><Pencil className="h-4 w-4" /> Editar KPI</>
            ) : (
              <><Plus className="h-4 w-4" /> Nuevo KPI</>
            )}
          </h4>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Índice de Calidad" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as KPICategory)}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{KPI_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Unidad</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, $, pts" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dirección</Label>
                <Button variant="outline" size="sm" className="h-8 w-full text-[10px]" onClick={() => setHigherIsBetter(!higherIsBetter)}>
                  {higherIsBetter ? "↑ Mayor=Mejor" : "↓ Menor=Mejor"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción breve del KPI" className="h-8 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Variable className="h-3.5 w-3.5" /> Fórmula
            </Label>
            <Textarea value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="Ej: conversionRate * avgScore / 100" className="min-h-[50px] font-mono text-xs" />
            {formulaError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> {formulaError}
              </p>
            )}
            {formulaPreview !== null && !formulaError && (
              <p className="text-xs text-muted-foreground">
                Vista previa: <span className="font-mono font-semibold text-primary">{formulaPreview}{unit ? ` ${unit}` : ""}</span>
              </p>
            )}
          </div>

          {/* Available variables with category filter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Variables disponibles ({filteredVars.length})
              </Label>
              <div className="flex gap-1">
                <button
                  className={`rounded px-1.5 py-0.5 text-[9px] ${varFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  onClick={() => setVarFilter("all")}
                >
                  Todas
                </button>
                {CATEGORY_OPTIONS.map((c) => (
                  <button
                    key={c}
                    className={`rounded px-1.5 py-0.5 text-[9px] ${varFilter === c ? "text-white" : "bg-muted text-muted-foreground"}`}
                    style={varFilter === c ? { backgroundColor: KPI_CATEGORY_COLORS[c] } : undefined}
                    onClick={() => setVarFilter(c)}
                  >
                    {KPI_CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {filteredVars.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-[9px] transition-colors hover:bg-primary/10"
                  onClick={() => setFormula((f) => (f ? `${f} ${v.key}` : v.key))}
                  title={`${v.label}: ${v.description}`}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full mr-0.5" style={{ backgroundColor: KPI_CATEGORY_COLORS[v.category] }} />
                  {v.key}
                  <span className="ml-1 font-sans text-muted-foreground">= {SAMPLE_VARS[v.key] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {editing && (
            <Button variant="outline" size="sm" onClick={resetForm}>Cancelar edición</Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!name.trim() || !formula.trim() || !!formulaError}>
            {editing ? "Guardar cambios" : "Crear KPI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
