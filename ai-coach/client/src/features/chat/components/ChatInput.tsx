import { useState } from "react";
import { Loader2, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useChat } from "../hooks/useChat";

export default function ChatInput() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const { send } = useChat();

  async function submit() {
    if (!value.trim() || loading) return;

    const message = value;

    // pulisce subito il campo
    setValue("");

    try {
      setLoading(true);

      await send(message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex shrink-0 gap-3 border-t p-4">
      <Input
        className="flex-1"
        value={value}
        disabled={loading}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scrivi un messaggio..."
      />

      <Button disabled={loading || !value.trim()} onClick={submit}>
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Attendo...
          </>
        ) : (
          <>
            <SendHorizontal className="size-4" />
            Invia
          </>
        )}
      </Button>
    </div>
  );
}
