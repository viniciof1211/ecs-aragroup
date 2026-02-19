import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  Send,
  Bot,
  User,
  Phone,
  Search,
  Wifi,
  WifiOff,
  Sparkles,
  ArrowUpRight,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppStore } from "@/stores/useWhatsAppStore";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type {
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppAccount,
} from "@/types/whatsapp";

// ─── Demo data (used until Modal agent is live) ───

const DEMO_ACCOUNTS: WhatsAppAccount[] = [
  {
    id: "acc-1",
    label: "Atención al Cliente",
    phone: "+506 8888-0001",
    type: "business",
    webhook_url: "",
    ai_enabled: true,
    status: "connected",
    created_at: new Date().toISOString(),
  },
];

function makeDemoConversations(): WhatsAppConversation[] {
  const now = Date.now();
  return [
    {
      id: "conv-1",
      account_id: "acc-1",
      lead_id: "lead-101",
      lead_name: "María López",
      lead_phone: "+506 7777-1001",
      last_message: "Hola, quisiera información sobre cocinas integrales",
      last_message_at: new Date(now - 120_000).toISOString(),
      unread_count: 2,
      ai_handling: true,
      status: "active",
      assigned_to: null,
      created_at: new Date(now - 3_600_000).toISOString(),
      messages: [
        {
          id: "m1",
          conversation_id: "conv-1",
          account_id: "acc-1",
          direction: "inbound",
          sender_type: "lead",
          body: "Hola, buenas tardes! Vi su publicación en Facebook sobre cocinas integrales.",
          timestamp: new Date(now - 3_600_000).toISOString(),
          status: "read",
        },
        {
          id: "m2",
          conversation_id: "conv-1",
          account_id: "acc-1",
          direction: "outbound",
          sender_type: "agent",
          body: "¡Hola María! Bienvenida a ARA Group. Con gusto le ayudo con información sobre nuestras cocinas integrales. ¿Tiene algún estilo o presupuesto en mente?",
          timestamp: new Date(now - 3_540_000).toISOString(),
          status: "read",
          ai_sentiment: "positive",
          ai_confidence: 0.92,
        },
        {
          id: "m3",
          conversation_id: "conv-1",
          account_id: "acc-1",
          direction: "inbound",
          sender_type: "lead",
          body: "Sí, estoy buscando algo moderno, en tonos blancos. Mi presupuesto es de unos $5,000.",
          timestamp: new Date(now - 3_000_000).toISOString(),
          status: "read",
        },
        {
          id: "m4",
          conversation_id: "conv-1",
          account_id: "acc-1",
          direction: "outbound",
          sender_type: "agent",
          body: "Excelente elección. Tenemos varias opciones en ese rango. Le comparto nuestro catálogo de cocinas modernas en blanco. ¿Le gustaría agendar una visita a nuestro showroom para ver los materiales en persona?",
          timestamp: new Date(now - 2_940_000).toISOString(),
          status: "read",
          ai_sentiment: "positive",
          ai_confidence: 0.95,
        },
        {
          id: "m5",
          conversation_id: "conv-1",
          account_id: "acc-1",
          direction: "inbound",
          sender_type: "lead",
          body: "Hola, quisiera información sobre cocinas integrales",
          timestamp: new Date(now - 120_000).toISOString(),
          status: "delivered",
        },
      ],
    },
    {
      id: "conv-2",
      account_id: "acc-1",
      lead_id: "lead-205",
      lead_name: "Carlos Rodríguez",
      lead_phone: "+506 7777-2002",
      last_message: "¿Cuánto tarda la instalación?",
      last_message_at: new Date(now - 900_000).toISOString(),
      unread_count: 1,
      ai_handling: true,
      status: "active",
      assigned_to: null,
      created_at: new Date(now - 86_400_000).toISOString(),
      messages: [
        {
          id: "m10",
          conversation_id: "conv-2",
          account_id: "acc-1",
          direction: "inbound",
          sender_type: "lead",
          body: "Buenos días, ya recibí la cotización. ¿Cuánto tarda la instalación?",
          timestamp: new Date(now - 900_000).toISOString(),
          status: "delivered",
        },
      ],
    },
    {
      id: "conv-3",
      account_id: "acc-1",
      lead_id: null,
      lead_name: "Ana Mora",
      lead_phone: "+506 7777-3003",
      last_message: "Gracias por la información, lo voy a pensar.",
      last_message_at: new Date(now - 7_200_000).toISOString(),
      unread_count: 0,
      ai_handling: false,
      status: "resolved",
      assigned_to: "Vendedor 1",
      created_at: new Date(now - 172_800_000).toISOString(),
      messages: [
        {
          id: "m20",
          conversation_id: "conv-3",
          account_id: "acc-1",
          direction: "inbound",
          sender_type: "lead",
          body: "Gracias por la información, lo voy a pensar.",
          timestamp: new Date(now - 7_200_000).toISOString(),
          status: "read",
        },
      ],
    },
  ];
}

// ─── Sub-components ───

function MessageStatusIcon({ status }: { status: WhatsAppMessage["status"] }) {
  switch (status) {
    case "read":
      return <CheckCheck className="h-3 w-3 text-blue-400" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case "sent":
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case "failed":
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
}

function ConversationStatusBadge({ conv }: { conv: WhatsAppConversation }) {
  const variants: Record<string, string> = {
    active: "bg-green-500/15 text-green-700 border-green-500/30",
    waiting: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
    resolved: "bg-gray-500/15 text-gray-600 border-gray-500/30",
    escalated: "bg-red-500/15 text-red-700 border-red-500/30",
  };
  const labels: Record<string, string> = {
    active: "Activa",
    waiting: "Esperando",
    resolved: "Resuelta",
    escalated: "Escalada",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
        variants[conv.status] ?? variants.active
      )}
    >
      {labels[conv.status] ?? conv.status}
    </span>
  );
}

function ConversationListItem({
  conv,
  isActive,
  onClick,
}: {
  conv: WhatsAppConversation;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        isActive
          ? "border-primary/40 bg-primary/5"
          : "border-transparent hover:bg-muted/50"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold">
        {conv.lead_name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-sm font-semibold">{conv.lead_name}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(conv.last_message_at), {
              addSuffix: false,
              locale: es,
            })}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{conv.last_message}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <ConversationStatusBadge conv={conv} />
          {conv.ai_handling && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-purple-600">
              <Bot className="h-2.5 w-2.5" /> IA
            </span>
          )}
          {conv.unread_count > 0 && (
            <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ msg }: { msg: WhatsAppMessage }) {
  const isOutbound = msg.direction === "outbound";
  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          isOutbound
            ? "rounded-br-md bg-green-600 text-white"
            : "rounded-bl-md bg-muted text-foreground"
        )}
      >
        {isOutbound && msg.sender_type === "agent" && (
          <div className="mb-0.5 flex items-center gap-1 text-[9px] text-green-200">
            <Bot className="h-2.5 w-2.5" /> Agente IA
          </div>
        )}
        {isOutbound && msg.sender_type === "human" && (
          <div className="mb-0.5 flex items-center gap-1 text-[9px] text-green-200">
            <User className="h-2.5 w-2.5" /> Operador
          </div>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[9px]",
            isOutbound ? "text-green-200" : "text-muted-foreground"
          )}
        >
          <span>
            {new Date(msg.timestamp).toLocaleTimeString("es-CR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isOutbound && <MessageStatusIcon status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function WhatsAppManager() {
  const {
    accounts,
    conversations,
    activeConversationId,
    setAccounts,
    setConversations,
    setActiveConversation,
    addMessage,
  } = useWhatsAppStore();

  const [search, setSearch] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [agentOnline, setAgentOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load demo data on mount
  useEffect(() => {
    setAccounts(DEMO_ACCOUNTS);
    setConversations(makeDemoConversations());
    // Simulate agent health check
    setAgentOnline(true);
  }, [setAccounts, setConversations]);

  // Auto-scroll to bottom when messages change
  const activeConv = conversations.find((c) => c.id === activeConversationId);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length]);

  const filteredConversations = conversations.filter(
    (c) =>
      !search ||
      c.lead_name.toLowerCase().includes(search.toLowerCase()) ||
      c.lead_phone.includes(search)
  );

  const handleSend = useCallback(() => {
    if (!messageInput.trim() || !activeConversationId) return;
    const msg: WhatsAppMessage = {
      id: `msg-${Date.now()}`,
      conversation_id: activeConversationId,
      account_id: activeConv?.account_id ?? "acc-1",
      direction: "outbound",
      sender_type: "human",
      body: messageInput.trim(),
      timestamp: new Date().toISOString(),
      status: "sent",
    };
    addMessage(activeConversationId, msg);
    setMessageInput("");

    // Simulate AI auto-reply after 2s if AI is handling
    if (activeConv?.ai_handling) {
      setTimeout(() => {
        const aiReply: WhatsAppMessage = {
          id: `msg-ai-${Date.now()}`,
          conversation_id: activeConversationId,
          account_id: activeConv.account_id,
          direction: "inbound",
          sender_type: "lead",
          body: "Perfecto, muchas gracias por la información. ¿Tienen disponibilidad esta semana para una visita?",
          timestamp: new Date().toISOString(),
          status: "delivered",
        };
        addMessage(activeConversationId, aiReply);
      }, 2000);
    }
  }, [messageInput, activeConversationId, activeConv, addMessage]);

  const activeAccount = accounts[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-600" />
            WhatsApp Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión de conversaciones con agente IA integrado
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeAccount && (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
              <Phone className="h-3.5 w-3.5 text-green-600" />
              <span className="font-medium">{activeAccount.label}</span>
              <span className="text-muted-foreground">{activeAccount.phone}</span>
              {activeAccount.status === "connected" ? (
                <Wifi className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-destructive" />
              )}
            </div>
          )}
          <Badge
            variant="outline"
            className={cn(
              "gap-1",
              agentOnline
                ? "border-green-500/40 text-green-700"
                : "border-red-500/40 text-red-700"
            )}
          >
            <Bot className="h-3 w-3" />
            Agente IA {agentOnline ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </div>

      {/* Main layout: conversation list + chat */}
      <div className="grid grid-cols-[340px_1fr] gap-4" style={{ height: "calc(100vh - 12rem)" }}>
        {/* Left: Conversation list */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 border-b px-3 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar conversación..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              {filteredConversations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay conversaciones
                </p>
              ) : (
                filteredConversations.map((conv) => (
                  <ConversationListItem
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeConversationId}
                    onClick={() => setActiveConversation(conv.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
          <div className="shrink-0 border-t px-3 py-2 text-center text-[10px] text-muted-foreground">
            {conversations.length} conversaciones · {conversations.filter((c) => c.unread_count > 0).length} sin leer
          </div>
        </Card>

        {/* Right: Chat view */}
        <Card className="flex flex-col overflow-hidden">
          {!activeConv ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageCircle className="h-12 w-12 opacity-30" />
              <p className="text-sm">Selecciona una conversación para comenzar</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <CardHeader className="shrink-0 border-b px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold">
                      {activeConv.lead_name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        {activeConv.lead_name}
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground">
                        {activeConv.lead_phone}
                        {activeConv.lead_id && (
                          <span className="ml-2 text-primary">
                            Lead #{activeConv.lead_id.replace("lead-", "")}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ConversationStatusBadge conv={activeConv} />
                    <Button
                      size="sm"
                      variant={activeConv.ai_handling ? "default" : "outline"}
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        useWhatsAppStore.getState().updateConversation(activeConv.id, {
                          ai_handling: !activeConv.ai_handling,
                        });
                      }}
                    >
                      <Sparkles className="h-3 w-3" />
                      {activeConv.ai_handling ? "IA Activa" : "Activar IA"}
                    </Button>
                    {activeConv.lead_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs"
                        onClick={() => window.open(`/leads/${activeConv.lead_id}`, "_blank")}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                        Ver Lead
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-3">
                  {activeConv.messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="shrink-0 border-t p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!messageInput.trim()}
                    className="h-9 w-9 shrink-0 bg-green-600 hover:bg-green-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                <p className="mt-1.5 text-center text-[9px] text-muted-foreground">
                  {activeConv.ai_handling
                    ? "🤖 El agente IA responde automáticamente · Escribe para intervenir manualmente"
                    : "Modo manual · Activa la IA para respuestas automáticas"}
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
