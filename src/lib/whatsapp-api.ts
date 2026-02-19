/**
 * WhatsApp Manager API layer.
 * Communicates with the Modal WhatsApp agent service and manages
 * local conversation state. Also syncs interactions to Bitrix.
 */
import type {
  WhatsAppAccount,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppSendPayload,
  WhatsAppAgentConfig,
} from "@/types/whatsapp";

const WA_AGENT_URL =
  import.meta.env.VITE_WHATSAPP_AGENT_URL ??
  "https://levinnovation--customer-service-06622d63.modal.run";

const BITRIX_MCP_URL =
  import.meta.env.VITE_BITRIX_MCP_URL ??
  "https://levinnovation--bitrix24-mcp-bitrix24-server.modal.run";

// ─── Health ───

export async function waHealth(): Promise<{ status: string }> {
  const res = await fetch(`${WA_AGENT_URL}/health`);
  return res.json();
}

// ─── Accounts ───

export async function waListAccounts(): Promise<WhatsAppAccount[]> {
  const res = await fetch(`${WA_AGENT_URL}/accounts`);
  if (!res.ok) throw new Error(`WA accounts: ${res.status}`);
  return res.json();
}

export async function waConnectAccount(
  phone: string,
  label: string,
  type: "personal" | "business"
): Promise<WhatsAppAccount> {
  const res = await fetch(`${WA_AGENT_URL}/accounts/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, label, type }),
  });
  if (!res.ok) throw new Error(`WA connect: ${res.status}`);
  return res.json();
}

export async function waDisconnectAccount(accountId: string): Promise<void> {
  const res = await fetch(`${WA_AGENT_URL}/accounts/${accountId}/disconnect`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`WA disconnect: ${res.status}`);
}

// ─── Conversations ───

export async function waListConversations(
  accountId?: string
): Promise<WhatsAppConversation[]> {
  const url = accountId
    ? `${WA_AGENT_URL}/conversations?account_id=${accountId}`
    : `${WA_AGENT_URL}/conversations`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WA conversations: ${res.status}`);
  return res.json();
}

export async function waGetConversation(
  conversationId: string
): Promise<WhatsAppConversation> {
  const res = await fetch(`${WA_AGENT_URL}/conversations/${conversationId}`);
  if (!res.ok) throw new Error(`WA conversation: ${res.status}`);
  return res.json();
}

// ─── Messages ───

export async function waSendMessage(
  payload: WhatsAppSendPayload
): Promise<WhatsAppMessage> {
  const res = await fetch(`${WA_AGENT_URL}/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`WA send: ${res.status}`);
  return res.json();
}

export async function waGetMessages(
  conversationId: string,
  limit = 50
): Promise<WhatsAppMessage[]> {
  const res = await fetch(
    `${WA_AGENT_URL}/conversations/${conversationId}/messages?limit=${limit}`
  );
  if (!res.ok) throw new Error(`WA messages: ${res.status}`);
  return res.json();
}

// ─── AI Agent Config ───

export async function waGetAgentConfig(): Promise<WhatsAppAgentConfig> {
  const res = await fetch(`${WA_AGENT_URL}/agent/config`);
  if (!res.ok) throw new Error(`WA agent config: ${res.status}`);
  return res.json();
}

export async function waUpdateAgentConfig(
  config: Partial<WhatsAppAgentConfig>
): Promise<WhatsAppAgentConfig> {
  const res = await fetch(`${WA_AGENT_URL}/agent/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`WA agent config update: ${res.status}`);
  return res.json();
}

// ─── AI Agent Actions ───

export async function waToggleAI(
  conversationId: string,
  enabled: boolean
): Promise<void> {
  const res = await fetch(
    `${WA_AGENT_URL}/conversations/${conversationId}/ai`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }
  );
  if (!res.ok) throw new Error(`WA toggle AI: ${res.status}`);
}

export async function waEscalate(conversationId: string): Promise<void> {
  const res = await fetch(
    `${WA_AGENT_URL}/conversations/${conversationId}/escalate`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(`WA escalate: ${res.status}`);
}

// ─── Bitrix Sync ───

export async function waSyncToBitrix(
  conversationId: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${BITRIX_MCP_URL}/mcp/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: "sync_whatsapp_conversation",
      args: { conversation_id: conversationId },
    }),
  });
  if (!res.ok) throw new Error(`Bitrix sync: ${res.status}`);
  return res.json();
}

// ─── Link conversation to ECS lead ───

export async function waLinkLead(
  conversationId: string,
  leadId: string
): Promise<void> {
  const res = await fetch(
    `${WA_AGENT_URL}/conversations/${conversationId}/link`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId }),
    }
  );
  if (!res.ok) throw new Error(`WA link lead: ${res.status}`);
}
