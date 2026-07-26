import { useState } from "react";

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
    <div className="border-t p-4 flex gap-3">
      <input
        className="
          border rounded p-2 flex-1
        "
        value={value}
        disabled={loading}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scrivi un messaggio..."
      />

      <button
        className="
          border px-5 rounded disabled:opacity-50
        "
        disabled={loading}
        onClick={submit}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            Attendo...
          </span>
        ) : (
          "Invia"
        )}
      </button>
    </div>
  );
}
