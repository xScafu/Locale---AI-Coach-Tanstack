import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  deleteSession,
  getSessionMessages,
  getSessions,
} from "../services/session.api";

export const Route = createFileRoute("/session")({
  component: SessionsPage,
});

function formatDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString("it-IT");
}

function SessionsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: getSessions,
  });

  const messagesQuery = useQuery({
    queryKey: ["session-messages", selectedId],
    queryFn: () => getSessionMessages(selectedId as string),
    enabled: !!selectedId,
  });

  async function handleDelete(id: string) {
    if (!confirm("Eliminare questa sessione di chat?")) return;

    await deleteSession(id);
    await queryClient.invalidateQueries({ queryKey: ["sessions"] });

    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Sessioni</h1>
        <p className="text-sm text-gray-500">
          Storico delle conversazioni con il coach.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Sessioni salvate</h2>

          {sessionsQuery.isPending && <p>Caricamento...</p>}

          {!sessionsQuery.isPending &&
            (!sessionsQuery.data?.items ||
              sessionsQuery.data.items.length === 0) && (
              <p className="text-sm text-gray-500">Nessuna sessione ancora.</p>
            )}

          <div className="space-y-3">
            {sessionsQuery.data?.items?.map((session) => (
              <div
                key={session.id}
                className={`cursor-pointer rounded border p-3 ${
                  selectedId === session.id ? "border-blue-500" : ""
                }`}
                onClick={() => setSelectedId(session.id)}
              >
                <div className="font-medium">{session.title}</div>
                <div className="text-sm text-gray-500">
                  {formatDate(session.createdAt)} · {session.messageCount}{" "}
                  messaggi
                </div>

                <button
                  className="mt-2 text-sm text-red-600 underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(session.id);
                  }}
                >
                  Elimina
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Conversazione</h2>

          {!selectedId && (
            <p className="text-sm text-gray-500">
              Seleziona una sessione per vedere i messaggi.
            </p>
          )}

          {selectedId && messagesQuery.isPending && <p>Caricamento...</p>}

          <div className="max-h-[500px] space-y-3 overflow-y-auto">
            {messagesQuery.data?.items?.map((message) => (
              <div
                key={message.id}
                className={`rounded p-3 text-sm ${
                  message.role === "user" ? "bg-blue-50" : "bg-slate-50"
                }`}
              >
                <div className="mb-1 text-xs font-medium text-gray-500">
                  {message.role === "user" ? "Tu" : "Coach"}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
