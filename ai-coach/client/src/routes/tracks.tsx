import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";

import {
  activateTrack,
  createTrack,
  deleteTrack,
  getTracks,
} from "@/services/track.api";
import { usePilotStore } from "@/stores/pilot.store";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/tracks")({
  component: TracksPage,
});

function TracksPage() {
  const queryClient = useQueryClient();
  const pilotId = usePilotStore((state) => state.pilotId);

  const [form, setForm] = useState({ name: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["tracks", pilotId],
    queryFn: () => getTracks(pilotId as string),
    enabled: !!pilotId,
  });

  async function save() {
    if (!pilotId || !form.name.trim()) return;

    setSaving(true);

    try {
      await createTrack({ pilotId, name: form.name, country: form.country });
      setForm({ name: "", country: "" });
      await queryClient.invalidateQueries({ queryKey: ["tracks", pilotId] });
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    setBusyId(id);
    try {
      await activateTrack(id);
      await queryClient.invalidateQueries({ queryKey: ["tracks", pilotId] });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminare questo circuito?")) return;

    setBusyId(id);
    try {
      await deleteTrack(id);
      await queryClient.invalidateQueries({ queryKey: ["tracks", pilotId] });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Circuiti"
        description="Il circuito attivo viene passato al coach come contesto in chat."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nuovo circuito</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="track-name">Nome circuito</Label>
              <Input
                id="track-name"
                placeholder="Es. Monza"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="track-country">Paese</Label>
              <Input
                id="track-country"
                placeholder="Es. Italia"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>

            <Button onClick={save} disabled={!pilotId || saving}>
              {saving ? "Salvataggio..." : "Salva circuito"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Circuiti salvati</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {!pilotId && (
              <p className="text-muted-foreground text-sm">
                Salva prima un profilo pilota.
              </p>
            )}

            {pilotId && isPending && (
              <>
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
              </>
            )}

            {pilotId && !isPending && data?.items?.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Nessun circuito salvato.
              </p>
            )}

            {data?.items?.map((track) => (
              <div key={track.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{track.name}</span>
                  {track.isActive && <Badge>Attivo</Badge>}
                </div>

                <div className="text-muted-foreground mt-0.5 text-sm">
                  {track.country ?? "Paese non specificato"}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!track.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === track.id}
                      onClick={() => handleActivate(track.id)}
                    >
                      Imposta come attivo
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busyId === track.id}
                    onClick={() => handleDelete(track.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Elimina
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
