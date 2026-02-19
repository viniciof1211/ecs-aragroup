import { useState, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { INTERACTION_TYPE_LABELS } from "@/types/ecs";
import type { ECSInteraction } from "@/types/ecs";

const typeIcons: Record<string, React.ElementType> = {
  call: Phone,
  email_sent: Mail,
  email_received: Mail,
  whatsapp: MessageSquare,
  meeting: Calendar,
  note_added: FileText,
  chat: MessageSquare,
};

// ─── Note Effectiveness Analysis ───

type NoteEffectiveness = "effective" | "neutral" | "counterproductive";

interface NoteAnalysis {
  effectiveness: NoteEffectiveness;
  label: string;
  reason: string;
}

const EFFECTIVENESS_CONFIG: Record<NoteEffectiveness, { color: string; bg: string; emoji: string; label: string }> = {
  effective: { color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-800", emoji: "🟢", label: "Efectiva" },
  neutral: { color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800", emoji: "🟡", label: "Neutral" },
  counterproductive: { color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800", emoji: "🔴", label: "Contraproducente" },
};

// Positive action keywords (Spanish)
const POSITIVE_KEYWORDS = [
  "cotización", "cotizacion", "envié", "envie", "agendar", "agendé", "agenda", "cita",
  "seguimiento", "llamé", "llame", "contacté", "contacte", "visita", "reunión", "reunion",
  "presentación", "presentacion", "propuesta", "enviar", "coordinar", "confirmar",
  "interesado", "avanzar", "cerrar", "negociar", "descuento", "oferta", "demo",
  "muestra", "diseño", "plano", "presupuesto", "aprobado", "aprobación",
  "whatsapp", "respondió", "respondio", "positivo", "excelente", "buena respuesta",
];

// Negative action keywords
const NEGATIVE_KEYWORDS = [
  "no contestó", "no contesto", "no responde", "sin respuesta", "no interesado",
  "rechazó", "rechazo", "canceló", "cancelo", "perdido", "no disponible",
  "no contesta", "buzón", "buzon", "no aplica", "desistió", "desistio",
  "competencia", "ya compró", "ya compro", "no tiene presupuesto", "fuera de zona",
  "duplicado", "spam", "equivocado", "número erróneo", "numero erroneo",
];

// Neutral action keywords
const NEUTRAL_KEYWORDS = [
  "pendiente", "esperando", "en espera", "por confirmar", "revisar",
  "verificar", "consultar", "información", "informacion", "datos",
];

function analyzeNoteEffectiveness(noteText: string): NoteAnalysis {
  const lower = noteText.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;
  let neutralScore = 0;

  for (const kw of POSITIVE_KEYWORDS) {
    if (lower.includes(kw)) positiveScore++;
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    if (lower.includes(kw)) negativeScore++;
  }
  for (const kw of NEUTRAL_KEYWORDS) {
    if (lower.includes(kw)) neutralScore++;
  }

  if (positiveScore > negativeScore && positiveScore > neutralScore) {
    return {
      effectiveness: "effective",
      label: "Efectiva",
      reason: "La acción tomada impulsa el avance del lead en el embudo comercial.",
    };
  } else if (negativeScore > positiveScore) {
    return {
      effectiveness: "counterproductive",
      label: "Contraproducente",
      reason: "La nota indica un resultado negativo o pérdida de oportunidad.",
    };
  }
  return {
    effectiveness: "neutral",
    label: "Neutral",
    reason: "La acción es informativa pero no impulsa directamente la conversión.",
  };
}

function extractNoteText(interaction: ECSInteraction): string | null {
  if (interaction.type !== "note_added") return null;
  const raw = interaction.bitrix_raw;
  if (!raw) return null;
  // Try common Bitrix note fields
  const text = (raw.DESCRIPTION as string)
    || (raw.description as string)
    || (raw.COMMENT as string)
    || (raw.comment as string)
    || (raw.BODY as string)
    || (raw.body as string)
    || (raw.NOTE as string)
    || (raw.note as string)
    || (raw.SUBJECT as string)
    || (raw.subject as string)
    || (raw.text as string)
    || (raw.TEXT as string)
    || null;
  if (text && typeof text === "string" && text.trim().length > 0) return text.trim();
  // Fallback: stringify raw if it has content
  const str = JSON.stringify(raw);
  if (str.length > 10 && str.length < 500) return str;
  return null;
}

// ─── Sentiment API analysis for notes (on-demand) ───

const SENTIMENT_URL = import.meta.env.VITE_SENTIMENT_AGENT_URL ?? "https://levinnovation--ecs-sentiment-agent-ecs-sentiment-server.modal.run";

async function analyzeNoteWithAI(noteText: string, leadName: string): Promise<NoteAnalysis> {
  try {
    const res = await fetch(`${SENTIMENT_URL}/ecs/sentiment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leads: [{
          lead_id: "note-analysis",
          lead_name: leadName,
          total_conversations: 1,
          total_messages: 1,
          avg_response_time_minutes: 0,
          channels: ["nota"],
          last_interaction_summary: `Nota del asesor: ${noteText}`,
          lead_score: 50,
          lead_status: "active",
        }],
        language: "es",
        system_instructions: "Analiza la siguiente nota de un asesor comercial. Determina si la acción descrita es EFECTIVA (impulsa la venta), NEUTRAL (informativa) o CONTRAPRODUCENTE (perjudica la relación). Responde en español.",
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) throw new Error("No result");

    // Interpret sentiment result
    const action = (result.recommended_action || "").toLowerCase();
    const reasoning = result.reasoning || "";

    if (action.includes("efectiv") || action.includes("positiv") || action.includes("buena")) {
      return { effectiveness: "effective", label: "Efectiva", reason: reasoning };
    } else if (action.includes("contraproduc") || action.includes("negativ") || action.includes("riesgo") || action.includes("perjud")) {
      return { effectiveness: "counterproductive", label: "Contraproducente", reason: reasoning };
    }
    return { effectiveness: "neutral", label: "Neutral", reason: reasoning };
  } catch {
    // Fallback to local analysis
    return analyzeNoteEffectiveness(noteText);
  }
}

// ─── Component ───

interface InteractionTimelineProps {
  interactions: ECSInteraction[];
  leadName?: string;
}

export function InteractionTimeline({ interactions, leadName }: InteractionTimelineProps) {
  const [aiAnalyses, setAiAnalyses] = useState<Record<string, NoteAnalysis>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const handleAnalyzeNote = useCallback(async (interactionId: string, noteText: string) => {
    setLoadingIds((prev) => new Set(prev).add(interactionId));
    const result = await analyzeNoteWithAI(noteText, leadName ?? "Lead");
    setAiAnalyses((prev) => ({ ...prev, [interactionId]: result }));
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(interactionId);
      return next;
    });
  }, [leadName]);

  return (
    <ScrollArea className="h-[500px] pr-3">
      <div className="relative space-y-0">
        {interactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin interacciones registradas
          </p>
        ) : (
          interactions.map((interaction, idx) => {
            const Icon = typeIcons[interaction.type] || FileText;
            const label =
              INTERACTION_TYPE_LABELS[interaction.type] || interaction.type;
            const ts = new Date(interaction.timestamp);
            const noteText = extractNoteText(interaction);
            const localAnalysis = noteText ? analyzeNoteEffectiveness(noteText) : null;
            const aiAnalysis = aiAnalyses[interaction.id];
            const analysis = aiAnalysis || localAnalysis;
            const effConfig = analysis ? EFFECTIVENESS_CONFIG[analysis.effectiveness] : null;
            const isLoading = loadingIds.has(interaction.id);

            return (
              <div key={interaction.id} className="relative flex gap-4 pb-6">
                {/* Timeline line */}
                {idx < interactions.length - 1 && (
                  <div className="absolute left-[19px] top-10 h-full w-px bg-border" />
                )}

                {/* Icon */}
                <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                  <Icon className="h-4 w-4 text-primary" />
                </div>

                {/* Content */}
                <div className="flex-1 rounded-lg border border-border/50 bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      {interaction.direction !== "unknown" && (
                        interaction.direction === "entrante" ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                        )
                      )}
                      {/* Note effectiveness semaphore */}
                      {noteText && effConfig && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${effConfig.bg} ${effConfig.color}`}>
                          {effConfig.emoji} {analysis!.label}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(ts, { addSuffix: true, locale: es })}
                    </span>
                  </div>

                  {/* Note text and analysis */}
                  {noteText && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs leading-relaxed text-foreground/80 bg-muted/50 rounded-md px-2.5 py-1.5 border border-border/30">
                        {noteText}
                      </p>
                      {analysis && (
                        <p className={`text-[10px] italic ${effConfig!.color}`}>
                          {analysis.reason}
                        </p>
                      )}
                      {!aiAnalysis && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 gap-1 px-1.5 text-[9px] text-muted-foreground hover:text-primary"
                          onClick={() => handleAnalyzeNote(interaction.id, noteText)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <><Loader2 className="h-2.5 w-2.5 animate-spin" /> Analizando con IA...</>
                          ) : (
                            <><Sparkles className="h-2.5 w-2.5" /> Analizar con IA</>
                          )}
                        </Button>
                      )}
                      {aiAnalysis && (
                        <span className="text-[8px] text-muted-foreground">✓ Analizado con IA</span>
                      )}
                    </div>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {interaction.channel && (
                      <Badge variant="secondary" className="text-[10px]">
                        {interaction.channel}
                      </Badge>
                    )}
                    {interaction.duration_seconds != null && interaction.duration_seconds > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {Math.round(interaction.duration_seconds / 60)} min
                      </span>
                    )}
                    {interaction.message_count != null && interaction.message_count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {interaction.message_count} mensajes
                      </span>
                    )}
                    {interaction.employee && (
                      <span className="text-xs text-muted-foreground">
                        · {interaction.employee}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {format(ts, "dd MMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
