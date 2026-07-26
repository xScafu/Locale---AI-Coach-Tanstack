import { usePilotStore } from "../../../stores/pilot.store";
import { useChatStore } from "../store/chat.store";
import { sendMessage } from "../../../lib/api";

export function useChat() {
  const { messages, addMessage, sessionId, setSession } = useChatStore();
  const pilotId = usePilotStore((state) => state.pilotId);

  async function send(text: string) {
    if (!pilotId) {
      throw new Error("Nessun pilota attivo");
    }

    addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    });

    const response = await sendMessage(text, sessionId, pilotId);

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
