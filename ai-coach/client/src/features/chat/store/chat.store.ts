import { create } from "zustand";

export type Message = {
  id: string;

  role: "user" | "assistant";

  content: string;

  tokens?: number;

  createdAt: number;
};

type ChatStore = {
  messages: Message[];
  sessionId?: string;

  addMessage: (message: Message) => void;

  setSession: (id: string) => void;

  clear: () => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],

  addMessage(message) {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  clear() {
    set({
      messages: [],
    });
  },

  setSession(id) {
    set({
      sessionId: id,
    });
  },
}));
