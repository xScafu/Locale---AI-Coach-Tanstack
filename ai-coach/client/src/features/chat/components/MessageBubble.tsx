import type { Message } from "../store/chat.store";

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={
        isUser
          ? "bg-primary text-primary-foreground ml-auto max-w-2xl rounded-lg rounded-br-sm px-4 py-3"
          : "bg-muted mr-auto max-w-2xl rounded-lg rounded-bl-sm px-4 py-3"
      }
    >
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {message.content}
      </div>

      {message.tokens && (
        <div
          className={
            isUser
              ? "mt-2 font-mono text-xs opacity-70"
              : "text-muted-foreground mt-2 font-mono text-xs"
          }
        >
          {message.tokens} token
        </div>
      )}
    </div>
  );
}
