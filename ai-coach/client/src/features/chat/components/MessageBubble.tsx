import type { Message } from "../store/chat.store";

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`
    p-4 rounded-lg max-w-2xl
    ${isUser ? "ml-auto bg-blue-100" : "mr-auto bg-gray-100"}
    `}
    >
      <div>{message.content}</div>

      {message.tokens && (
        <div className="text-xs mt-2 opacity-60">
          Token:
          {message.tokens}
        </div>
      )}
    </div>
  );
}
