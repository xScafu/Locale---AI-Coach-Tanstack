import { createFileRoute } from "@tanstack/react-router";

import ChatWindow from "@/features/chat/components/ChatWindow";
import ChatInput from "@/features/chat/components/ChatInput";
import ChatContextPanel from "@/features/chat/components/ChatContextPanel";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Il coach risponde usando pilota, auto, circuito e telemetria attivi.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* Sotto lg le card di contesto finiscono sopra la chat, dove
            occuperebbero tutto lo schermo prima di arrivare ai
            messaggi: in colonna stretta si accettano, a schermo pieno
            no. Per questo l'ordine cambia con il breakpoint. */}
        <aside className="order-2 lg:order-1 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto">
          <ChatContextPanel />
        </aside>

        {/* Altezza fissa invece di h-full: il contenitore in AppLayout
            scorre gia' di suo, quindi una chat "alta quanto il padre"
            crescerebbe all'infinito invece di scrollare al suo interno. */}
        <Card className="order-1 flex h-[calc(100vh-13rem)] flex-col gap-0 overflow-hidden py-0 lg:order-2">
          <ChatWindow />

          <ChatInput />
        </Card>
      </div>
    </div>
  );
}
