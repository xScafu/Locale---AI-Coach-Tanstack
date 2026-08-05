import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDeltaSeconds, formatLapTime } from "@/lib/lap-time";
import type { LapComparison } from "@/services/telemetry.api";

// Il giro del pilota e quello di riferimento hanno colori fissi in tutta
// la scheda: il riferimento resta smorzato come la sagoma del tracciato
// nella mappa, cosi' si capisce a colpo d'occhio quale linea e' la
// propria.
const MINE = "var(--chart-3)";
const REFERENCE = "var(--muted-foreground)";

const formatDelta = (value: number) => formatDeltaSeconds(value);

// Perso = rosso, guadagnato = verde. Sotto i cinque centesimi non si
// colora niente: a 10Hz un campione vale un decimo, e dare un colore a
// differenze piu' piccole inviterebbe a inseguire numeri che non ci sono.
function deltaClass(value: number) {
  if (value >= 0.05) return "text-destructive";
  if (value <= -0.05) return "";
  return "text-muted-foreground";
}

function deltaStyle(value: number) {
  return value <= -0.05 ? { color: "var(--chart-2)" } : undefined;
}

// Il delta cumulativo lungo il giro: quanto tempo si e' perso o
// guadagnato dal traguardo fino a quel punto. E' la curva che conta —
// dove sale, li' se ne va il tempo — e la sua pendenza dice molto piu'
// del valore assoluto.
function DeltaChart({ comparison }: { comparison: LapComparison }) {
  const samples = comparison.samples;
  if (samples.length === 0) return null;

  const W = 900;
  const H = 160;

  const deltas = samples.map((s) => s.deltaSeconds);
  const min = Math.min(...deltas, 0);
  const max = Math.max(...deltas, 0);
  const range = max - min || 1;

  const x = (i: number) => (i / (samples.length - 1 || 1)) * W;
  const y = (v: number) => H - ((v - min) / range) * H;

  const line = samples.map((s, i) => `${x(i)},${y(s.deltaSeconds)}`).join(" ");

  // L'area fra la curva e lo zero rende immediato il verso: sopra la
  // linea si perde, sotto si guadagna.
  const area = `${x(0)},${y(0)} ${line} ${x(samples.length - 1)},${y(0)}`;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium">
          Delta cumulativo sul giro
        </span>
        <span className="text-muted-foreground font-mono text-xs">
          sopra lo zero = tempo perso
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="bg-muted/30 h-40 w-full rounded-lg border"
      >
        <polygon points={area} fill="var(--chart-1)" fillOpacity={0.12} />

        <line
          x1={0}
          y1={y(0)}
          x2={W}
          y2={y(0)}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {/* Ogni curva del profilo, cosi' si legge dove cade ogni salita. */}
        {comparison.corners.map((corner) => {
          const px = (corner.entryM / comparison.lengthM) * W;

          return (
            <line
              key={corner.number}
              x1={px}
              y1={0}
              x2={px}
              y2={H}
              stroke="var(--border)"
              strokeDasharray="2 4"
            />
          );
        })}

        <polyline
          points={line}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={2}
        />
      </svg>

      <div className="text-muted-foreground mt-1 flex justify-between font-mono text-xs">
        <span>0 m</span>
        <span>
          {formatDelta(min)} … {formatDelta(max)}
        </span>
        <span>{comparison.lengthM} m</span>
      </div>
    </div>
  );
}

function SpeedChart({ comparison }: { comparison: LapComparison }) {
  const samples = comparison.samples;
  if (samples.length === 0) return null;

  const W = 900;
  const H = 140;

  const all = samples.flatMap((s) => [s.speedKmh, s.referenceSpeedKmh]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;

  const path = (pick: (s: (typeof samples)[number]) => number) =>
    samples
      .map(
        (s, i) =>
          `${(i / (samples.length - 1 || 1)) * W},${
            H - ((pick(s) - min) / range) * H
          }`
      )
      .join(" ");

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Velocità a confronto</span>

        <span className="flex items-center gap-3 font-mono text-xs">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: MINE }}
            />
            il tuo giro
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: REFERENCE }}
            />
            riferimento
          </span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="bg-muted/30 h-36 w-full rounded-lg border"
      >
        <polyline
          points={path((s) => s.referenceSpeedKmh)}
          fill="none"
          stroke={REFERENCE}
          strokeWidth={2}
          strokeOpacity={0.6}
        />
        <polyline
          points={path((s) => s.speedKmh)}
          fill="none"
          stroke={MINE}
          strokeWidth={2}
        />
      </svg>

      <div className="text-muted-foreground mt-1 flex justify-between font-mono text-xs">
        <span>{min.toFixed(0)} km/h</span>
        <span>{max.toFixed(0)} km/h</span>
      </div>
    </div>
  );
}

export default function ComparisonCard({
  comparison,
  isPending,
  error,
}: {
  comparison: LapComparison | null;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confronto con il riferimento</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {isPending && <Skeleton className="h-40 rounded-lg" />}

        {!isPending && error && (
          <p className="text-muted-foreground text-sm">{error}</p>
        )}

        {!isPending && !error && comparison && (
          <>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
              <span>
                Il tuo giro {comparison.lap.lapNumber}:{" "}
                <span className="font-mono tabular-nums">
                  {formatLapTime(comparison.lap.seconds)}
                </span>
              </span>

              <span className="text-muted-foreground">
                Riferimento
                {comparison.reference.driverName
                  ? ` (${comparison.reference.driverName})`
                  : ""}{" "}
                giro {comparison.reference.lapNumber}:{" "}
                <span className="font-mono tabular-nums">
                  {formatLapTime(comparison.reference.seconds)}
                </span>
              </span>

              <span
                className={`font-mono font-medium ${deltaClass(
                  comparison.gapSeconds
                )}`}
                style={deltaStyle(comparison.gapSeconds)}
              >
                {formatDelta(comparison.gapSeconds)}
              </span>
            </div>

            {!comparison.sameCar && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Le due auto sono diverse: traiettorie e punti di frenata
                restano confrontabili, le velocità molto meno.
              </p>
            )}

            {(comparison.lap.stopped || comparison.reference.stopped) && (
              <p className="text-destructive text-xs leading-relaxed">
                In uno dei due giri l'auto si è quasi fermata (testacoda,
                uscita o rientro): i secondi persi lì non dicono niente sulla
                guida.
              </p>
            )}

            <DeltaChart comparison={comparison} />
            <SpeedChart comparison={comparison} />

            {comparison.corners.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curva</TableHead>
                      <TableHead className="text-right">Sezione</TableHead>
                      <TableHead className="text-right">In curva</TableHead>
                      <TableHead className="text-right">In uscita</TableHead>
                      <TableHead className="text-right">Minima</TableHead>
                      <TableHead className="text-right">Staccata</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {comparison.corners.map((corner) => (
                      <TableRow
                        key={corner.number}
                        // Una sezione con un salto del canale distanza
                        // resta visibile ma smorzata: nasconderla
                        // farebbe sembrare che manchi una curva, darle
                        // lo stesso peso delle altre manderebbe il
                        // pilota a cercare tempo dove non c'e'.
                        className={corner.unreliable ? "opacity-50" : undefined}
                        title={
                          corner.unreliable
                            ? "Qui la distanza sul giro fa un salto in uno dei due file: il delta non è attendibile"
                            : undefined
                        }
                      >
                        <TableCell className="font-mono">
                          {corner.number}
                          {corner.unreliable && (
                            <span className="text-muted-foreground"> ⚠</span>
                          )}
                        </TableCell>

                        <TableCell
                          className={
                            corner.unreliable
                              ? "text-muted-foreground text-right font-mono"
                              : `text-right font-mono font-medium ${deltaClass(
                                  corner.sectionDeltaSeconds
                                )}`
                          }
                          style={
                            corner.unreliable
                              ? undefined
                              : deltaStyle(corner.sectionDeltaSeconds)
                          }
                        >
                          {formatDelta(corner.sectionDeltaSeconds)}
                        </TableCell>

                        <TableCell className="text-muted-foreground text-right font-mono text-xs">
                          {formatDelta(corner.deltaSeconds)}
                        </TableCell>

                        <TableCell className="text-muted-foreground text-right font-mono text-xs">
                          {formatDelta(corner.exitDeltaSeconds)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs">
                          {corner.minSpeedKmh ?? "—"}
                          <span className="text-muted-foreground">
                            {" "}
                            / {corner.referenceMinSpeedKmh ?? "—"}
                          </span>
                        </TableCell>

                        <TableCell className="text-muted-foreground text-right font-mono text-xs">
                          {corner.brakingDeltaM === null
                            ? "—"
                            : `${corner.brakingDeltaM > 0 ? "+" : ""}${
                                corner.brakingDeltaM
                              } m`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-muted-foreground text-xs leading-relaxed">
              Ogni sezione è una curva più il rettilineo che la segue: un'uscita
              lenta si paga nei metri dopo, non dentro la curva. Le sezioni
              sommate danno lo scarto totale. Nella colonna «Minima» il primo
              numero è il tuo, il secondo del riferimento; nella «Staccata», un
              valore positivo vuol dire che stacchi prima di lui.
            </p>

            {comparison.glitches.length > 0 && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Le righe segnate con ⚠ cadono dove il canale della distanza sul
                giro fa un salto in uno dei due file (
                {comparison.glitches
                  .map((g) => `${g.fromM}–${g.toM} m`)
                  .join(", ")}
                ): la posizione sul tracciato avanza più di quanto la velocità
                misurata permetta, e il tempo calcolato lì non regge. Non è un
                errore di guida, ed è escluso anche dall'analisi del coach.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
