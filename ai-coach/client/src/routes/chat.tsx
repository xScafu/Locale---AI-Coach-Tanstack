import { createFileRoute } from "@tanstack/react-router";

import ChatWindow from "@/features/chat/components/ChatWindow";
import ChatInput from "@/features/chat/components/ChatInput";
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

      {/* Altezza fissa invece di h-full: il contenitore in AppLayout
          scorre gia' di suo, quindi una chat "alta quanto il padre"
          crescerebbe all'infinito invece di scrollare al suo interno. */}
      <Card className="flex h-[calc(100vh-13rem)] flex-col gap-0 overflow-hidden py-0">
        <ChatWindow />

        <ChatInput />
      </Card>
    </div>
  );
}
