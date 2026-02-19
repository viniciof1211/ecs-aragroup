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
import { AlertCircle, Plus, Pencil, Trash2, Variable } from "lucide-react";
import { useKPIStore } from "@/stores/useKPIStore";
import {
  KPI_VARIABLES,
  evaluateKPIFormula,
  type CustomKPIDefinition,
} from "@/types/employee-kpi";

interface KPIEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_VARS: Record<string, number> = {
  avgScore: 45,
  responseTime: 1200,
  conversionRate: 25,
  activeLeads: 30,
  totalInteractions: 150,
};

export function KPIEditorDialog({ open, onOpenChange }: KPIEditorDialogProps) {
  const { allKPIs, addKPI, updateKPI, removeKPI, loadKPIs } =
    useKPIStore();

  const [editing, setEditing] = useState<CustomKPIDefinition | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formula, setFormula] = useState("");
  const [unit, setUnit] = useState("");
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const [formulaError, setFormulaError] = useState("");
  const [formulaPreview, setFormulaPreview] = useState<number | null>(null);

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
    setHigherIsBetter(kpi.higher_is_better);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Gestionar KPIs de Empleados
          </DialogTitle>
        </DialogHeader>

        {/* Existing KPIs list */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">
            KPIs Activos ({allDefs.length})
          </h4>
          <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-2">
            {allDefs.map((kpi) => {
              const isBuiltin = kpi.id.startsWith("builtin-");
              return (
                <div
                  key={kpi.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{kpi.name}</span>
                      {isBuiltin && (
                        <Badge variant="outline" className="text-[9px]">
                          Integrado
                        </Badge>
                      )}
                      {kpi.unit && (
                        <Badge variant="secondary" className="text-[9px]">
                          {kpi.unit}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {kpi.description}
                    </p>
                  </div>
                  {!isBuiltin && (
                    <div className="ml-2 flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(kpi)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(kpi.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            {editing ? (
              <>
                <Pencil className="h-4 w-4" /> Editar KPI
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Nuevo KPI
              </>
            )}
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Índice de Calidad"
                className="h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Unidad</Label>
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="%, pts, min"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dirección</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full text-xs"
                  onClick={() => setHigherIsBetter(!higherIsBetter)}
                >
                  {higherIsBetter ? "↑ Mayor = Mejor" : "↓ Menor = Mejor"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción breve del KPI"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Variable className="h-3.5 w-3.5" /> Fórmula
            </Label>
            <Textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="Ej: conversionRate * avgScore / 100"
              className="min-h-[60px] font-mono text-xs"
            />
            {formulaError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> {formulaError}
              </p>
            )}
            {formulaPreview !== null && !formulaError && (
              <p className="text-xs text-muted-foreground">
                Vista previa (datos de ejemplo):{" "}
                <span className="font-mono font-semibold text-primary">
                  {formulaPreview}
                  {unit ? ` ${unit}` : ""}
                </span>
              </p>
            )}
          </div>

          {/* Available variables */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Variables disponibles
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {KPI_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="rounded-md border bg-background px-2 py-1 font-mono text-[10px] transition-colors hover:bg-primary/10"
                  onClick={() =>
                    setFormula((f) => (f ? `${f} ${v.key}` : v.key))
                  }
                  title={v.description}
                >
                  {v.key}
                  <span className="ml-1 font-sans text-muted-foreground">
                    = {SAMPLE_VARS[v.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {editing && (
            <Button variant="outline" size="sm" onClick={resetForm}>
              Cancelar edición
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || !formula.trim() || !!formulaError}
          >
            {editing ? "Guardar cambios" : "Crear KPI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
