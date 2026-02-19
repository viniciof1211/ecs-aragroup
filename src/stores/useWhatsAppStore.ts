import { create } from "zustand";
import type {
  WhatsAppAccount,
  WhatsAppConversation,
  WhatsAppMessage,
} from "@/types/whatsapp";

interface WhatsAppState {
  accounts: WhatsAppAccount[];
  conversations: WhatsAppConversation[];
  activeConversationId: string | null;
  loading: boolean;
  error: string | null;

  setAccounts: (accounts: WhatsAppAccount[]) => void;
  setConversations: (conversations: WhatsAppConversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: WhatsAppMessage) => void;
  updateConversation: (id: string, updates: Partial<WhatsAppConversation>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWhatsAppStore = create<WhatsAppState>((set) => ({
  accounts: [],
  conversations: [],
  activeConversationId: null,
  loading: false,
  error: null,

  setAccounts: (accounts) => set({ accounts }),
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: [...c.messages, message],
              last_message: message.body,
              last_message_at: message.timestamp,
              unread_count:
                message.direction === "inbound"
                  ? c.unread_count + 1
                  : c.unread_count,
            }
          : c
      ),
    })),

  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
