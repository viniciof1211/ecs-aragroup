import { useState } from "react";
import {
  Zap,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AutomationRule,
  AutomationExecution,
  RuleConditionType,
  RuleActionType,
} from "@/types/ecs";

const CONDITION_LABELS: Record<RuleConditionType, string> = {
  score_above: "Puntaje mayor a",
  score_below: "Puntaje menor a",
  score_drop_by: "Caída de puntaje por",
  score_rise_by: "Subida de puntaje por",
  segment_change: "Cambio de segmento",
  no_interaction_days: "Sin interacción por (días)",
  channel_inactive: "Canal inactivo",
};

const ACTION_LABELS: Record<RuleActionType, string> = {
  send_email: "Enviar email",
  send_whatsapp: "Enviar WhatsApp",
  assign_agent: "Asignar agente",
  create_task: "Crear tarea",
  notify_sales: "Notificar ventas",
  move_segment: "Mover segmento",
  schedule_call: "Programar llamada",
  add_tag: "Agregar etiqueta",
};

const TEMPLATES: Omit<AutomationRule, "id" | "triggerCount" | "lastTriggered" | "createdAt">[] = [
  {
    name: "Alerta Lead Caliente",
    description: "Notificar cuando un lead alcanza puntaje 80+",
    active: true,
    conditions: [{ type: "score_above", value: 80 }],
    actions: [{ type: "notify_sales", params: {} }],
  },
  {
    name: "Reactivación Fríos",
    description: "Enviar WhatsApp cuando un lead no interactúa en 14 días",
    active: true,
    conditions: [{ type: "no_interaction_days", value: 14 }],
    actions: [{ type: "send_whatsapp", params: {} }],
  },
  {
    name: "Alerta Caída de Puntaje",
    description: "Notificar cuando un lead cae más de 15 puntos",
    active: true,
    conditions: [{ type: "score_drop_by", value: 15 }],
    actions: [{ type: "notify_sales", params: {} }, { type: "schedule_call", params: {} }],
  },
];

export default function Automation() {
  const [rules, setRules] = useState<AutomationRule[]>(() =>
    TEMPLATES.map((t, i) => ({
      ...t,
      id: `rule-${i + 1}`,
      triggerCount: Math.floor(Math.random() * 50),
      lastTriggered: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
      createdAt: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    }))
  );

  const [executions] = useState<AutomationExecution[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: `exec-${i + 1}`,
      ruleId: `rule-${(i % 3) + 1}`,
      ruleName: TEMPLATES[i % 3].name,
      leadId: `bx-lead-${1000 + i}`,
      leadName: `Lead ${1000 + i}`,
      action: Object.values(ACTION_LABELS)[i % Object.keys(ACTION_LABELS).length],
      result: Math.random() > 0.1 ? "success" as const : "failure" as const,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      details: "Ejecutado correctamente",
    }))
  );

  // New rule builder state
  const [newRuleName, setNewRuleName] = useState("");
  const [newCondition, setNewCondition] = useState<RuleConditionType>("score_above");
  const [newConditionValue, setNewConditionValue] = useState("80");
  const [newAction, setNewAction] = useState<RuleActionType>("notify_sales");

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const addRule = () => {
    if (!newRuleName.trim()) return;
    const rule: AutomationRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName,
      description: `${CONDITION_LABELS[newCondition]} ${newConditionValue} → ${ACTION_LABELS[newAction]}`,
      active: true,
      conditions: [{ type: newCondition, value: Number(newConditionValue) || newConditionValue }],
      actions: [{ type: newAction, params: {} }],
      triggerCount: 0,
      lastTriggered: null,
      createdAt: new Date().toISOString(),
    };
    setRules((prev) => [...prev, rule]);
    setNewRuleName("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Automatización</h1>
        <p className="text-sm text-muted-foreground">
          Reglas automáticas para gestión de leads
        </p>
      </div>

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="rules">Reglas Activas</TabsTrigger>
          <TabsTrigger value="builder">Crear Regla</TabsTrigger>
          <TabsTrigger value="log">Historial</TabsTrigger>
        </TabsList>

        {/* Active Rules */}
        <TabsContent value="rules">
          <div className="space-y-3">
            {rules.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
                  No hay reglas configuradas
                </CardContent>
              </Card>
            ) : (
              rules.map((rule) => (
                <Card key={rule.id} className="shadow-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <button onClick={() => toggleRule(rule.id)} className="text-muted-foreground hover:text-foreground">
                        {rule.active ? (
                          <ToggleRight className="h-6 w-6 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="h-6 w-6" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-500" />
                          <span className="font-medium">{rule.name}</span>
                          {!rule.active && (
                            <Badge variant="secondary" className="text-[10px]">
                              Inactiva
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {rule.description}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Play className="h-3 w-3" />
                            {rule.triggerCount} ejecuciones
                          </span>
                          {rule.lastTriggered && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Última: {new Date(rule.lastTriggered).toLocaleDateString("es-CR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRule(rule.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Rule Builder */}
        <TabsContent value="builder">
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg">
                Crear Nueva Regla
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nombre de la Regla</Label>
                <Input
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="Ej: Alerta Lead Caliente"
                />
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <h4 className="text-sm font-semibold">SI (Condición)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={newCondition}
                      onValueChange={(v) => setNewCondition(v as RuleConditionType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Valor</Label>
                    <Input
                      value={newConditionValue}
                      onChange={(e) => setNewConditionValue(e.target.value)}
                      placeholder="80"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <h4 className="text-sm font-semibold">ENTONCES (Acción)</h4>
                <div>
                  <Label className="text-xs">Acción</Label>
                  <Select
                    value={newAction}
                    onValueChange={(v) => setNewAction(v as RuleActionType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={addRule} disabled={!newRuleName.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Regla
              </Button>

              {/* Templates */}
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-semibold text-muted-foreground">
                  Plantillas Predefinidas
                </h4>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  {TEMPLATES.map((t, i) => (
                    <button
                      key={i}
                      className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
                      onClick={() => {
                        setNewRuleName(t.name);
                        if (t.conditions[0]) {
                          setNewCondition(t.conditions[0].type);
                          setNewConditionValue(String(t.conditions[0].value));
                        }
                        if (t.actions[0]) {
                          setNewAction(t.actions[0].type);
                        }
                      }}
                    >
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Execution Log */}
        <TabsContent value="log">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg">
                Historial de Ejecuciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Regla</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((exec) => (
                      <TableRow key={exec.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(exec.timestamp).toLocaleString("es-CR")}
                        </TableCell>
                        <TableCell className="font-medium">{exec.ruleName}</TableCell>
                        <TableCell>{exec.leadName}</TableCell>
                        <TableCell className="text-sm">{exec.action}</TableCell>
                        <TableCell>
                          <Badge
                            variant={exec.result === "success" ? "default" : "destructive"}
                          >
                            {exec.result === "success" ? "Éxito" : "Error"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
