/**
 * Global AI Advisor Chat — available on every page.
 * Provides general commercial advice, Meta Ads insights, and lead strategy.
 * When on a lead profile page, the per-lead LeadAdvisorChat takes over instead.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Send, X, Loader2, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useMetaAdsStore } from "@/stores/useMetaAdsStore";
import { useLeads } from "@/hooks/useLeads";
import {
  isFallbackActive,
  activateFallback,
  fallbackChatCompletion,
} from "@/lib/openrouter-fallback";

const SENTIMENT_URL =
  import.meta.env.VITE_SENTIMENT_AGENT_URL ??
  "https://levinnovation--ecs-sentiment-agent-ecs-sentiment-server.modal.run";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

const SYSTEM_PROMPT = `Eres un asesor comercial IA experto de ARA Group Costa Rica, especializado en cocinas, closets y muebles de diseño.
Tu rol es ayudar al equipo comercial con estrategia, análisis de datos, y recomendaciones.
SIEMPRE responde en ESPAÑOL.
Sé conciso, práctico y orientado a la acción.
Puedes ayudar con:
1. Estrategia comercial y de ventas
2. Análisis de campañas de Meta Ads
3. Interpretación de métricas y KPIs
4. Recomendaciones para mejorar conversiones
5. Consejos sobre leads específicos
6. Optimización de presupuesto publicitario
Usa emojis estratégicamente para hacer el mensaje más visual.`;

function buildGlobalContext(
  leadCount: number,
  metaAggregates: ReturnType<typeof useMetaAdsStore.getState>["aggregates"],
  campaignCount: number,
  adCount: number
): string {
  let ctx = `CONTEXTO GENERAL DEL NEGOCIO:
- Total de leads en el sistema: ${leadCount}
- Campañas Meta Ads activas: ${campaignCount}
- Anuncios activos: ${adCount}`;

  if (metaAggregates) {
    ctx += `\n\nMÉTRICAS META ADS:
- Inversión total: $${metaAggregates.total_spend.toLocaleString("es-CR")}
- Impresiones: ${metaAggregates.total_impressions.toLocaleString("es-CR")}
- Alcance: ${metaAggregates.total_reach.toLocaleString("es-CR")}
- Clicks: ${metaAggregates.total_clicks.toLocaleString("es-CR")}
- Leads generados: ${metaAggregates.total_leads}
- Conversiones: ${metaAggregates.total_conversions}
- CTR promedio: ${metaAggregates.avg_ctr.toFixed(2)}%
- CPL promedio: $${metaAggregates.avg_cpl.toFixed(2)}
- CPC promedio: $${metaAggregates.avg_cpc.toFixed(2)}
- ROAS: ${metaAggregates.roas.toFixed(2)}
- Mejor campaña: ${metaAggregates.best_performing_campaign ?? "N/A"}
- Mejor tipo de post: ${metaAggregates.best_post_type ?? "N/A"}`;
  }

  return ctx;
}

async function callGlobalAdvisorAPI(
  messages: { role: string; content: string }[],
  signal?: AbortSignal
): Promise<string> {
  if (!isFallbackActive()) {
    try {
      const res = await fetch(`${SENTIMENT_URL}/ecs/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          system_prompt: SYSTEM_PROMPT,
          max_tokens: 600,
        }),
        signal,
      });

      if (res.ok) {
        const data = await res.json();
        return data.response || data.content || data.message || "Sin respuesta del agente.";
      }

      const errorText = await res.text().catch(() => "");
      const isCreditsError =
        res.status === 402 || res.status === 429 ||
        errorText.includes("credit") || errorText.includes("quota");
      if (isCreditsError || res.status >= 500) {
        activateFallback();
      }
    } catch {
      activateFallback();
    }
  }

  try {
    return await fallbackChatCompletion(messages, SYSTEM_PROMPT, signal);
  } catch {
    // All models failed
  }

  return `📊 **Resumen rápido:**
- Revisa las métricas de Meta Ads en la pestaña de Analytics → Diagnóstico
- Consulta el estado de tus leads en el Dashboard
- Usa los filtros de tiempo para comparar períodos

💡 *El agente IA no está disponible en este momento. Intenta de nuevo en unos minutos.*`;
}

export function GlobalAdvisorChat() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const { data: leads = [] } = useLeads();
  const aggregates = useMetaAdsStore((s) => s.aggregates);
  const campaigns = useMetaAdsStore((s) => s.campaigns);
  const ads = useMetaAdsStore((s) => s.ads);

  const globalContext = buildGlobalContext(
    leads.length,
    aggregates,
    campaigns.filter((c) => c.status === "ACTIVE").length,
    ads.filter((a) => a.status === "ACTIVE").length
  );
  const globalContextRef = useRef(globalContext);
  globalContextRef.current = globalContext;

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `¡Hola! 👋 Soy tu **Asesor Comercial IA** de ARA Group.

Puedo ayudarte con:
- 📊 Análisis de campañas Meta Ads
- 🎯 Estrategia de leads y conversiones
- 📈 Interpretación de métricas y KPIs
- 💡 Recomendaciones de optimización

¿En qué te puedo ayudar hoy?`,
        timestamp: new Date(),
      }]);
    }
  }, [isOpen, messages.length]);

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
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${globalContextRef.current}` },
        ...currentMessages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text.trim() },
      ];

      const response = await callGlobalAdvisorAPI(apiMessages, AbortSignal.timeout(30000));

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

  // Hide on lead profile pages (per-lead chat takes over)
  const isLeadProfilePage = /^\/leads\/[^/]+$/.test(location.pathname);
  if (isLeadProfilePage) return null;

  const quickActions = [
    "¿Cómo van las campañas de Meta?",
    "¿Qué leads debo priorizar?",
    "¿Cómo mejorar el CTR?",
    "Resumen del pipeline",
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
            <p className="text-sm font-bold text-white">Asesor Comercial IA</p>
            <p className="text-[10px] text-emerald-200">
              ARA Group — Estrategia & Analytics
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
            onClick={() => { setIsOpen(false); setMessages([]); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
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

      {/* Quick actions */}
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
          placeholder="Pregunta sobre ventas, ads, leads..."
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
