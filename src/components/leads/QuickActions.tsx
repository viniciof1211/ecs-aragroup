import { useState } from "react";
import { Phone, Mail, MessageSquare, Calendar, FileText, Loader2, Check, AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ECSLead } from "@/types/ecs";
import {
  sendEmail,
  sendWhatsApp,
  scheduleCall,
  addNote,
  scheduleMeeting,
  whatsappLink,
  mailtoLink,
  type BitrixActionResult,
} from "@/lib/bitrix-actions";

interface QuickActionsProps {
  lead: ECSLead;
}

type ActionType = "email" | "whatsapp" | "call" | "note" | "meeting";

interface ActionDialogState {
  type: ActionType | null;
  open: boolean;
}

const ACTION_CONFIG: Record<ActionType, { icon: typeof Mail; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "text-blue-600" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "text-green-600" },
  call: { icon: Phone, label: "Llamar", color: "text-emerald-600" },
  note: { icon: FileText, label: "Nota", color: "text-amber-600" },
  meeting: { icon: Calendar, label: "Reunión", color: "text-purple-600" },
};

export function QuickActions({ lead }: QuickActionsProps) {
  const [dialog, setDialog] = useState<ActionDialogState>({ type: null, open: false });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BitrixActionResult | null>(null);

  // Form fields
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const bitrixId = lead.bitrix_id ?? (lead.bitrix_lead_ids?.[0] || 0);

  const openDialog = (type: ActionType) => {
    setDialog({ type, open: true });
    setResult(null);
    setSending(false);
    setSubject("");
    setBody("");
    setScheduledAt("");

    // Pre-fill subject based on action type
    if (type === "email") {
      setSubject(`Seguimiento — ${lead.name}`);
      setBody(`Estimado/a ${lead.name},\n\nGracias por su interés en nuestros productos.\n\nQuedamos atentos a sus consultas.\n\nSaludos,\nEquipo ARA Group`);
    } else if (type === "whatsapp") {
      setBody(`Hola ${lead.name}, le saluda el equipo de ARA Group. ¿Cómo podemos ayudarle con su proyecto?`);
    } else if (type === "call") {
      setSubject(`Llamada de seguimiento — ${lead.name}`);
    } else if (type === "note") {
      setBody("");
    } else if (type === "meeting") {
      setSubject(`Reunión — ${lead.name}`);
      setBody("Revisión de proyecto y cotización");
    }
  };

  const executeAction = async () => {
    if (!dialog.type || !bitrixId) return;
    setSending(true);
    setResult(null);

    let res: BitrixActionResult;

    switch (dialog.type) {
      case "email":
        res = await sendEmail(bitrixId, subject, body, lead.email || "");
        break;
      case "whatsapp":
        res = await sendWhatsApp(bitrixId, lead.phone || "", body);
        break;
      case "call":
        res = await scheduleCall(bitrixId, lead.phone || "", subject, scheduledAt || undefined);
        break;
      case "note":
        res = await addNote(bitrixId, body);
        break;
      case "meeting":
        res = await scheduleMeeting(bitrixId, subject, body, scheduledAt || new Date().toISOString());
        break;
      default:
        res = { success: false, action: "note", bitrixId, message: "Acción no soportada" };
    }

    setResult(res);
    setSending(false);
  };

  const actions: { type: ActionType; disabled?: boolean }[] = [
    { type: "call", disabled: !lead.phone },
    { type: "email", disabled: !lead.email },
    { type: "whatsapp", disabled: !lead.phone },
    { type: "note" },
    { type: "meeting" },
  ];

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {actions.map(({ type, disabled }) => {
              const cfg = ACTION_CONFIG[type];
              const Icon = cfg.icon;
              return (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  className="flex h-auto flex-col gap-1 py-3"
                  disabled={disabled || !bitrixId}
                  onClick={() => openDialog(type)}
                >
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                  <span className="text-[11px]">{cfg.label}</span>
                </Button>
              );
            })}
          </div>
          {!bitrixId && (
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              Sin Bitrix ID — acciones no disponibles
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialog.type && (() => {
                const cfg = ACTION_CONFIG[dialog.type];
                const Icon = cfg.icon;
                return <><Icon className={`h-5 w-5 ${cfg.color}`} />{cfg.label} — {lead.name}</>;
              })()}
            </DialogTitle>
            <DialogDescription>
              Se registrará en Bitrix24 (Lead #{bitrixId})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Email form */}
            {dialog.type === "email" && (
              <>
                <div className="space-y-1.5">
                  <Label>Para</Label>
                  <Input value={lead.email || "Sin email"} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>Asunto</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mensaje</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
                </div>
                {lead.email && (
                  <a
                    href={mailtoLink(lead.email, subject, body)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir en cliente de correo
                  </a>
                )}
              </>
            )}

            {/* WhatsApp form */}
            {dialog.type === "whatsapp" && (
              <>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input value={lead.phone || "Sin teléfono"} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>Mensaje</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
                </div>
                {lead.phone && (
                  <a
                    href={whatsappLink(lead.phone, body)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir WhatsApp Web
                  </a>
                )}
              </>
            )}

            {/* Call form */}
            {dialog.type === "call" && (
              <>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input value={lead.phone || "Sin teléfono"} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label>Asunto</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Programar para (opcional)</Label>
                  <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </div>
              </>
            )}

            {/* Note form */}
            {dialog.type === "note" && (
              <div className="space-y-1.5">
                <Label>Nota / Comentario</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder="Escriba una nota para el timeline del lead..."
                />
              </div>
            )}

            {/* Meeting form */}
            {dialog.type === "meeting" && (
              <>
                <div className="space-y-1.5">
                  <Label>Asunto</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Descripción</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha y hora</Label>
                  <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </div>
              </>
            )}

            {/* Result feedback */}
            {result && (
              <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${result.success ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"}`}>
                {result.success ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {result.message}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ type: null, open: false })}>
              Cancelar
            </Button>
            <Button
              onClick={executeAction}
              disabled={sending || !bitrixId}
              className="gap-2 bg-[#1A4A28] hover:bg-[#2A6A3A]"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {sending ? "Enviando..." : "Ejecutar en Bitrix24"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
