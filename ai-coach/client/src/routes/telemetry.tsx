import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { usePilotStore } from "../stores/pilot.store";
import { getCars } from "../services/garage.api";
import {
  deleteTelemetryImport,
  getLapTelemetry,
  getTelemetryImports,
  getTelemetryLaps,
  runTelemetryQuery,
  uploadTelemetry,
  type TelemetryImport,
  type TelemetryPoint,
} from "../services/telemetry.api";
import { getTrack, getTracks, saveTrackLayout } from "../services/track.api";

export const Route = createFileRoute("/telemetry")({
  component: Telemetry,
});

type LatLon = { lat: number; lon: number };

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
      <p className="text-sm text-gray-500">Nessun dato GPS per questo giro.</p>
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
    if ((p.brakePct ?? 0) > 5) return "#dc2626";
    if ((p.throttlePct ?? 0) > 20) return "#16a34a";
    return "#64748b";
  }

  const startProjected = project(lapPoints[0]);

  const cursorPoint = points[cursorIndex];
  const cursorProjected =
    cursorPoint?.lat !== null && cursorPoint?.lon !== null
      ? project({ lat: cursorPoint!.lat!, lon: cursorPoint!.lon! })
      : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border bg-white">
      {referencePoints.length > 0 && (
        <polyline
          points={referencePath}
          fill="none"
          stroke="#cbd5e1"
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
        fill="#0f172a"
        stroke="white"
        strokeWidth={2}
      />

      {cursorProjected && (
        <circle
          cx={cursorProjected[0]}
          cy={cursorProjected[1]}
          r={6}
          fill="#facc15"
          stroke="#0f172a"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

function LineChart({
  values,
  cursorIndex,
  color,
  unit,
}: {
  values: (number | null)[];
  cursorIndex: number;
  color: string;
  unit: string;
}) {
  const valid = values.filter((v): v is number => v !== null);

  if (valid.length === 0) {
    return <p className="text-sm text-gray-500">Nessun dato.</p>;
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

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-500">
        <span>
          {min.toFixed(1)} {unit}
        </span>
        <span>
          {max.toFixed(1)} {unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border bg-white">
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
        <line
          x1={cursorX}
          y1={0}
          x2={cursorX}
          y2={H}
          stroke="#94a3b8"
          strokeDasharray="4 2"
        />
      </svg>
    </div>
  );
}

function Telemetry() {
  const queryClient = useQueryClient();
  const pilotId = usePilotStore((state) => state.pilotId);

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
  const [queryRows, setQueryRows] = useState<any[] | null>(null);
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

  const tables = selectedImport?.tables
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
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Telemetria (LMU)</h1>
        <p className="text-sm text-gray-500">
          Importa un file .duckdb esportato da Le Mans Ultimate, scegli un giro
          e visualizza mappa e grafici.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-lg font-semibold">Nuovo import</h2>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded border p-2"
            value={carId}
            onChange={(e) => setCarId(e.target.value)}
          >
            <option value="">Nessuna auto associata</option>
            {carsQuery.data?.items?.map((car) => (
              <option key={car.id} value={car.id}>
                {car.name}
              </option>
            ))}
          </select>

          <input
            type="file"
            accept=".duckdb"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <button
            className="rounded border px-4 py-2 disabled:opacity-50"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? "Importazione..." : "Importa"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Import salvati</h2>

          <div className="space-y-3">
            {importsQuery.data?.items?.map((item) => (
              <div
                key={item.id}
                className={`cursor-pointer rounded border p-3 ${
                  selectedImport?.id === item.id ? "border-blue-500" : ""
                }`}
                onClick={() => {
                  setSelectedImport(item);
                  setSelectedLap(null);
                  setQueryRows(null);
                  setQueryError(null);
                }}
              >
                <div className="font-medium">{item.fileName}</div>
                <div className="text-sm text-gray-500">
                  Stato: {item.status}
                  {item.errorMessage && ` · ${item.errorMessage}`}
                </div>

                <button
                  className="mt-2 text-sm text-red-600 underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteImport(item.id);
                  }}
                >
                  Elimina
                </button>
              </div>
            ))}

            {!importsQuery.data?.items?.length && (
              <p className="text-sm text-gray-500">Nessun import ancora.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Giri</h2>

          {!selectedImport && (
            <p className="text-sm text-gray-500">Seleziona prima un import.</p>
          )}

          {selectedImport && lapsQuery.isPending && <p>Caricamento...</p>}

          <div className="grid grid-cols-4 gap-2">
            {lapsQuery.data?.laps?.map((lap) => (
              <button
                key={lap.lapNumber}
                className={`rounded border px-2 py-1 text-sm ${
                  selectedLap === lap.lapNumber
                    ? "border-blue-500 bg-blue-50"
                    : ""
                }`}
                onClick={() => {
                  setSelectedLap(lap.lapNumber);
                  setCursorIndex(0);
                }}
              >
                Giro {lap.lapNumber}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Struttura file</h2>

          {!selectedImport && (
            <p className="text-sm text-gray-500">
              Seleziona un import per vedere le tabelle contenute.
            </p>
          )}

          {selectedImport && (
            <div className="max-h-60 space-y-2 overflow-y-auto text-xs">
              {tables.map((table: any) => (
                <div key={table.name} className="rounded border p-2">
                  <div className="font-medium">
                    {table.name} ({table.rowCount} righe)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedLap !== null && (
        <div className="rounded-lg border p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Giro {selectedLap} — mappa e canali
            </h2>

            <div className="flex items-center gap-2">
              <select
                className="rounded border p-2 text-sm"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
              >
                <option value="">Circuito...</option>
                {tracksQuery.data?.items?.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>

              <button
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                onClick={handleSaveReference}
                disabled={!trackId || savingReference || points.length === 0}
                title="Usa questo giro come sagoma fissa del circuito"
              >
                {savingReference
                  ? "Salvataggio..."
                  : "Usa come tracciato di riferimento"}
              </button>
            </div>
          </div>

          {lapTelemetryQuery.isPending && <p>Caricamento telemetria...</p>}

          {points.length > 0 && (
            <div className="space-y-4">
              <input
                type="range"
                min={0}
                max={points.length - 1}
                value={cursorIndex}
                onChange={(e) => setCursorIndex(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-sm text-gray-500">
                t = {points[cursorIndex]?.t.toFixed(2)}s
              </p>

              <div className="grid gap-4 lg:grid-cols-2">
                <TrackMap
                  referencePoints={referencePoints}
                  points={points}
                  cursorIndex={cursorIndex}
                />

                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-sm font-medium">Velocità (km/h)</p>
                    <LineChart
                      values={points.map((p) => p.speedKmh)}
                      cursorIndex={cursorIndex}
                      color="#2563eb"
                      unit="km/h"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium">Acceleratore (%)</p>
                    <LineChart
                      values={points.map((p) => p.throttlePct)}
                      cursorIndex={cursorIndex}
                      color="#16a34a"
                      unit="%"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium">Freno (%)</p>
                    <LineChart
                      values={points.map((p) => p.brakePct)}
                      cursorIndex={cursorIndex}
                      color="#dc2626"
                      unit="%"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-lg font-semibold">Query esplorativa</h2>

        {!selectedImport && (
          <p className="text-sm text-gray-500">Seleziona un import.</p>
        )}

        {selectedImport && (
          <div>
            <textarea
              className="w-full rounded border p-2 font-mono text-sm"
              rows={3}
              placeholder='SELECT * FROM "nome_tabella"'
              value={sql}
              onChange={(e) => setSql(e.target.value)}
            />

            <button
              className="mt-2 rounded border px-4 py-2 disabled:opacity-50"
              onClick={handleRunQuery}
              disabled={querying || !sql.trim()}
            >
              {querying ? "Esecuzione..." : "Esegui query"}
            </button>

            {queryError && (
              <p className="mt-2 text-sm text-red-600">{queryError}</p>
            )}

            {queryRows && queryRows.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {Object.keys(queryRows[0]).map((key) => (
                        <th key={key} className="border p-1 text-left">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryRows.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((value, j) => (
                          <td key={j} className="border p-1">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
