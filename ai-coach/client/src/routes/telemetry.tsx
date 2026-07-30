import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trash2, Upload } from "lucide-react";

import { useActivePilot } from "@/hooks/useActivePilot";
import { getCars } from "@/services/garage.api";
import {
  deleteTelemetryImport,
  getLapTelemetry,
  getTelemetryImports,
  getTelemetryLaps,
  runTelemetryQuery,
  uploadTelemetry,
  type TelemetryImport,
  type TelemetryPoint,
} from "@/services/telemetry.api";
import { getTrack, getTracks, saveTrackLayout } from "@/services/track.api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/telemetry")({
  component: Telemetry,
});

// Radix Select non ammette SelectItem con value="": serve un valore
// sentinella da tradurre in stringa vuota quando si legge lo stato.
const NONE = "__none__";

// I colori dei canali vengono dai token --chart-*, non da esadecimali
// fissi: cosi' restano leggibili anche in tema scuro e lo stesso canale
// ha lo stesso colore in tutti i grafici della pagina.
const CHANNEL_COLOR = {
  brake: "var(--chart-1)",
  throttle: "var(--chart-2)",
  speed: "var(--chart-3)",
  cursor: "var(--chart-4)",
} as const;

type LatLon = { lat: number; lon: number };

type QueryRow = Record<string, unknown>;

// Struttura introspezionata del file .duckdb, serializzata in JSON
// dentro telemetry_imports.tables lato server.
type TableInfo = { name: string; rowCount: number };

// Proietta insieme sagoma di riferimento + giro corrente sullo stesso
// piano in metri: condividono origine e scala, quindi restano allineati
// anche se il fuori pista deforma solo la linea colorata sopra.
function projectJoint(
  referencePoints: LatLon[],
  lapPoints: LatLon[],
  W: number,
  H: number,
  padding: number
) {
  const all = [...referencePoints, ...lapPoints];
  if (all.length === 0) return null;

  const latRef = all[0].lat;
  const METERS_PER_DEG_LAT = 111320;
  const metersPerDegLon = 111320 * Math.cos((latRef * Math.PI) / 180);

  const toMeters = (p: LatLon) => ({
    x: (p.lon - all[0].lon) * metersPerDegLon,
    y: (p.lat - all[0].lat) * METERS_PER_DEG_LAT,
  });

  const allMeters = all.map(toMeters);
  const xs = allMeters.map((p) => p.x);
  const ys = allMeters.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const availW = W - 2 * padding;
  const availH = H - 2 * padding;
  const scale = Math.min(availW / rangeX, availH / rangeY);

  const offsetX = padding + (availW - rangeX * scale) / 2;
  const offsetY = padding + (availH - rangeY * scale) / 2;

  function project(p: LatLon): [number, number] {
    const m = toMeters(p);
    const px = offsetX + (m.x - minX) * scale;
    const py = offsetY + (rangeY - (m.y - minY)) * scale;
    return [px, py];
  }

  return { project };
}

function TrackMap({
  referencePoints,
  points,
  cursorIndex,
}: {
  referencePoints: LatLon[];
  points: TelemetryPoint[];
  cursorIndex: number;
}) {
  const lapPoints = points.filter(
    (p) => p.lat !== null && p.lon !== null
  ) as (TelemetryPoint & { lat: number; lon: number })[];

  if (lapPoints.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nessun dato GPS per questo giro.
      </p>
    );
  }

  const W = 600;
  const H = 400;
  const PADDING = 20;

  const projection = projectJoint(referencePoints, lapPoints, W, H, PADDING);
  if (!projection) return null;
  const { project } = projection;

  const referencePath = referencePoints
    .map((p) => project(p).join(","))
    .join(" ");

  // Verde = acceleratore, rosso = freno, grigio = rilascio - stessa
  // logica del software di riferimento mostrato dall'utente.
  function segmentColor(p: TelemetryPoint) {
    if ((p.brakePct ?? 0) > 5) return CHANNEL_COLOR.brake;
    if ((p.throttlePct ?? 0) > 20) return CHANNEL_COLOR.throttle;
    return "var(--muted-foreground)";
  }

  const startProjected = project(lapPoints[0]);

  const cursorPoint = points[cursorIndex];
  const cursorProjected =
    cursorPoint?.lat !== null && cursorPoint?.lon !== null
      ? project({ lat: cursorPoint!.lat!, lon: cursorPoint!.lon! })
      : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="bg-muted/30 w-full rounded-lg border"
    >
      {referencePoints.length > 0 && (
        <polyline
          points={referencePath}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeOpacity={0.35}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {lapPoints.slice(1).map((p, i) => {
        const prev = lapPoints[i];
        const [x1, y1] = project(prev);
        const [x2, y2] = project(p);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={segmentColor(p)}
            strokeWidth={2}
          />
        );
      })}

      <circle
        cx={startProjected[0]}
        cy={startProjected[1]}
        r={5}
        fill="var(--foreground)"
        stroke="var(--background)"
        strokeWidth={2}
      />

      {cursorProjected && (
        <circle
          cx={cursorProjected[0]}
          cy={cursorProjected[1]}
          r={6}
          fill={CHANNEL_COLOR.cursor}
          stroke="var(--background)"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

function LineChart({
  label,
  values,
  cursorIndex,
  color,
  unit,
}: {
  label: string;
  values: (number | null)[];
  cursorIndex: number;
  color: string;
  unit: string;
}) {
  const valid = values.filter((v): v is number => v !== null);

  if (valid.length === 0) {
    return <p className="text-muted-foreground text-sm">Nessun dato.</p>;
  }

  const W = 600;
  const H = 100;
  const min = Math.min(...valid);
  const max = Math.max(...valid);

  const points = values
    .map((v, i) => {
      if (v === null) return null;
      const x = (i / (values.length - 1 || 1)) * W;
      const y = H - ((v - min) / (max - min || 1)) * H;
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");

  const cursorX = (cursorIndex / (values.length - 1 || 1)) * W;
  const current = values[cursorIndex];

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          {label}
        </span>

        {/* Il valore sotto al cursore: senza questo il grafico si legge
            solo "a occhio" e lo slider non serve a niente di preciso. */}
        <span className="font-mono text-sm tabular-nums">
          {current !== null && current !== undefined
            ? `${current.toFixed(1)} ${unit}`
            : "—"}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="bg-muted/30 h-24 w-full rounded-lg border"
      >
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
        <line
          x1={cursorX}
          y1={0}
          x2={cursorX}
          y2={H}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 2"
        />
      </svg>

      <div className="text-muted-foreground mt-1 flex justify-between font-mono text-xs">
        <span>
          {min.toFixed(1)} {unit}
        </span>
        <span>
          {max.toFixed(1)} {unit}
        </span>
      </div>
    </div>
  );
}

function Telemetry() {
  const queryClient = useQueryClient();
  const { pilotId } = useActivePilot();

  const [carId, setCarId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImport, setSelectedImport] = useState<TelemetryImport | null>(
    null
  );
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [trackId, setTrackId] = useState("");
  const [savingReference, setSavingReference] = useState(false);

  const [sql, setSql] = useState("");
  // Le colonne dipendono dalla query scritta dall'utente, quindi la
  // forma della riga si conosce solo a runtime.
  const [queryRows, setQueryRows] = useState<QueryRow[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);

  const carsQuery = useQuery({
    queryKey: ["cars", pilotId],
    queryFn: () => getCars(pilotId as string),
    enabled: !!pilotId,
  });

  const tracksQuery = useQuery({
    queryKey: ["tracks", pilotId],
    queryFn: () => getTracks(pilotId as string),
    enabled: !!pilotId,
  });

  const trackQuery = useQuery({
    queryKey: ["track", trackId],
    queryFn: () => getTrack(trackId),
    enabled: !!trackId,
  });

  const referencePoints: LatLon[] = useMemo(() => {
    const layout = trackQuery.data?.track.layout;
    if (!layout) return [];

    try {
      return JSON.parse(layout);
    } catch {
      return [];
    }
  }, [trackQuery.data]);

  const importsQuery = useQuery({
    queryKey: ["telemetry", carId],
    queryFn: () => getTelemetryImports(carId || undefined),
  });

  const lapsQuery = useQuery({
    queryKey: ["telemetry-laps", selectedImport?.id],
    queryFn: () => getTelemetryLaps(selectedImport!.id),
    enabled: !!selectedImport,
  });

  const lapTelemetryQuery = useQuery({
    queryKey: ["telemetry-lap", selectedImport?.id, selectedLap],
    queryFn: () => getLapTelemetry(selectedImport!.id, selectedLap!),
    enabled: !!selectedImport && selectedLap !== null,
  });

  const points = lapTelemetryQuery.data?.points ?? [];

  const tables: TableInfo[] = selectedImport?.tables
    ? JSON.parse(selectedImport.tables)
    : [];

  async function handleUpload() {
    if (!file) return;

    setUploading(true);

    try {
      await uploadTelemetry(file, carId || undefined);
      await queryClient.invalidateQueries({ queryKey: ["telemetry"] });
      setFile(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImport(id: string) {
    if (!confirm("Eliminare questo import di telemetria?")) return;

    await deleteTelemetryImport(id);
    await queryClient.invalidateQueries({ queryKey: ["telemetry"] });

    if (selectedImport?.id === id) {
      setSelectedImport(null);
      setSelectedLap(null);
    }
  }

  async function handleRunQuery() {
    if (!selectedImport || !sql.trim()) return;

    setQuerying(true);
    setQueryError(null);

    try {
      const result = await runTelemetryQuery(selectedImport.id, sql);

      if (result.error) {
        setQueryError(result.error);
        setQueryRows(null);
      } else {
        setQueryRows(result.rows ?? []);
      }
    } finally {
      setQuerying(false);
    }
  }

  async function handleSaveReference() {
    if (!trackId || points.length === 0) return;

    const latLonPoints = points
      .filter((p) => p.lat !== null && p.lon !== null)
      .map((p) => ({ lat: p.lat as number, lon: p.lon as number }));

    if (latLonPoints.length === 0) return;

    setSavingReference(true);

    try {
      await saveTrackLayout(trackId, latLonPoints);
      await queryClient.invalidateQueries({ queryKey: ["track", trackId] });
    } finally {
      setSavingReference(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telemetria (LMU)"
        description="Importa un file .duckdb esportato da Le Mans Ultimate, scegli un giro e visualizza mappa e grafici."
      />

      <Card>
        <CardHeader>
          <CardTitle>Nuovo import</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="import-car">Auto associata</Label>
              <Select
                value={carId || NONE}
                onValueChange={(value) =>
                  setCarId(value === NONE ? "" : value)
                }
              >
                <SelectTrigger id="import-car" className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={NONE}>Nessuna auto associata</SelectItem>
                  {carsQuery.data?.items?.map((car) => (
                    <SelectItem key={car.id} value={car.id}>
                      {car.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-file">File .duckdb</Label>
              <Input
                id="import-file"
                type="file"
                accept=".duckdb"
                className="cursor-pointer"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button onClick={handleUpload} disabled={!file || uploading}>
              <Upload className="size-4" />
              {uploading ? "Importazione..." : "Importa"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Import salvati</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {importsQuery.isPending && <Skeleton className="h-24 rounded-lg" />}

            {importsQuery.data?.items?.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedImport(item);
                  setSelectedLap(null);
                  setQueryRows(null);
                  setQueryError(null);
                }}
                className={
                  selectedImport?.id === item.id
                    ? "border-primary bg-primary/5 cursor-pointer rounded-lg border p-3"
                    : "hover:border-foreground/20 cursor-pointer rounded-lg border p-3 transition-colors"
                }
              >
                <div className="truncate font-medium">{item.fileName}</div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      item.status === "parsed"
                        ? "secondary"
                        : item.status === "error"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {item.status}
                  </Badge>

                  {item.errorMessage && (
                    <span className="text-destructive text-xs">
                      {item.errorMessage}
                    </span>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteImport(item.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Elimina
                </Button>
              </div>
            ))}

            {!importsQuery.isPending && !importsQuery.data?.items?.length && (
              <p className="text-muted-foreground text-sm">
                Nessun import ancora.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Giri</CardTitle>
          </CardHeader>

          <CardContent>
            {!selectedImport && (
              <p className="text-muted-foreground text-sm">
                Seleziona prima un import.
              </p>
            )}

            {selectedImport && lapsQuery.isPending && (
              <Skeleton className="h-20 rounded-lg" />
            )}

            {selectedImport && !lapsQuery.isPending && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {lapsQuery.data?.laps?.map((lap) => (
                  <Button
                    key={lap.lapNumber}
                    variant={
                      selectedLap === lap.lapNumber ? "default" : "outline"
                    }
                    size="sm"
                    className="font-mono"
                    onClick={() => {
                      setSelectedLap(lap.lapNumber);
                      setCursorIndex(0);
                    }}
                  >
                    {lap.lapNumber}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Struttura file</CardTitle>
          </CardHeader>

          <CardContent>
            {!selectedImport && (
              <p className="text-muted-foreground text-sm">
                Seleziona un import per vedere le tabelle contenute.
              </p>
            )}

            {selectedImport && (
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {tables.map((table) => (
                  <div
                    key={table.name}
                    className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate font-medium">{table.name}</span>
                    <span className="text-muted-foreground shrink-0 font-mono">
                      {table.rowCount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedLap !== null && (
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Giro {selectedLap} — mappa e canali</CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={trackId || NONE}
                onValueChange={(value) =>
                  setTrackId(value === NONE ? "" : value)
                }
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue placeholder="Circuito..." />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={NONE}>Circuito...</SelectItem>
                  {tracksQuery.data?.items?.map((track) => (
                    <SelectItem key={track.id} value={track.id}>
                      {track.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveReference}
                disabled={!trackId || savingReference || points.length === 0}
                title="Usa questo giro come sagoma fissa del circuito"
              >
                {savingReference
                  ? "Salvataggio..."
                  : "Usa come tracciato di riferimento"}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {lapTelemetryQuery.isPending && (
              <Skeleton className="h-80 rounded-lg" />
            )}

            {points.length > 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="range"
                    min={0}
                    max={points.length - 1}
                    value={cursorIndex}
                    onChange={(e) => setCursorIndex(Number(e.target.value))}
                    className="accent-primary w-full"
                  />

                  <p className="text-muted-foreground font-mono text-sm tabular-nums">
                    t = {points[cursorIndex]?.t.toFixed(2)}s
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <TrackMap
                    referencePoints={referencePoints}
                    points={points}
                    cursorIndex={cursorIndex}
                  />

                  <div className="space-y-4">
                    <LineChart
                      label="Velocità"
                      values={points.map((p) => p.speedKmh)}
                      cursorIndex={cursorIndex}
                      color={CHANNEL_COLOR.speed}
                      unit="km/h"
                    />

                    <LineChart
                      label="Acceleratore"
                      values={points.map((p) => p.throttlePct)}
                      cursorIndex={cursorIndex}
                      color={CHANNEL_COLOR.throttle}
                      unit="%"
                    />

                    <LineChart
                      label="Freno"
                      values={points.map((p) => p.brakePct)}
                      cursorIndex={cursorIndex}
                      color={CHANNEL_COLOR.brake}
                      unit="%"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Query esplorativa</CardTitle>
        </CardHeader>

        <CardContent>
          {!selectedImport && (
            <p className="text-muted-foreground text-sm">
              Seleziona un import.
            </p>
          )}

          {selectedImport && (
            <div className="space-y-3">
              <Textarea
                className="font-mono text-sm"
                rows={3}
                placeholder='SELECT * FROM "nome_tabella"'
                value={sql}
                onChange={(e) => setSql(e.target.value)}
              />

              <Button
                onClick={handleRunQuery}
                disabled={querying || !sql.trim()}
              >
                {querying ? "Esecuzione..." : "Esegui query"}
              </Button>

              {queryError && (
                <p className="text-destructive text-sm">{queryError}</p>
              )}

              {queryRows && queryRows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(queryRows[0]).map((key) => (
                          <TableHead key={key}>{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {queryRows.map((row, i) => (
                        <TableRow key={i}>
                          {Object.values(row).map((value, j) => (
                            <TableCell key={j} className="font-mono text-xs">
                              {String(value)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {queryRows && queryRows.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  La query non ha restituito righe.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
