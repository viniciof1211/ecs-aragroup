/**
 * WhatsApp Manager types for multi-account messaging,
 * AI agent integration, and ECS/Bitrix sync.
 */

export interface WhatsAppAccount {
  id: string;
  label: string;
  phone: string;
  type: "personal" | "business";
  /** Modal webhook endpoint that handles this account */
  webhook_url: string;
  /** Whether the AI agent auto-replies on this account */
  ai_enabled: boolean;
  status: "connected" | "disconnected" | "pending";
  created_at: string;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  account_id: string;
  direction: "inbound" | "outbound";
  /** Who sent it: "lead", "agent" (AI), or "human" (manual operator) */
  sender_type: "lead" | "agent" | "human";
  body: string;
  media_url?: string;
  media_type?: string;
  timestamp: string;
  status: "sent" | "delivered" | "read" | "failed";
  /** If AI-generated, the sentiment at time of reply */
  ai_sentiment?: string;
  /** If AI-generated, confidence score */
  ai_confidence?: number;
}

export interface WhatsAppConversation {
  id: string;
  account_id: string;
  lead_id: string | null;
  lead_name: string;
  lead_phone: string;
  /** Last message preview */
  last_message: string;
  last_message_at: string;
  unread_count: number;
  /** AI agent handling status */
  ai_handling: boolean;
  /** Conversation status */
  status: "active" | "waiting" | "resolved" | "escalated";
  /** Assigned human agent (null = AI only) */
  assigned_to: string | null;
  messages: WhatsAppMessage[];
  created_at: string;
}

export interface WhatsAppSendPayload {
  account_id: string;
  conversation_id: string;
  phone: string;
  body: string;
  /** "human" for manual sends, "agent" for AI */
  sender_type: "human" | "agent";
}

export interface WhatsAppAgentConfig {
  /** System prompt for the customer-service agent */
  system_prompt: string;
  /** Whether to auto-delegate to sentiment subagent */
  sentiment_enabled: boolean;
  /** Whether to query ECS lead data for personalization */
  ecs_context_enabled: boolean;
  /** Max messages before escalating to human */
  escalation_threshold: number;
  /** Response language */
  language: "es" | "en";
}
