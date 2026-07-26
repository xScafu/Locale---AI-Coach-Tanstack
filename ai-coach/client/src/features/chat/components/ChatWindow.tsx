import MessageBubble from "./MessageBubble";

import { useChat } from "../hooks/useChat";

export default function ChatWindow() {
  const { messages } = useChat();

  return (
    <div
      className="
flex-1
overflow-y-auto
space-y-4
p-6
"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
