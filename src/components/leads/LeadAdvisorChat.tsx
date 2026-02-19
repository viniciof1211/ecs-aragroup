/**
 * Per-lead AI Chat Widget (Cascade-style).
 * A small floating chat window that provides conversion advice
 * specific to each lead — how to capture, convert to deal,
 * close, and retain the customer.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Loader2, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ECSLead, ECSInteraction, SentimentResult } from "@/types/ecs";
import { getSegmentConfig, getSegmentFromScore, STATUS_LABELS, CHANNEL_LABELS } from "@/types/ecs";

const SENTIMENT_URL =
  import.meta.env.VITE_SENTIMENT_AGENT_URL ??
  "https://levinnovation--ecs-sentiment-agent-ecs-sentiment-server.modal.run";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface LeadAdvisorChatProps {
  lead: ECSLead;
  interactions: ECSInteraction[];
  sentimentResult?: SentimentResult | null;
}

function buildLeadContext(
  lead: ECSLead,
  interactions: ECSInteraction[],
  sentimentResult?: SentimentResult | null
): string {
  const seg = getSegmentConfig(lead.segment || getSegmentFromScore(lead.current_score));
  const channels = (lead.channels ?? []).map((c) => CHANNEL_LABELS[c] || c).join(", ");
  const status = STATUS_LABELS[lead.status] || lead.status;

  let ctx = `CONTEXTO DEL LEAD:
- Nombre: ${lead.name}
- Estado: ${status}
- Segmento ECS: ${seg.label} (Score: ${lead.current_score}/100)
- Canales: ${channels || "Sin canales"}
- Interacciones: ${lead.interaction_count}
- Primera vez: ${lead.first_seen || "Desconocido"}
- Último contacto: ${lead.last_seen || "Desconocido"}`;

  if (lead.budget_range) ctx += `\n- Presupuesto: ${lead.budget_range}`;
  if (lead.total_amount) ctx += `\n- Monto: $${lead.total_amount.toLocaleString("es-CR")} ${lead.currency || ""}`;
  if (lead.project_type) ctx += `\n- Tipo proyecto: ${lead.project_type}`;
  if (lead.designing) ctx += `\n- Diseñando: ${lead.designing}`;
  if (lead.product_sold) ctx += `\n- Producto: ${lead.product_sold}`;
  if (lead.loss_reason_raw) ctx += `\n- Razón de pérdida: ${lead.loss_reason_raw}`;
  if (lead.etapa_bitrix) ctx += `\n- Etapa Bitrix: ${lead.etapa_bitrix}`;
  if (lead.division) ctx += `\n- División: ${lead.division}`;
  if (lead.sucursal) ctx += `\n- Sucursal: ${lead.sucursal}`;

  if (sentimentResult) {
    ctx += `\n\nANÁLISIS DE SENTIMIENTO IA:
- Score: ${sentimentResult.sentiment_score.toFixed(2)}
- Label: ${sentimentResult.sentiment_label}
- Calidad engagement: ${sentimentResult.engagement_quality}
- Bonus ECS: ${sentimentResult.ecs_sentiment_bonus.toFixed(1)}
- Señales de intención: ${sentimentResult.intent_signals.join(", ") || "Ninguna"}
- Riesgos: ${sentimentResult.risk_flags.join(", ") || "Ninguno"}
- Acción recomendada: ${sentimentResult.recommended_action}`;
  }

  if (interactions.length > 0) {
    const recent = interactions.slice(0, 5);
    ctx += `\n\nÚLTIMAS INTERACCIONES:`;
    for (const i of recent) {
      ctx += `\n- ${i.type} (${i.channel}) — ${i.timestamp || "sin fecha"}`;
      if (i.employee) ctx += ` [${i.employee}]`;
    }
  }

  return ctx;
}

const SYSTEM_PROMPT = `Eres un asesor comercial experto de ARA Group Costa Rica, especializado en cocinas, closets y muebles de diseño.
Tu rol es ayudar al equipo comercial a convertir leads en clientes.
SIEMPRE responde en ESPAÑOL.
Sé conciso, práctico y orientado a la acción.
Basa tus recomendaciones en el contexto del lead proporcionado.
Enfócate en:
1. Cómo captar la atención del lead
2. Cómo convertirlo en deal/prospecto
3. Cómo cerrar la venta
4. Cómo fidelizarlo después de la compra
Usa emojis estratégicamente para hacer el mensaje más visual.`;

async function callAdvisorAPI(
  messages: { role: string; content: string }[],
  signal?: AbortSignal
): Promise<string> {
  try {
    const res = await fetch(`${SENTIMENT_URL}/ecs/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        system_prompt: SYSTEM_PROMPT,
        max_tokens: 500,
      }),
      signal,
    });

    if (res.ok) {
      const data = await res.json();
      return data.response || data.content || data.message || "Sin respuesta del agente.";
    }
  } catch {
    // Fallback to local advice generation
  }

  // Fallback: generate advice locally based on lead context
  return generateLocalAdvice(messages);
}

function generateLocalAdvice(messages: { role: string; content: string }[]): string {
  const lastUser = messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const context = messages.find((m) => m.role === "system")?.content ?? "";

  // Extract key info from context
  const scoreMatch = context.match(/Score: (\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
  const statusMatch = context.match(/Estado: (.+)/);
  const status = statusMatch ? statusMatch[1].trim() : "";
  const lossMatch = context.match(/Razón de pérdida: (.+)/);
  const lossReason = lossMatch ? lossMatch[1].trim() : "";

  if (lastUser.toLowerCase().includes("captar") || lastUser.toLowerCase().includes("atraer")) {
    return `🎯 **Estrategia de captación:**

1. **Contacto inmediato** — Responder dentro de las primeras 2 horas
2. **Personalizar** — Mencionar el proyecto específico del cliente
3. **Valor agregado** — Ofrecer una consulta de diseño gratuita
4. **Multi-canal** — Si no responde por un canal, intentar por otro

💡 *Tip: Los leads que reciben contacto en las primeras 24h tienen 7x más probabilidad de conversión.*`;
  }

  if (lastUser.toLowerCase().includes("cerrar") || lastUser.toLowerCase().includes("close")) {
    return `🤝 **Estrategia de cierre:**

1. **Urgencia** — Crear sentido de urgencia con promociones limitadas
2. **Social proof** — Mostrar proyectos similares completados
3. **Facilidades** — Ofrecer opciones de financiamiento
4. **Visita showroom** — Invitar a ver materiales en persona
5. **Seguimiento** — Llamar dentro de 48h para resolver dudas

💡 *Tip: El 80% de las ventas se cierran después del 5to seguimiento.*`;
  }

  if (lossReason) {
    return `⚠️ **Recuperación de lead perdido (${lossReason}):**

1. **Re-engagement** — Contactar con una oferta especial personalizada
2. **Escuchar** — Preguntar qué cambiaría su decisión
3. **Alternativas** — Ofrecer opciones que resuelvan la objeción original
4. **Timing** — Esperar 30-60 días antes de re-contactar
5. **Valor** — Enviar contenido educativo sobre tendencias de diseño

💡 *Tip: El 35% de los leads "perdidos" pueden reactivarse con el enfoque correcto.*`;
  }

  if (score < 20) {
    return `❄️ **Lead frío (Score: ${score}) — Plan de reactivación:**

1. **Email nurturing** — Serie de 3 emails con contenido de valor
2. **Retargeting** — Activar campañas de remarketing
3. **Contenido** — Compartir casos de éxito y tendencias
4. **Evento** — Invitar a eventos o webinars de diseño
5. **Descuento** — Ofrecer incentivo especial por tiempo limitado

⏰ *Prioridad: Baja — Enfocarse en leads más calientes primero.*`;
  }

  if (score >= 60) {
    return `🔥 **Lead caliente (Score: ${score}) — Acción inmediata:**

1. **Llamar HOY** — No dejar pasar más de 24h
2. **Cotización** — Preparar propuesta personalizada
3. **Showroom** — Agendar visita presencial
4. **Decision maker** — Asegurar que hablamos con quien decide
5. **Cierre** — Proponer fecha de inicio del proyecto

⚡ *Prioridad: ALTA — Este lead tiene alta probabilidad de conversión.*`;
  }

  return `📋 **Recomendaciones para este lead (Score: ${score}, ${status}):**

1. **Seguimiento** — Programar contacto dentro de las próximas 48h
2. **Calificación** — Confirmar presupuesto, timeline y necesidades
3. **Propuesta** — Preparar cotización si hay interés confirmado
4. **Multi-canal** — Usar WhatsApp + llamada + email
5. **CRM** — Actualizar notas en Bitrix24 después de cada contacto

💡 *Tip: Mantener contacto regular cada 3-5 días hasta obtener respuesta definitiva.*`;
}

export function LeadAdvisorChat({ lead, interactions, sentimentResult }: LeadAdvisorChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const leadContext = buildLeadContext(lead, interactions, sentimentResult);
  const leadContextRef = useRef(leadContext);
  leadContextRef.current = leadContext;

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const seg = getSegmentConfig(lead.segment || getSegmentFromScore(lead.current_score));
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `¡Hola! 👋 Soy tu asesor IA para **${lead.name}** (${seg.icon} ${seg.label}, Score: ${lead.current_score}).

¿En qué te puedo ayudar?
- 🎯 ¿Cómo captar este lead?
- 🤝 ¿Cómo cerrar la venta?
- 📈 ¿Cómo mejorar el engagement?
- 🔄 ¿Cómo recuperar un lead perdido?

Pregúntame lo que necesites sobre este cliente.`,
        timestamp: new Date(),
      }]);
    }
  }, [isOpen, messages.length, lead]);

  // Core send function that accepts explicit text (fixes stale closure in quick actions)
  const doSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const currentMessages = messagesRef.current;
      const apiMessages = [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${leadContextRef.current}` },
        ...currentMessages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text.trim() },
      ];

      const response = await callAdvisorAPI(apiMessages, AbortSignal.timeout(30000));

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "⚠️ Error al obtener respuesta. Intenta de nuevo.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleSendInput = useCallback(() => {
    doSend(input);
  }, [input, doSend]);

  const quickActions = [
    "¿Cómo captar este lead?",
    "¿Cómo cerrar la venta?",
    "¿Qué seguimiento hacer?",
    "¿Cómo mejorar el score?",
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] h-14 w-14 rounded-full bg-[#1A4A28] shadow-lg hover:bg-[#2A6A3A] hover:scale-110 transition-transform"
        size="icon"
        title="Asesor IA"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 z-[9999] flex h-[520px] w-[400px] flex-col shadow-2xl border-2 border-[#1A4A28]/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-[#1A4A28] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-300" />
          <div>
            <p className="text-sm font-bold text-white">Asesor IA</p>
            <p className="text-[10px] text-emerald-200 truncate max-w-[220px]">
              {lead.name} — Score: {lead.current_score}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-white/20"
            onClick={() => setIsOpen(false)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-white/20"
            onClick={() => {
              setIsOpen(false);
              setMessages([]);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages — use native overflow instead of ScrollArea for reliability */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="space-y-3 p-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-[#1A4A28] text-white rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {msg.content.split(/(\*\*.*?\*\*)/).map((part, i) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={i}>{part.slice(2, -2)}</strong>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm rounded-bl-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-muted-foreground">Pensando...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions — direct doSend call fixes stale closure */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1 border-t px-3 py-2 shrink-0">
          {quickActions.map((action) => (
            <button
              key={action}
              disabled={isLoading}
              onClick={() => doSend(action)}
              className="rounded-full border border-[#1A4A28]/30 bg-[#1A4A28]/5 px-2.5 py-1 text-[11px] font-medium text-[#1A4A28] transition-colors hover:bg-[#1A4A28]/10 disabled:opacity-50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/30"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 border-t p-3 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendInput();
            }
          }}
          placeholder="Pregunta sobre este lead..."
          className="flex-1 rounded-full border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1A4A28]/30"
          disabled={isLoading}
        />
        <Button
          onClick={handleSendInput}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full bg-[#1A4A28] hover:bg-[#2A6A3A]"
        >
          <Send className="h-4 w-4 text-white" />
        </Button>
      </div>
    </Card>
  );
}
