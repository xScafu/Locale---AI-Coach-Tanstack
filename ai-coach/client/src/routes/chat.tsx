import { createFileRoute } from "@tanstack/react-router";

import ChatWindow from "../features/chat/components/ChatWindow";
import ChatInput from "../features/chat/components/ChatInput";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="h-screen flex flex-col">
      <ChatWindow />

      <ChatInput />
    </div>
  );
}
