import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";

import MessageBubble from "./MessageBubble";

import { useChat } from "../hooks/useChat";

export default function ChatWindow() {
  const { messages } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Senza questo, i messaggi nuovi finiscono sotto il bordo visibile e
  // bisogna scorrere a mano dopo ogni risposta del coach.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="bg-muted rounded-full p-3">
          <MessageSquare className="text-muted-foreground size-5" />
        </div>

        <div>
          <p className="text-sm font-medium">Nessun messaggio</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Il coach conosce già pilota, auto e circuito attivi. Chiedi pure
            come se fossi al muretto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-6">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
