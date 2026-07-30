import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  activateTrack,
  createTrack,
  deleteTrack,
  getTracks,
  parseTrackProfile,
  regenerateTrackProfile,
  updateTrack,
  type Track,
} from "@/services/track.api";
import { useActivePilot } from "@/hooks/useActivePilot";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/tracks")({
  component: TracksPage,
});

type SheetForm = {
  name: string;
  country: string;
  variant: string;
  lengthM: string;
  cornerCount: string;
  referenceLapSeconds: string;
  notes: string;
};

function toSheetForm(track: Track): SheetForm {
  return {
    name: track.name,
    country: track.country ?? "",
    variant: track.variant ?? "",
    lengthM: track.lengthM?.toString() ?? "",
    cornerCount: track.cornerCount?.toString() ?? "",
    referenceLapSeconds: track.referenceLapSeconds?.toString() ?? "",
    notes: track.notes ?? "",
  };
}

function formatLapTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;

  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, "0")}` : `${s.toFixed(3)}s`;
}

function TrackProfileCard({ track }: { track: Track }) {
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);

  const profile = parseTrackProfile(track);

  async function regenerate() {
    setRegenerating(true);

    try {
      const result = await regenerateTrackProfile(track.id);
      await queryClient.invalidateQueries({ queryKey: ["tracks"] });

      toast.success(
        `Profilo aggiornato: ${result.profile?.corners.length ?? 0} curve rilevate`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Generazione non riuscita"
      );
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Profilo curve</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Derivato dalla telemetria, non inserito a mano.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={regenerate}
          disabled={regenerating}
        >
          <RefreshCw
            className={regenerating ? "size-3.5 animate-spin" : "size-3.5"}
          />
          {regenerating ? "Calcolo..." : "Rigenera"}
        </Button>
      </CardHeader>

      <CardContent>
        {!profile ? (
          <p className="text-muted-foreground text-sm">
            Nessun profilo disponibile. Importa un file di telemetria di questo
            circuito dalla pagina Telemetria, oppure premi "Rigenera" se ne hai
            già caricato uno.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span>
                <span className="text-muted-foreground">Lunghezza: </span>
                <span className="font-mono">{profile.lengthM} m</span>
              </span>
              <span>
                <span className="text-muted-foreground">Giro migliore: </span>
                <span className="font-mono">
                  {formatLapTime(profile.bestLapSeconds)}
                </span>
              </span>
              <span>
                {/* Diverso dai "giri completi" del confronto qui sotto:
                    qui sono tutti i giri sopra i 20s, li' solo quelli
                    percorsi senza interruzioni. */}
                <span className="text-muted-foreground">Giri nel file: </span>
                <span className="font-mono">{profile.lapsAnalyzed}</span>
              </span>
            </div>

            {profile.reference?.theoreticalLapSeconds != null && (
              <div className="bg-muted/40 rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <span className="text-sm font-medium">Giro teorico</span>

                  <span className="font-mono text-2xl font-semibold tracking-tight">
                    {formatLapTime(profile.reference.theoreticalLapSeconds)}
                  </span>

                  <span className="text-primary font-mono text-sm">
                    −{profile.reference.potentialGainSeconds?.toFixed(3)}s sul
                    tuo migliore
                  </span>
                </div>

                <p className="text-muted-foreground mt-2 text-sm">
                  Somma dei settori più veloci, presi da giri diversi su{" "}
                  {profile.reference.lapsAnalyzed} giri completi. È tempo che
                  hai già dimostrato di saper fare a pezzi, mai tutto insieme.
                </p>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Curva</TableHead>
                    <TableHead>Ingresso</TableHead>
                    <TableHead>Minima</TableHead>
                    <TableHead>Tuo massimo</TableHead>
                    <TableHead>G lat.</TableHead>
                    <TableHead>Staccata</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {profile.corners.map((corner) => {
                    const ref = profile.reference?.corners.find(
                      (c) => c.number === corner.number
                    );

                    return (
                      <TableRow key={corner.number}>
                        <TableCell className="font-medium">
                          {corner.number}
                          <Badge variant="outline" className="ml-2">
                            {corner.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {corner.entryM} m
                        </TableCell>
                        <TableCell className="font-mono">
                          {corner.minSpeedKmh} km/h
                        </TableCell>
                        <TableCell className="font-mono">
                          {ref ? (
                            <>
                              {ref.bestMinSpeedKmh} km/h
                              {ref.deltaKmh >= 3 && (
                                <span className="text-primary ml-2">
                                  +{ref.deltaKmh}
                                </span>
                              )}
                              <span className="text-muted-foreground ml-2 text-xs">
                                giro {ref.bestLapNumber}
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          {corner.peakLatG}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono">
                          {corner.brakingDistanceM !== null
                            ? `${corner.brakingDistanceM} m prima`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <p className="text-muted-foreground text-xs">
              Vengono contate solo le curve oltre {profile.detection.latGThreshold}G:
              i curvoni percorsi in pieno non compaiono, perché non richiedono
              frenata né correzione di traiettoria con l'auto usata in quel
              giro.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrackSheetCard({ track }: { track: Track }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SheetForm>(() => toSheetForm(track));
  const [savedFor, setSavedFor] = useState(track.id);
  const [saving, setSaving] = useState(false);

  // Cambiando circuito selezionato il form deve ripartire dai valori
  // del nuovo, altrimenti si trascina dietro quelli del precedente.
  if (savedFor !== track.id) {
    setSavedFor(track.id);
    setForm(toSheetForm(track));
  }

  async function save() {
    if (!form.name.trim()) return;

    setSaving(true);

    try {
      await updateTrack(track.id, form);
      await queryClient.invalidateQueries({ queryKey: ["tracks"] });
      toast.success("Scheda circuito salvata");
    } catch {
      toast.error("Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheda circuito</CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          Lunghezza e numero curve sono precompilati dalla telemetria. Se li
          modifichi, il tuo valore viene mantenuto anche dopo un nuovo import.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="t-name">Nome</Label>
            <Input
              id="t-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-country">Paese</Label>
            <Input
              id="t-country"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-variant">Variante</Label>
            <Input
              id="t-variant"
              placeholder="Layout dichiarato dal simulatore"
              value={form.variant}
              onChange={(e) => setForm({ ...form, variant: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-length">Lunghezza (m)</Label>
            <Input
              id="t-length"
              inputMode="decimal"
              className="font-mono"
              value={form.lengthM}
              onChange={(e) => setForm({ ...form, lengthM: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-corners">Numero curve</Label>
            <Input
              id="t-corners"
              inputMode="numeric"
              className="font-mono"
              value={form.cornerCount}
              onChange={(e) =>
                setForm({ ...form, cornerCount: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-reference">Tempo di riferimento (s)</Label>
            <Input
              id="t-reference"
              inputMode="decimal"
              className="font-mono"
              placeholder="Es. 98.4"
              value={form.referenceLapSeconds}
              onChange={(e) =>
                setForm({ ...form, referenceLapSeconds: e.target.value })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="t-notes">Note</Label>
          <Textarea
            id="t-notes"
            rows={3}
            placeholder="Cordoli da evitare, punti di riferimento, comportamento con pista fredda..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Queste note finiscono nel contesto del coach insieme ai dati
            derivati.
          </p>
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva scheda"}
        </Button>
      </CardContent>
    </Card>
  );
}

function TracksPage() {
  const queryClient = useQueryClient();
  // pilotPending distingue "sto ancora chiedendo al server" da "non
  // c'e' nessun pilota": senza, la pagina lampeggia "salva prima un
  // profilo" a ogni caricamento.
  const { pilotId, isPending: pilotPending } = useActivePilot();

  const [form, setForm] = useState({ name: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["tracks", pilotId],
    queryFn: () => getTracks(pilotId as string),
    enabled: !!pilotId,
  });

  const items = data?.items ?? [];
  const selected = items.find((t) => t.id === selectedId) ?? items[0] ?? null;

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
      if (selectedId === id) setSelectedId(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Circuiti"
        description="Il circuito attivo viene passato al coach insieme al profilo curve ricavato dalla tua telemetria."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
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
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                />
              </div>

              <Button onClick={save} disabled={!pilotId || saving}>
                {saving ? "Salvataggio..." : "Salva circuito"}
              </Button>

              <p className="text-muted-foreground text-xs">
                Non serve crearli a mano: importando una telemetria il circuito
                viene riconosciuto e creato in automatico.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Circuiti salvati</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {!pilotId && !pilotPending && (
                <p className="text-muted-foreground text-sm">
                  Salva prima un profilo pilota.
                </p>
              )}

              {(pilotPending || (pilotId && isPending)) && (
                <>
                  <Skeleton className="h-24 rounded-lg" />
                  <Skeleton className="h-24 rounded-lg" />
                </>
              )}

              {pilotId && !isPending && items.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Nessun circuito salvato.
                </p>
              )}

              {items.map((track) => (
                <div
                  key={track.id}
                  onClick={() => setSelectedId(track.id)}
                  className={
                    selected?.id === track.id
                      ? "border-primary bg-primary/5 cursor-pointer rounded-lg border p-3"
                      : "hover:border-foreground/20 cursor-pointer rounded-lg border p-3 transition-colors"
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{track.name}</span>
                    {track.isActive && <Badge>Attivo</Badge>}
                  </div>

                  <div className="text-muted-foreground mt-0.5 text-sm">
                    {track.country ?? "Paese non specificato"}
                    {track.cornerCount ? ` · ${track.cornerCount} curve` : ""}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!track.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === track.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActivate(track.id);
                        }}
                      >
                        Imposta come attivo
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={busyId === track.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(track.id);
                      }}
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

        {selected ? (
          <div className="space-y-4">
            <TrackSheetCard track={selected} />
            <TrackProfileCard track={selected} />
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Seleziona un circuito per vederne la scheda e il profilo curve.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
