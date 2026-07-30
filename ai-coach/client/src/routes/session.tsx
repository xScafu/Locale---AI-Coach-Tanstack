import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import {
  deleteSession,
  getSessionMessages,
  getSessions,
} from "@/services/session.api";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="space-y-6">
      <PageHeader
        title="Sessioni"
        description="Storico delle conversazioni con il coach."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sessioni salvate</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {sessionsQuery.isPending && (
              <>
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
              </>
            )}

            {!sessionsQuery.isPending &&
              (!sessionsQuery.data?.items ||
                sessionsQuery.data.items.length === 0) && (
                <p className="text-muted-foreground text-sm">
                  Nessuna sessione ancora.
                </p>
              )}

            {sessionsQuery.data?.items?.map((session) => (
              <div
                key={session.id}
                onClick={() => setSelectedId(session.id)}
                className={
                  selectedId === session.id
                    ? "border-primary bg-primary/5 cursor-pointer rounded-lg border p-3"
                    : "hover:border-foreground/20 cursor-pointer rounded-lg border p-3 transition-colors"
                }
              >
                <div className="truncate font-medium">{session.title}</div>

                <div className="text-muted-foreground mt-0.5 text-sm">
                  {formatDate(session.createdAt)} · {session.messageCount}{" "}
                  messaggi
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(session.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Elimina
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversazione</CardTitle>
          </CardHeader>

          <CardContent>
            {!selectedId && (
              <p className="text-muted-foreground text-sm">
                Seleziona una sessione per vedere i messaggi.
              </p>
            )}

            {selectedId && messagesQuery.isPending && (
              <div className="space-y-3">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
            )}

            <div className="max-h-[500px] space-y-3 overflow-y-auto">
              {messagesQuery.data?.items?.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "bg-primary/10 rounded-lg p-3 text-sm"
                      : "bg-muted rounded-lg p-3 text-sm"
                  }
                >
                  <div className="text-muted-foreground mb-1 text-xs font-medium">
                    {message.role === "user" ? "Tu" : "Coach"}
                  </div>

                  <div className="leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
