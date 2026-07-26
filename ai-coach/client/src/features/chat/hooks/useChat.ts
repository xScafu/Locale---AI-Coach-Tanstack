import { useChatStore } from "../store/chat.store";

import { sendMessage } from "../../../lib/api";

export function useChat() {
  const { messages, addMessage, sessionId, setSession } = useChatStore();

  async function send(text: string) {
    addMessage({
      id: crypto.randomUUID(),

      role: "user",

      content: text,

      createdAt: Date.now(),
    });

    const response = await sendMessage(text, sessionId);

    if (response.sessionId) {
      setSession(response.sessionId);
    }

    addMessage({
      id: crypto.randomUUID(),

      role: "assistant",

      content: response.answer,

      tokens: response.usage?.total_tokens,

      createdAt: Date.now(),
    });
  }

  return {
    messages,

    send,
  };
}
