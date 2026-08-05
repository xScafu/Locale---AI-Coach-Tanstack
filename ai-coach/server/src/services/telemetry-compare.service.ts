import {
  fetchChannelShapes,
  findAnalysableLaps,
  getLapChannelSeries,
  getMetadata,
  withConnection,
  type ChannelMeta,
} from "./telemetry.service";
import { namesMatch } from "./track-profile.service";
import { getReferenceImports } from "../repositories/telemetry.repository";
import { getTrackById } from "../repositories/track.repository";

// Confronto fra due giri: il tuo e uno di riferimento.
//
// Il confronto si fa per DISTANZA, non per tempo. Due giri dello stesso
// circuito passano dagli stessi punti ma in istanti diversi, e dopo la
// prima curva un allineamento temporale confronterebbe la tua staccata
// con l'uscita di curva dell'altro. Riportati entrambi su una griglia di
// metri dal traguardo, ogni confronto e' fra due auto nello stesso punto
// della pista.
//
// Da li' il numero che conta e' il **delta cumulativo**: quanto tempo hai
// perso o guadagnato dall'inizio del giro fino a quel punto. La sua
// pendenza dice dove il tempo se ne va davvero, che quasi mai coincide
// con il punto in cui te ne accorgi guidando.

// Passo della griglia. A 10Hz e 200 km/h un campione cade ogni 5.5 m,
// quindi scendere sotto i 5 metri non aggiunge informazione: interpola
// soltanto piu' fitto fra gli stessi dati.
const GRID_STEP_M = 5;

// Sopra questa soglia il freno e' considerato premuto, come nel resto
// del progetto.
const BRAKE_ON_PCT = 5;

export type ComparisonSample = {
  distanceM: number;
  deltaSeconds: number;
  speedKmh: number;
  referenceSpeedKmh: number;
  throttlePct: number;
  referenceThrottlePct: number;
  brakePct: number;
  referenceBrakePct: number;
};

export type CornerComparison = {
  number: number;
  entryM: number;
  exitM: number;
  // Tempo perso (positivo) o guadagnato (negativo) DENTRO la curva,
  // cioe' la variazione del delta cumulativo fra ingresso e uscita. Si
  // guarda la variazione e non il delta assoluto, che in un punto porta
  // con se' tutto quello che e' successo prima.
  deltaSeconds: number;
  // Quanto cambia il delta dall'uscita della curva all'ingresso della
  // successiva: e' il rettilineo, ed e' li' che si paga un'uscita lenta.
  exitDeltaSeconds: number;
  // La somma dei due. Le sezioni coprono il giro senza sovrapporsi,
  // quindi sommate danno lo scarto totale: e' quello che permette di
  // dire "questa curva vale mezzo secondo" senza che i conti restino
  // appesi.
  //
  // La sola finestra ingresso-uscita non basta: su un giro reale piu'
  // lento di 6.5s ne spiegava 1.5, perche' una curva sbagliata la si
  // paga soprattutto nei metri che seguono.
  sectionDeltaSeconds: number;
  minSpeedKmh: number | null;
  referenceMinSpeedKmh: number | null;
  brakingPointM: number | null;
  referenceBrakingPointM: number | null;
  // Positivo = stacchi PRIMA del riferimento, quindi piu' lontano dalla
  // curva.
  brakingDeltaM: number | null;
  // In questa sezione uno dei due giri ha un salto di "Lap Dist": il
  // delta c'e' ma non e' attendibile, e non va usato per dire al pilota
  // dove perde tempo.
  unreliable: boolean;
};

// Un giro in cui l'auto si e' quasi fermata non e' un giro lento: e' un
// testacoda, un'uscita o un rientro. Confrontarlo produce numeri esatti
// e consigli assurdi — su un file reale il giro 5 si ferma a 0.0 km/h e
// il confronto gli attribuisce 5.6 dei 6.5 secondi di scarto in una
// curva sola, che detto al pilota suonerebbe come "sei lento li'".
//
// La soglia sta sotto qualsiasi curva vera: il tornante piu' lento di
// COTA si percorre a 65 km/h.
const STOPPED_KMH = 20;

export type LapSummary = {
  importId: string | null;
  lapNumber: number;
  seconds: number;
  minSpeedKmh: number;
  // Vero se in qualche punto l'auto era praticamente ferma.
  stopped: boolean;
};

export type LapComparison = {
  lap: LapSummary;
  reference: LapSummary & {
    driverName: string | null;
    carName: string | null;
    recordingTime: string | null;
  };
  trackName: string | null;
  // Stesso circuito ma auto diverse: il confronto delle velocita' resta
  // leggibile solo in parte, e il coach deve saperlo.
  sameCar: boolean;
  gapSeconds: number;
  // I tratti dove almeno uno dei due giri ha un salto di "Lap Dist".
  glitches: { fromM: number; toM: number }[];
  // Il tratto dal traguardo alla prima curva, che non appartiene a
  // nessuna sezione. Senza di lui le sezioni non sommerebbero allo
  // scarto totale.
  beforeFirstCornerSeconds: number | null;
  lengthM: number;
  samples: ComparisonSample[];
  corners: CornerComparison[];
};

type LapGrid = {
  seconds: number;
  lengthM: number;
  gridFreq: number;
  distance: number[];
  speed: number[];
  throttle: number[];
  brake: number[];
  // Tratti in cui "Lap Dist" avanza piu' di quanto la velocita' misurata
  // permetta: li' il confronto per distanza non e' affidabile.
  glitches: { fromM: number; toM: number }[];
};

const CHANNELS = ["Lap Dist", "Ground Speed", "Throttle Pos", "Brake Pos"];

// Il giro migliore analizzabile del file, se non ne viene chiesto uno.
export async function findBestLapNumber(
  filePath: string
): Promise<number | null> {
  return withConnection(filePath, async (conn) => {
    const shapes = await fetchChannelShapes(conn);
    const channels: ChannelMeta[] = shapes;
    const gridFreq =
      shapes.find((s) => s.name === "GPS Latitude")?.frequency ?? 10;

    const { best } = await findAnalysableLaps(conn, channels, gridFreq);
    return best?.lapNumber ?? null;
  });
}

async function loadLapGrid(
  filePath: string,
  lapNumber: number
): Promise<LapGrid | null> {
  const series = await getLapChannelSeries(filePath, lapNumber, CHANNELS);

  const of = (name: string) =>
    series.find((s) => s.name === name)?.values[0] ?? null;

  const distance = of("Lap Dist");
  const speed = of("Ground Speed");

  // Senza distanza non c'e' griglia, senza velocita' non c'e' niente da
  // raccontare.
  if (!distance || !speed || distance.length < 2) return null;

  const gridFreq = series.find((s) => s.name === "Lap Dist")?.frequency ?? 10;
  const empty = distance.map(() => 0);

  return {
    seconds: distance.length / gridFreq,
    lengthM: Math.max(...distance),
    gridFreq,
    distance,
    speed,
    throttle: of("Throttle Pos") ?? empty,
    brake: of("Brake Pos") ?? empty,
    glitches: findDistanceGlitches(distance, speed, gridFreq),
  };
}

// Quanto "Lap Dist" e' incoerente con la velocita' misurata.
//
// Non e' distanza percorsa dall'auto: e' la sua posizione proiettata
// sulla linea del tracciato. Dove la pista si ripiega su se' stessa, o
// dove la traiettoria taglia, la proiezione puo' scattare in avanti di
// metri mentre l'auto va piano. Su un file reale lo stesso punto (3787 m
// a COTA) scatta di 9 metri in un decimo di secondo — 328 km/h — in tre
// giri diversi, con la velocita' ferma a 72 km/h.
//
// L'effetto sul confronto e' pesante: un salto in un giro solo produce
// un picco di quasi un secondo nel delta cumulativo, che poi rientra. Se
// lo si prendesse per buono, il pilota andrebbe a cercare un secondo in
// una curva dove non ha sbagliato niente.
//
// Da NON confondere con un testacoda, che e' un evento vero e va
// mostrato: li' la velocita' crolla verso lo zero e la distanza si
// ferma. Qui la velocita' non cambia e la distanza corre. Il segnale che
// distingue i due e' proprio il confronto fra i due canali.
function findDistanceGlitches(
  distance: number[],
  speed: number[],
  gridFreq: number
): { fromM: number; toM: number }[] {
  const ranges: { fromM: number; toM: number }[] = [];
  const step = 1 / gridFreq;

  for (let i = 1; i < distance.length; i++) {
    const advanced = distance[i] - distance[i - 1];

    // Quanto avrebbe potuto percorrere alla velocita' registrata.
    const expected = ((speed[i] + speed[i - 1]) / 2 / 3.6) * step;

    // Tolleranza larga: il doppio del previsto piu' un metro. Serve a
    // non segnalare il normale sfasamento fra un canale a 10Hz e uno a
    // 100Hz riportato sulla stessa griglia.
    if (advanced <= expected * 2 + 1) continue;

    const last = ranges[ranges.length - 1];

    if (last && distance[i - 1] - last.toM < 20) {
      last.toM = distance[i];
    } else {
      ranges.push({ fromM: distance[i - 1], toM: distance[i] });
    }
  }

  return ranges;
}

// L'istante (in secondi dall'inizio del giro) in cui il giro raggiunge
// una certa distanza, interpolando fra i due campioni che la
// racchiudono: a 10Hz un campione vale un decimo, troppo grosso per un
// confronto che si gioca sui centesimi.
//
// L'indice di partenza viene passato e restituito dal chiamante perche'
// la griglia si percorre in avanti: ricominciare la ricerca da zero a
// ogni punto renderebbe il calcolo quadratico.
//
// Andare solo in avanti regge anche il fatto che "Lap Dist" non e'
// perfettamente monotono: su un giro reale venti campioni su milleduecento
// arretrano, al massimo di 40 centimetri. Sono rumore e vengono ignorati.
// Un testacoda vero, con metri di arretramento, non lo si allinea per
// distanza in nessun modo — per quello c'e' il flag `stopped`.
function advanceTo(
  grid: LapGrid,
  target: number,
  from: number
): { index: number; seconds: number | null } {
  let i = Math.max(from, 1);

  while (i < grid.distance.length && grid.distance[i] < target) i++;

  if (i >= grid.distance.length) return { index: i, seconds: null };

  const previous = grid.distance[i - 1];
  const span = grid.distance[i] - previous;
  const ratio = span > 0 ? (target - previous) / span : 0;

  return { index: i, seconds: (i - 1 + ratio) / grid.gridFreq };
}

function valueAt(values: number[], index: number): number {
  return values[Math.min(Math.max(index, 0), values.length - 1)] ?? 0;
}

// Dove inizia la frenata che prepara una curva: si risale dall'ingresso
// senza mai superare l'uscita della curva precedente, altrimenti a una
// curva si attribuisce la staccata di quella prima. Stessa regola di
// computeTrackProfile, applicata pero' su una griglia di distanza.
function brakingPoint(
  grid: LapGrid,
  entryM: number,
  floorM: number
): number | null {
  let i = 0;
  while (i < grid.distance.length && grid.distance[i] < entryM) i++;
  if (i >= grid.distance.length) i = grid.distance.length - 1;

  // Indietro fino a trovare il freno premuto.
  let j = i;
  while (j > 0 && grid.distance[j] > floorM && grid.brake[j] <= BRAKE_ON_PCT) {
    j--;
  }

  if (grid.brake[j] <= BRAKE_ON_PCT) return null;

  // Ancora indietro fino a dove la frenata comincia.
  while (j > 0 && grid.distance[j] > floorM && grid.brake[j] > BRAKE_ON_PCT) {
    j--;
  }

  // Se ci siamo fermati perche' e' finito il tratto e non perche' il
  // freno si e' alzato, la staccata comincia prima dell'uscita della
  // curva precedente: e' una frenata continua fra due curve e il suo
  // inizio non appartiene a questa. Restituire il confine spaccerebbe
  // per punto di frenata un valore che e' solo il bordo della finestra
  // di ricerca — su un file reale faceva risultare una staccata 70 metri
  // piu' lunga di quella vera.
  if (grid.brake[j] > BRAKE_ON_PCT) return null;

  return Math.round(grid.distance[j]);
}

function minSpeedBetween(
  grid: LapGrid,
  fromM: number,
  toM: number
): number | null {
  let min: number | null = null;

  for (let i = 0; i < grid.distance.length; i++) {
    if (grid.distance[i] < fromM) continue;
    if (grid.distance[i] > toM) break;

    const v = grid.speed[i];
    if (min === null || v < min) min = v;
  }

  return min === null ? null : Math.round(min * 10) / 10;
}

export type TrackCornerLike = {
  number: number;
  entryM: number;
  exitM: number;
};

export type CompareOptions = {
  lapNumber?: number;
  referenceLapNumber?: number;
  // Le curve del profilo del circuito. La numerazione DEVE essere quella
  // gia' usata nel resto del prompt: il coach ha l'ordine di chiamare le
  // curve per numero, e due numerazioni diverse nello stesso contesto lo
  // farebbero contraddire.
  corners?: TrackCornerLike[];
  importId?: string | null;
  referenceImportId?: string | null;
};

// Un import qualsiasi, visto da qui: servono solo il file, il circuito e
// i metadata. Il tipo completo vive nel repository.
type ImportLike = {
  id: string;
  filePath: string;
  trackId: string | null;
  metadata: string | null;
};

function trackNameOf(item: ImportLike): string | null {
  if (!item.metadata) return null;

  try {
    return JSON.parse(item.metadata)["TrackName"] ?? null;
  } catch {
    return null;
  }
}

// Il riferimento da usare per un import: quello del suo circuito.
//
// Il trackId e' la via principale, ma un riferimento caricato prima che
// esistesse il circuito nell'app non ce l'ha: in quel caso si ricade sul
// nome del tracciato nei metadata, con lo stesso confronto tollerante
// usato ovunque nel progetto.
export async function findReferenceFor(item: ImportLike) {
  const references = await getReferenceImports();
  if (references.length === 0) return null;

  if (item.trackId) {
    const byTrack = references.find((r) => r.trackId === item.trackId);
    if (byTrack) return byTrack;
  }

  const trackName = trackNameOf(item);
  if (!trackName) return null;

  return (
    references.find((r) => {
      const name = trackNameOf(r);
      return name ? namesMatch(name, trackName) : false;
    }) ?? null
  );
}

// Le curve con cui spezzare il confronto: quelle del profilo del
// circuito, cioe' la STESSA numerazione che il coach usa nel resto del
// prompt. Ricavarle qui da uno dei due giri darebbe numeri diversi per
// le stesse curve, e il coach si contraddirebbe nella stessa risposta.
export async function cornersForImport(
  item: ImportLike
): Promise<TrackCornerLike[]> {
  if (!item.trackId) return [];

  try {
    const track = await getTrackById(item.trackId);
    if (!track?.profile) return [];

    const profile = JSON.parse(track.profile);

    return (profile.corners ?? []).map((c: any) => ({
      number: c.number,
      entryM: c.entryM,
      exitM: c.exitM,
    }));
  } catch {
    return [];
  }
}

export async function compareLaps(
  filePath: string,
  referenceFilePath: string,
  options: CompareOptions = {}
): Promise<LapComparison | null> {
  const [lapNumber, referenceLapNumber] = await Promise.all([
    options.lapNumber ?? findBestLapNumber(filePath),
    options.referenceLapNumber ?? findBestLapNumber(referenceFilePath),
  ]);

  if (!lapNumber || !referenceLapNumber) return null;

  const [mine, reference] = await Promise.all([
    loadLapGrid(filePath, lapNumber),
    loadLapGrid(referenceFilePath, referenceLapNumber),
  ]);

  if (!mine || !reference) return null;

  const [metadata, referenceMetadata] = await Promise.all([
    getMetadata(filePath).catch(() => ({}) as Record<string, string>),
    getMetadata(referenceFilePath).catch(() => ({}) as Record<string, string>),
  ]);

  // Confrontare due circuiti diversi produrrebbe numeri perfettamente
  // formati e completamente falsi: meglio non restituire niente.
  const trackName = metadata["TrackName"] ?? null;
  const referenceTrackName = referenceMetadata["TrackName"] ?? null;

  if (
    trackName &&
    referenceTrackName &&
    !namesMatch(trackName, referenceTrackName)
  ) {
    return null;
  }

  // Anche a parita' di nome, due giri che misurano lunghezze molto
  // diverse sono varianti diverse dello stesso circuito.
  const lengthM = Math.min(mine.lengthM, reference.lengthM);

  if (Math.abs(mine.lengthM - reference.lengthM) > lengthM * 0.05) {
    return null;
  }

  const samples: ComparisonSample[] = [];

  let mineIndex = 1;
  let referenceIndex = 1;
  let lastDelta = 0;

  for (let d = 0; d <= lengthM; d += GRID_STEP_M) {
    const a = advanceTo(mine, d, mineIndex);
    const b = advanceTo(reference, d, referenceIndex);

    mineIndex = a.index;
    referenceIndex = b.index;

    if (a.seconds === null || b.seconds === null) break;

    lastDelta = a.seconds - b.seconds;

    samples.push({
      distanceM: d,
      deltaSeconds: Math.round(lastDelta * 1000) / 1000,
      speedKmh: Math.round(valueAt(mine.speed, a.index) * 10) / 10,
      referenceSpeedKmh:
        Math.round(valueAt(reference.speed, b.index) * 10) / 10,
      throttlePct: Math.round(valueAt(mine.throttle, a.index)),
      referenceThrottlePct: Math.round(valueAt(reference.throttle, b.index)),
      brakePct: Math.round(valueAt(mine.brake, a.index)),
      referenceBrakePct: Math.round(valueAt(reference.brake, b.index)),
    });
  }

  if (samples.length === 0) return null;

  // Il delta a una certa distanza, letto dai campioni gia' calcolati.
  function deltaAt(distanceM: number): number {
    const index = Math.min(
      Math.max(Math.round(distanceM / GRID_STEP_M), 0),
      samples.length - 1
    );

    return samples[index].deltaSeconds;
  }

  // Un salto in uno solo dei due giri basta a rendere inattendibile il
  // confronto in quel tratto.
  const glitches = [...mine.glitches, ...reference.glitches].sort(
    (a, b) => a.fromM - b.fromM
  );

  const overlapsGlitch = (fromM: number, toM: number) =>
    glitches.some((g) => g.fromM <= toM && g.toM >= fromM);

  const cornerList = options.corners ?? [];
  const corners: CornerComparison[] = cornerList.map((corner, n) => {
    const floorM = n > 0 ? cornerList[n - 1].exitM : 0;

    // La sezione di una curva finisce dove comincia quella dopo, cosi'
    // le sezioni piastrellano il giro senza buchi ne' sovrapposizioni.
    const sectionEndM = cornerList[n + 1]?.entryM ?? lengthM;

    const braking = brakingPoint(mine, corner.entryM, floorM);
    const referenceBraking = brakingPoint(reference, corner.entryM, floorM);

    const insideDelta = deltaAt(corner.exitM) - deltaAt(corner.entryM);
    const sectionDelta = deltaAt(sectionEndM) - deltaAt(corner.entryM);

    return {
      number: corner.number,
      entryM: corner.entryM,
      exitM: corner.exitM,
      deltaSeconds: Math.round(insideDelta * 1000) / 1000,
      exitDeltaSeconds: Math.round((sectionDelta - insideDelta) * 1000) / 1000,
      sectionDeltaSeconds: Math.round(sectionDelta * 1000) / 1000,
      minSpeedKmh: minSpeedBetween(mine, corner.entryM, corner.exitM),
      referenceMinSpeedKmh: minSpeedBetween(
        reference,
        corner.entryM,
        corner.exitM
      ),
      brakingPointM: braking,
      referenceBrakingPointM: referenceBraking,
      brakingDeltaM:
        braking !== null && referenceBraking !== null
          ? referenceBraking - braking
          : null,
      unreliable: overlapsGlitch(corner.entryM, sectionEndM),
    };
  });

  const carName = metadata["CarName"] ?? null;
  const referenceCarName = referenceMetadata["CarName"] ?? null;

  const summarise = (grid: LapGrid, lap: number, importId: string | null) => {
    const minSpeedKmh = Math.round(Math.min(...grid.speed) * 10) / 10;

    return {
      importId,
      lapNumber: lap,
      seconds: Math.round(grid.seconds * 1000) / 1000,
      minSpeedKmh,
      stopped: minSpeedKmh < STOPPED_KMH,
    };
  };

  return {
    lap: summarise(mine, lapNumber, options.importId ?? null),
    reference: {
      ...summarise(
        reference,
        referenceLapNumber,
        options.referenceImportId ?? null
      ),
      driverName: referenceMetadata["DriverName"] ?? null,
      carName: referenceCarName,
      // "2026-08-04T23_00_03Z" cosi' com'e' nel file: serve a distinguere
      // due sessioni dello stesso pilota, che altrimenti nel prompt
      // sembrano la stessa cosa.
      recordingTime: referenceMetadata["RecordingTime"] ?? null,
    },
    trackName: trackName ?? referenceTrackName,
    sameCar:
      !!carName && !!referenceCarName && namesMatch(carName, referenceCarName),
    // Lo scarto vero e' la differenza dei tempi sul giro, non l'ultimo
    // delta campionato: la griglia si ferma al metro piu' vicino sotto
    // la lunghezza minore dei due giri.
    gapSeconds: Math.round((mine.seconds - reference.seconds) * 1000) / 1000,
    glitches: glitches.map((g) => ({
      fromM: Math.round(g.fromM),
      toM: Math.round(g.toM),
    })),
    beforeFirstCornerSeconds:
      cornerList.length > 0
        ? Math.round(deltaAt(cornerList[0].entryM) * 1000) / 1000
        : null,
    lengthM: Math.round(lengthM),
    samples,
    corners,
  };
}
