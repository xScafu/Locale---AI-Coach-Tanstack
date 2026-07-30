import { useChatStore } from "../store/chat.store";

import { createSession, sendMessage } from "../../../lib/api";

export function useChat() {
  const { messages, addMessage, sessionId, setSession } = useChatStore();

  async function send(text: string) {
    // Prima non c'era nessun punto in cui una sessione venisse creata:
    // sessionId restava undefined per sempre e ogni richiesta a
    // /api/chat falliva con 400 "sessionId required". Ora, se manca,
    // la creiamo al volo prima di inviare il messaggio.
    let currentSessionId = sessionId;

    if (!currentSessionId) {
      const session = await createSession();
      currentSessionId = session.id;
      setSession(session.id);
    }

    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    });

    const response = await sendMessage(text, currentSessionId);

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
