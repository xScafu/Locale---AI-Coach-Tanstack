import type duckdb from "duckdb";

import {
  analysableLaps,
  computeLapSegments,
  fetchChannelShapes,
  queryAll,
  withConnection,
  type ChannelMeta,
  type ChannelShape,
  type LapSegment,
} from "./telemetry.service";

// Il riassunto della telemetria che finisce nel prompt del coach.
//
// Non sono i dati grezzi: un giro di COTA sono 11.800 campioni per
// canale e cinquantotto canali, che nel prompt non ci starebbero e non
// servirebbero comunque a niente. Qui c'e' una riga per giro piu' il
// giro migliore aperto per famiglia — gomme, freno, energia, guida —
// che e' il modo in cui un ingegnere di pista guarda uno stint.
//
// Ogni campo e' nullable perche' i file cambiano da auto ad auto: una
// GT3 non ha ne' Virtual Energy ne' Regen Rate, e una sezione mancante
// deve sparire dal prompt invece di comparire come "0".

// Ordine delle ruote in tutto il file: AS, AD, PS, PD.
export type WheelValues = [number, number, number, number];

export type LapRow = {
  lapNumber: number;
  lapTimeSeconds: number;
  isBest: boolean;
  topSpeedKmh: number | null;
  tyreTempC: WheelValues | null;
  brakeTempC: WheelValues | null;
  virtualEnergyDeltaPct: number | null;
  tcActivePct: number | null;
  offTrackSeconds: number | null;
};

export type TyreDetail = {
  avgTempC: WheelValues;
  peakTempC: WheelValues;
  // Battistrada interno meno esterno, per ruota. Positivo = l'interno
  // lavora piu' caldo, cioe' troppo camber negativo (o troppa pressione
  // sul fianco interno). E' la lettura che collega la telemetria alle
  // colonne di camber del setup.
  innerMinusOuterC: WheelValues | null;
  pressureKPa: WheelValues | null;
  wearPct: WheelValues | null;
};

export type BrakingDetail = {
  maxPressurePct: number;
  avgPressureWhileBrakingPct: number;
  brakingSeconds: number;
  brakingSharePct: number;
  // Freno ancora premuto mentre l'auto e' gia' oltre soglia di carico
  // laterale: e' il trail braking, misurato invece che dedotto.
  trailBrakingSharePct: number | null;
  avgTrailPressurePct: number | null;
  // Gas e freno premuti insieme. Un po' e' tecnica, molto e' tempo perso.
  pedalOverlapSeconds: number;
  lockupCount: number | null;
  lockupSeconds: number | null;
  frontTempC: [number, number] | null;
  rearTempC: [number, number] | null;
  biasRearPct: number | null;
  migration: number | null;
};

export type EnergyDetail = {
  virtualEnergyFromPct: number | null;
  virtualEnergyToPct: number | null;
  socFromPct: number | null;
  socToPct: number | null;
  socMinPct: number | null;
  avgRecoveryKw: number | null;
  avgDeploymentKw: number | null;
  maxRpm: number | null;
  engineMaxRpm: number | null;
  shifts: number | null;
  maxGear: number | null;
  fuelUsedL: number | null;
  waterTempC: number | null;
  oilTempC: number | null;
};

export type HandlingDetail = {
  // Il gas che il pilota chiede col piede contro quello che arriva al
  // motore: la differenza e' il controllo di trazione. Sono due canali
  // diversi del file, non una stima.
  requestedThrottlePct: number | null;
  deliveredThrottlePct: number | null;
  tcActiveSharePct: number | null;
  maxSteeringPct: number | null;
  steeringReversals: number | null;
  avgSteeringRatePctPerSec: number | null;
  // Tutte e quattro le ruote oltre l'asfalto.
  offTrackSeconds: number | null;
  offTrackEpisodes: number | null;
  // Almeno una ruota fuori: sono soprattutto i cordoli, e vale come
  // misura di quanto il pilota usa i bordi della pista.
  onKerbSeconds: number | null;
  minFrontRideHeightMm: number | null;
  minRearRideHeightMm: number | null;
  maxLatG: number | null;
  maxBrakingG: number | null;
};

export type ElectronicsSetup = {
  tcLevel: number | null;
  tcCut: number | null;
  tcSlipAngle: number | null;
  absLevel: number | null;
  fuelMixtureMap: number | null;
};

export type TelemetryDigest = {
  trackName: string | null;
  carName: string | null;
  sessionType: string | null;
  weather: string | null;
  airTempC: number | null;
  trackTempC: number | null;
  lapsInFile: number;
  lapsAnalyzed: number;
  bestLapNumber: number | null;
  bestLapSeconds: number | null;
  laps: LapRow[];
  electronics: ElectronicsSetup | null;
  tyres: TyreDetail | null;
  braking: BrakingDetail | null;
  energy: EnergyDetail | null;
  handling: HandlingDetail | null;
};

// Stessa logica di cache di getTelemetrySummary: un nuovo import produce
// sempre un nuovo filePath, quindi il digest non va mai invalidato.
const digestCache = new Map<string, TelemetryDigest>();

export function forgetDigest(filePath: string) {
  digestCache.delete(filePath);
}

// ---------------------------------------------------------------------
// Lettura dei canali
// ---------------------------------------------------------------------

type Channel = { freq: number; columns: number[][] };

async function readChannel(
  conn: duckdb.Connection,
  shape: ChannelShape | undefined,
  startIdx?: number,
  endIdx?: number
): Promise<Channel | null> {
  if (!shape || shape.columns.length === 0) return null;

  const selected = shape.columns
    .map((c, i) => `CAST("${c}" AS DOUBLE) AS c${i}`)
    .join(", ");

  const where =
    startIdx === undefined || endIdx === undefined
      ? ""
      : `WHERE __idx BETWEEN ${startIdx} AND ${endIdx}`;

  const rows = await queryAll<Record<string, number>>(
    conn,
    `SELECT ${selected} FROM (
       SELECT *, ROW_NUMBER() OVER () - 1 AS __idx FROM "${shape.name}"
     ) ${where} ORDER BY __idx ASC`
  );

  if (rows.length === 0) return null;

  return {
    freq: shape.frequency,
    columns: shape.columns.map((_, i) => rows.map((r) => r[`c${i}`])),
  };
}

// Un canale letto per intero non e' allineato con gli altri: ognuno ha la
// sua frequenza. L'accesso avviene percio' sempre per ISTANTE, mai per
// indice, e l'istante di riferimento e' quello della griglia a 10Hz di
// "Lap Dist" gia' usata per i confini dei giri.
function sampler(channel: Channel | null, column = 0) {
  if (!channel || !channel.columns[column]) return null;

  const values = channel.columns[column];
  const { freq } = channel;

  return {
    freq,
    values,
    at(seconds: number): number {
      const idx = Math.round(seconds * freq);
      return values[Math.min(Math.max(idx, 0), values.length - 1)];
    },
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round(value: number | null | undefined, digits = 1): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function wheelValues(
  channel: Channel | null,
  reduce: (values: number[]) => number | null,
  digits = 1
): WheelValues | null {
  if (!channel || channel.columns.length !== 4) return null;

  const out = channel.columns.map((column) => round(reduce(column), digits));
  if (out.some((v) => v === null)) return null;

  return out as WheelValues;
}

// ---------------------------------------------------------------------
// Eventi
// ---------------------------------------------------------------------

// Gli "eventi" del file non sono quasi mai eventi: trentacinque delle
// quaranta tabelle contengono una riga sola, scritta all'avvio della
// sessione. Sono le REGOLAZIONI con cui il pilota e' sceso in pista —
// livello di TC, di ABS, ripartitore di frenata, mappa carburante — e al
// coach servono, perche' spiegano comportamenti che altrimenti
// attribuirebbe al setup meccanico.
async function readEventScalar(
  conn: duckdb.Connection,
  eventNames: Set<string>,
  name: string
): Promise<number | null> {
  if (!eventNames.has(name)) return null;

  try {
    const rows = await queryAll<{ v: number }>(
      conn,
      `SELECT CAST(value AS DOUBLE) AS v FROM "${name}" ORDER BY ts ASC LIMIT 1`
    );

    return rows.length > 0 && Number.isFinite(rows[0].v) ? rows[0].v : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------

const LAT_G_CORNERING = 0.6;
const BRAKE_ON_PCT = 5;
const THROTTLE_ON_PCT = 5;
// Sotto l'85% della velocita' dell'auto la ruota sta strisciando, non
// rotolando. Piu' in alto si conterebbero le normali differenze tra
// ruote interne ed esterne in curva.
const LOCKUP_RATIO = 0.85;
const LOCKUP_MIN_SPEED_KMH = 30;
// Un'inversione sotto il 3% della corsa e' rumore del volante, non una
// correzione del pilota.
const STEERING_REVERSAL_PCT = 3;

export async function getTelemetryDigest(
  filePath: string
): Promise<TelemetryDigest | null> {
  const cached = digestCache.get(filePath);
  if (cached) return cached;

  const digest = await withConnection(filePath, (conn) =>
    computeDigest(conn)
  );

  if (digest) digestCache.set(filePath, digest);
  return digest;
}

async function computeDigest(
  conn: duckdb.Connection
): Promise<TelemetryDigest | null> {
  const shapes = await fetchChannelShapes(conn);
  const shapeOf = (name: string) => shapes.find((s) => s.name === name);

  const metadataRows = await queryAll<{ key: string; value: string }>(
    conn,
    `SELECT "key", "value" FROM metadata`
  );
  const metadata: Record<string, string> = {};
  for (const row of metadataRows) metadata[row.key] = row.value;

  const channels: ChannelMeta[] = shapes;
  const segments = await computeLapSegments(conn, channels);
  const gridFreq =
    shapes.find((s) => s.name === "GPS Latitude")?.frequency ?? 10;

  // Stesso filtro del resto del progetto: via il primo e l'ultimo giro,
  // e via i frammenti sotto i venti secondi.
  const valid = analysableLaps(segments).filter(
    (s) => (s.endIdx - s.startIdx + 1) / gridFreq >= 20
  );

  if (valid.length === 0) return null;

  const best = valid.reduce((b, c) =>
    c.endIdx - c.startIdx < b.endIdx - b.startIdx ? c : b
  );

  // Canali che servono su TUTTI i giri: letti per intero una volta sola
  // e affettati per giro. Gli altri si leggono solo sull'intervallo del
  // giro migliore, perche' caricare venticinque canali interi vorrebbe
  // dire marshallare milioni di righe dal driver.
  const wholeNames = [
    "Ground Speed",
    "TyresTempCentre",
    "Brakes Temp",
    "Virtual Energy",
    "TC",
    "SurfaceTypes",
  ];

  const whole = new Map<string, Channel | null>();
  for (const name of wholeNames) {
    whole.set(name, await readChannel(conn, shapeOf(name)));
  }

  const laps: LapRow[] = valid.map((segment) =>
    buildLapRow(segment, best, whole, gridFreq)
  );

  const eventNames = new Set(
    (
      await queryAll<{ eventName: string }>(
        conn,
        `SELECT "eventName" FROM "eventsList"`
      )
    ).map((r) => r.eventName)
  );

  const electronics = await readElectronics(conn, eventNames);

  const detail = await computeBestLapDetail(
    conn,
    shapes,
    best,
    gridFreq,
    whole,
    eventNames
  );

  // Aria e asfalto cambiano appena nell'arco di uno stint (in un file
  // reale 29.1-29.5 C e 36.20-36.21 C): la media della sessione basta e
  // avanza, e sta in una riga sola del prompt.
  const ambient = await readChannel(conn, shapeOf("Ambient Temperature"));
  const trackTemp = await readChannel(conn, shapeOf("Track Temperature"));

  return {
    trackName: metadata["TrackName"] ?? null,
    carName: metadata["CarName"] ?? null,
    sessionType: metadata["SessionType"] ?? null,
    weather: metadata["WeatherConditions"] ?? null,
    airTempC: round(average(ambient?.columns[0] ?? [])),
    trackTempC: round(average(trackTemp?.columns[0] ?? [])),
    lapsInFile: segments.length,
    lapsAnalyzed: valid.length,
    bestLapNumber: best.lapNumber,
    bestLapSeconds: round(
      (best.endIdx - best.startIdx + 1) / gridFreq,
      3
    ),
    laps,
    electronics,
    ...detail,
  };
}

// Da un intervallo della griglia 10Hz all'intervallo di indici di un
// canale con la sua frequenza.
function rangeFor(segment: LapSegment, gridFreq: number, freq: number) {
  const startTs = segment.startIdx / gridFreq;
  const endTs = (segment.endIdx + 1) / gridFreq;

  const start = Math.floor(startTs * freq);
  const end = Math.max(start, Math.ceil(endTs * freq) - 1);

  return { start, end, startTs, endTs };
}

function sliceChannel(
  channel: Channel | null,
  segment: LapSegment,
  gridFreq: number
): Channel | null {
  if (!channel) return null;

  const { start, end } = rangeFor(segment, gridFreq, channel.freq);

  return {
    freq: channel.freq,
    columns: channel.columns.map((column) =>
      column.slice(start, Math.min(end + 1, column.length))
    ),
  };
}

function buildLapRow(
  segment: LapSegment,
  best: LapSegment,
  whole: Map<string, Channel | null>,
  gridFreq: number
): LapRow {
  const speed = sliceChannel(whole.get("Ground Speed") ?? null, segment, gridFreq);
  const tyres = sliceChannel(whole.get("TyresTempCentre") ?? null, segment, gridFreq);
  const brakes = sliceChannel(whole.get("Brakes Temp") ?? null, segment, gridFreq);
  const energy = sliceChannel(whole.get("Virtual Energy") ?? null, segment, gridFreq);
  const tc = sliceChannel(whole.get("TC") ?? null, segment, gridFreq);
  const surface = sliceChannel(whole.get("SurfaceTypes") ?? null, segment, gridFreq);

  const energyValues = energy?.columns[0] ?? [];
  const tcValues = tc?.columns[0] ?? [];

  return {
    lapNumber: segment.lapNumber,
    lapTimeSeconds:
      Math.round(((segment.endIdx - segment.startIdx + 1) / gridFreq) * 1000) /
      1000,
    isBest: segment.lapNumber === best.lapNumber,
    topSpeedKmh: speed?.columns[0]?.length
      ? round(Math.max(...speed.columns[0]))
      : null,
    tyreTempC: wheelValues(tyres, average, 0),
    brakeTempC: wheelValues(brakes, average, 0),
    virtualEnergyDeltaPct:
      energyValues.length > 1
        ? round(energyValues[energyValues.length - 1] - energyValues[0], 2)
        : null,
    tcActivePct: tcValues.length
      ? round((tcValues.filter((v) => v > 0).length / tcValues.length) * 100)
      : null,
    offTrackSeconds: surface ? round(offTrack(surface).seconds, 1) : null,
  };
}

// Fuori dall'asfalto: SurfaceTypes vale 0 sul tracciato e un codice
// diverso su ogni altra superficie. I codici non sono documentati nel
// file, quindi non si prova a dargli un nome.
//
// Quello che conta e' la differenza tra UNA ruota e TUTTE E QUATTRO.
// Su un file reale "almeno una ruota" fa 119 secondi su 817, il 15%
// della sessione: sono i cordoli, cioe' guida normale, e presentarli al
// coach come fuori pista lo porterebbe a rimproverare il pilota a ogni
// giro. "Tutte e quattro" fa 4.8 secondi ed e' il fuori pista vero,
// quello che nel regolamento costa il tempo sul giro.
//
// Le due misure non sono simmetriche nemmeno per ruota: le destre
// stanno fuori tre volte piu' delle sinistre (327 campioni contro 98),
// perche' i cordoli si prendono da un lato solo.
function offTrack(surface: Channel) {
  const length = Math.min(...surface.columns.map((c) => c.length));
  let allWheelsSamples = 0;
  let anyWheelSamples = 0;
  let episodes = 0;
  let outside = false;

  for (let i = 0; i < length; i++) {
    const any = surface.columns.some((column) => column[i] !== 0);
    const all = surface.columns.every((column) => column[i] !== 0);

    if (any) anyWheelSamples++;

    if (all) {
      allWheelsSamples++;
      if (!outside) episodes++;
      outside = true;
    } else {
      outside = false;
    }
  }

  return {
    seconds: allWheelsSamples / surface.freq,
    anyWheelSeconds: anyWheelSamples / surface.freq,
    episodes,
  };
}

async function readElectronics(
  conn: duckdb.Connection,
  eventNames: Set<string>
): Promise<ElectronicsSetup | null> {
  const [tcLevel, tcCut, tcSlipAngle, absLevel, fuelMixtureMap] =
    await Promise.all([
      readEventScalar(conn, eventNames, "TCLevel"),
      readEventScalar(conn, eventNames, "TCCut"),
      readEventScalar(conn, eventNames, "TCSlipAngle"),
      readEventScalar(conn, eventNames, "ABSLevel"),
      readEventScalar(conn, eventNames, "FuelMixtureMap"),
    ]);

  const electronics = {
    tcLevel,
    tcCut,
    tcSlipAngle,
    absLevel,
    fuelMixtureMap,
  };

  return Object.values(electronics).some((v) => v !== null)
    ? electronics
    : null;
}

async function computeBestLapDetail(
  conn: duckdb.Connection,
  shapes: ChannelShape[],
  best: LapSegment,
  gridFreq: number,
  whole: Map<string, Channel | null>,
  eventNames: Set<string>
): Promise<{
  tyres: TyreDetail | null;
  braking: BrakingDetail | null;
  energy: EnergyDetail | null;
  handling: HandlingDetail | null;
}> {
  const shapeOf = (name: string) => shapes.find((s) => s.name === name);

  // I canali che servono solo sul giro migliore si leggono gia'
  // ritagliati: una query per canale su poche migliaia di righe invece
  // che sull'intera sessione.
  async function lapChannel(name: string): Promise<Channel | null> {
    const shape = shapeOf(name);
    if (!shape) return null;

    const { start, end } = rangeFor(best, gridFreq, shape.frequency);
    return readChannel(conn, shape, start, end);
  }

  const { startTs, endTs } = rangeFor(best, gridFreq, gridFreq);
  const lapSeconds = endTs - startTs;

  const [
    brakeCh,
    throttleCh,
    throttleRawCh,
    latGCh,
    longGCh,
    steeringCh,
    wheelSpeedCh,
    tyreLeftCh,
    tyreRightCh,
    pressureCh,
    wearCh,
    socCh,
    regenCh,
    rpmCh,
    fuelCh,
    waterCh,
    oilCh,
    frontHeightCh,
    rearHeightCh,
  ] = await Promise.all([
    lapChannel("Brake Pos"),
    lapChannel("Throttle Pos"),
    lapChannel("Throttle Pos Unfiltered"),
    lapChannel("G Force Lat"),
    lapChannel("G Force Long"),
    lapChannel("Steering Pos"),
    lapChannel("Wheel Speed"),
    lapChannel("TyresTempLeft"),
    lapChannel("TyresTempRight"),
    lapChannel("TyresPressure"),
    lapChannel("Tyres Wear"),
    lapChannel("SoC"),
    lapChannel("Regen Rate"),
    lapChannel("Engine RPM"),
    lapChannel("Fuel Level"),
    lapChannel("Engine Water Temp"),
    lapChannel("Engine Oil Temp"),
    lapChannel("FrontRideHeight"),
    lapChannel("RearRideHeight"),
  ]);

  const speedCh = sliceChannel(whole.get("Ground Speed") ?? null, best, gridFreq);
  const tyreCentreCh = sliceChannel(
    whole.get("TyresTempCentre") ?? null,
    best,
    gridFreq
  );
  const brakeTempCh = sliceChannel(whole.get("Brakes Temp") ?? null, best, gridFreq);
  const energyCh = sliceChannel(whole.get("Virtual Energy") ?? null, best, gridFreq);
  const tcCh = sliceChannel(whole.get("TC") ?? null, best, gridFreq);
  const surfaceCh = sliceChannel(whole.get("SurfaceTypes") ?? null, best, gridFreq);

  return {
    tyres: buildTyres(tyreCentreCh, tyreLeftCh, tyreRightCh, pressureCh, wearCh),
    braking: await buildBraking(
      conn,
      eventNames,
      brakeCh,
      throttleCh,
      latGCh,
      speedCh,
      wheelSpeedCh,
      brakeTempCh,
      lapSeconds
    ),
    energy: await buildEnergy(
      conn,
      eventNames,
      energyCh,
      socCh,
      regenCh,
      brakeCh,
      throttleCh,
      rpmCh,
      fuelCh,
      waterCh,
      oilCh,
      best,
      gridFreq
    ),
    handling: buildHandling(
      throttleCh,
      throttleRawCh,
      tcCh,
      steeringCh,
      surfaceCh,
      frontHeightCh,
      rearHeightCh,
      latGCh,
      longGCh
    ),
  };
}

function buildTyres(
  centre: Channel | null,
  left: Channel | null,
  right: Channel | null,
  pressure: Channel | null,
  wear: Channel | null
): TyreDetail | null {
  if (!centre || centre.columns.length !== 4) return null;

  const avgTempC = wheelValues(centre, average, 0);
  const peakTempC = wheelValues(centre, (v) => (v.length ? Math.max(...v) : null), 0);

  if (!avgTempC || !peakTempC) return null;

  // "Interno" ed "esterno" dipendono dal lato dell'auto: sulla ruota
  // sinistra il bordo interno e' quello destro, sulla destra e'
  // l'opposto. Senza questa inversione i due lati darebbero letture di
  // camber di segno opposto pur avendo lo stesso problema.
  let innerMinusOuterC: WheelValues | null = null;

  if (left?.columns.length === 4 && right?.columns.length === 4) {
    const leftAvg = left.columns.map((c) => average(c));
    const rightAvg = right.columns.map((c) => average(c));

    if (leftAvg.every((v) => v !== null) && rightAvg.every((v) => v !== null)) {
      innerMinusOuterC = [0, 1, 2, 3].map((wheel) => {
        const isLeftSideWheel = wheel === 0 || wheel === 2;
        const inner = isLeftSideWheel ? rightAvg[wheel]! : leftAvg[wheel]!;
        const outer = isLeftSideWheel ? leftAvg[wheel]! : rightAvg[wheel]!;
        return round(inner - outer, 1)!;
      }) as WheelValues;
    }
  }

  return {
    avgTempC,
    peakTempC,
    innerMinusOuterC,
    pressureKPa: wheelValues(pressure, average, 1),
    // L'usura interessa a fine giro, non in media: e' un valore che solo
    // cala.
    wearPct: wheelValues(
      wear,
      (v) => (v.length ? v[v.length - 1] : null),
      1
    ),
  };
}

async function buildBraking(
  conn: duckdb.Connection,
  eventNames: Set<string>,
  brake: Channel | null,
  throttle: Channel | null,
  latG: Channel | null,
  speed: Channel | null,
  wheelSpeed: Channel | null,
  brakeTemp: Channel | null,
  lapSeconds: number
): Promise<BrakingDetail | null> {
  const brakeSampler = sampler(brake);
  if (!brakeSampler) return null;

  const throttleSampler = sampler(throttle);
  const latGSampler = sampler(latG);

  let brakingSamples = 0;
  let brakeSum = 0;
  let overlapSamples = 0;
  let corneringSamples = 0;
  let trailSamples = 0;
  let trailSum = 0;

  for (let i = 0; i < brakeSampler.values.length; i++) {
    const t = i / brakeSampler.freq;
    const value = brakeSampler.values[i];
    const cornering =
      latGSampler !== null &&
      Math.abs(latGSampler.at(t)) > LAT_G_CORNERING;

    if (cornering) corneringSamples++;

    if (value > BRAKE_ON_PCT) {
      brakingSamples++;
      brakeSum += value;

      if (cornering) {
        trailSamples++;
        trailSum += value;
      }

      if (throttleSampler && throttleSampler.at(t) > THROTTLE_ON_PCT) {
        overlapSamples++;
      }
    }
  }

  const lockups = countLockups(brakeSampler, speed, wheelSpeed);

  const [biasRear, migration] = await Promise.all([
    readEventScalar(conn, eventNames, "Brake Bias Rear"),
    readEventScalar(conn, eventNames, "Brake Migration"),
  ]);

  const frontTemps = brakeTemp?.columns.length === 4
    ? ([
        round(Math.max(...brakeTemp.columns[0]), 0),
        round(Math.max(...brakeTemp.columns[1]), 0),
      ] as [number, number])
    : null;

  const rearTemps = brakeTemp?.columns.length === 4
    ? ([
        round(Math.max(...brakeTemp.columns[2]), 0),
        round(Math.max(...brakeTemp.columns[3]), 0),
      ] as [number, number])
    : null;

  return {
    maxPressurePct: round(Math.max(...brakeSampler.values))!,
    avgPressureWhileBrakingPct:
      brakingSamples > 0 ? round(brakeSum / brakingSamples)! : 0,
    brakingSeconds: round(brakingSamples / brakeSampler.freq)!,
    brakingSharePct:
      lapSeconds > 0
        ? round((brakingSamples / brakeSampler.freq / lapSeconds) * 100)!
        : 0,
    trailBrakingSharePct:
      corneringSamples > 0
        ? round((trailSamples / corneringSamples) * 100)
        : null,
    avgTrailPressurePct:
      trailSamples > 0 ? round(trailSum / trailSamples) : null,
    pedalOverlapSeconds: round(overlapSamples / brakeSampler.freq, 2)!,
    lockupCount: lockups?.count ?? null,
    lockupSeconds: lockups ? round(lockups.seconds, 2) : null,
    frontTempC: frontTemps,
    rearTempC: rearTemps,
    // Nel file il ripartitore e' una frazione (0.454), non una
    // percentuale.
    biasRearPct: biasRear !== null ? round(biasRear * 100) : null,
    migration,
  };
}

// Una ruota che gira molto piu' piano dell'auto mentre il pilota frena
// sta strisciando. Si contano gli episodi, non i campioni: un bloccaggio
// di mezzo secondo e' un evento solo, ma a 100Hz sarebbero cinquanta.
function countLockups(
  brake: NonNullable<ReturnType<typeof sampler>>,
  speed: Channel | null,
  wheelSpeed: Channel | null
): { count: number; seconds: number } | null {
  const speedSampler = sampler(speed);
  if (!speedSampler || !wheelSpeed || wheelSpeed.columns.length !== 4) {
    return null;
  }

  const length = Math.min(...wheelSpeed.columns.map((c) => c.length));
  let count = 0;
  let samples = 0;
  let locked = false;

  for (let i = 0; i < length; i++) {
    const t = i / wheelSpeed.freq;
    const kmh = speedSampler.at(t);

    if (kmh < LOCKUP_MIN_SPEED_KMH || brake.at(t) <= BRAKE_ON_PCT) {
      locked = false;
      continue;
    }

    // Wheel Speed e' in m/s, Ground Speed in km/h.
    const slipping = wheelSpeed.columns.some(
      (column) => column[i] * 3.6 < kmh * LOCKUP_RATIO
    );

    if (slipping) {
      samples++;
      if (!locked) count++;
      locked = true;
    } else {
      locked = false;
    }
  }

  return { count, seconds: samples / wheelSpeed.freq };
}

async function buildEnergy(
  conn: duckdb.Connection,
  eventNames: Set<string>,
  virtualEnergy: Channel | null,
  soc: Channel | null,
  regen: Channel | null,
  brake: Channel | null,
  throttle: Channel | null,
  rpm: Channel | null,
  fuel: Channel | null,
  water: Channel | null,
  oil: Channel | null,
  best: LapSegment,
  gridFreq: number
): Promise<EnergyDetail | null> {
  const first = (channel: Channel | null) =>
    channel?.columns[0]?.length ? channel.columns[0][0] : null;
  const last = (channel: Channel | null) =>
    channel?.columns[0]?.length
      ? channel.columns[0][channel.columns[0].length - 1]
      : null;

  // Il segno di Regen Rate e' l'opposto di quello che il nome suggerisce
  // e l'unita' dichiarata in channelsList e' sbagliata. Su un file reale
  // la media e' +112.700 in frenata e -45.400 in accelerazione: positivo
  // e' recupero, negativo e' erogazione, e i valori sono watt, non
  // kilowatt (194 kW di picco, coerenti con l'MGU di una Hypercar).
  let recoverySum = 0;
  let recoveryCount = 0;
  let deploymentSum = 0;
  let deploymentCount = 0;

  const regenSampler = sampler(regen);
  const brakeSampler = sampler(brake);
  const throttleSampler = sampler(throttle);

  if (regenSampler) {
    for (let i = 0; i < regenSampler.values.length; i++) {
      const t = i / regenSampler.freq;
      const value = regenSampler.values[i];

      if (brakeSampler && brakeSampler.at(t) > 20 && value > 0) {
        recoverySum += value;
        recoveryCount++;
      } else if (throttleSampler && throttleSampler.at(t) > 50 && value < 0) {
        deploymentSum += value;
        deploymentCount++;
      }
    }
  }

  const gears = await readGears(conn, eventNames, best, gridFreq);
  const engineMaxRpm = await readEventScalar(conn, eventNames, "Engine Max RPM");

  const socValues = soc?.columns[0] ?? [];
  const fuelFrom = first(fuel);
  const fuelTo = last(fuel);

  const detail: EnergyDetail = {
    virtualEnergyFromPct: round(first(virtualEnergy), 1),
    virtualEnergyToPct: round(last(virtualEnergy), 1),
    socFromPct: round(first(soc), 1),
    socToPct: round(last(soc), 1),
    socMinPct: socValues.length ? round(Math.min(...socValues), 1) : null,
    avgRecoveryKw:
      recoveryCount > 0 ? round(recoverySum / recoveryCount / 1000) : null,
    avgDeploymentKw:
      deploymentCount > 0
        ? round(Math.abs(deploymentSum / deploymentCount) / 1000)
        : null,
    maxRpm: rpm?.columns[0]?.length
      ? round(Math.max(...rpm.columns[0]), 0)
      : null,
    engineMaxRpm: round(engineMaxRpm, 0),
    shifts: gears?.shifts ?? null,
    maxGear: gears?.maxGear ?? null,
    fuelUsedL:
      fuelFrom !== null && fuelTo !== null ? round(fuelFrom - fuelTo, 2) : null,
    waterTempC: water?.columns[0]?.length
      ? round(Math.max(...water.columns[0]), 0)
      : null,
    oilTempC: oil?.columns[0]?.length
      ? round(Math.max(...oil.columns[0]), 0)
      : null,
  };

  return Object.values(detail).some((v) => v !== null) ? detail : null;
}

// Le marce sono l'unico evento davvero a eventi del file: 576 righe con
// il ts assoluto della sessione. Per ritagliare il giro serve l'origine
// di quell'orologio, che e' il primo campione di "GPS Time" — l'unico
// canale che porta il tempo assoluto invece dell'indice.
async function readGears(
  conn: duckdb.Connection,
  eventNames: Set<string>,
  best: LapSegment,
  gridFreq: number
): Promise<{ shifts: number; maxGear: number } | null> {
  if (!eventNames.has("Gear")) return null;

  try {
    const originRows = await queryAll<{ v: number }>(
      conn,
      `SELECT value AS v FROM "GPS Time" LIMIT 1`
    );

    if (originRows.length === 0) return null;

    const origin = originRows[0].v;
    const from = origin + best.startIdx / gridFreq;
    const to = origin + (best.endIdx + 1) / gridFreq;

    const rows = await queryAll<{ v: number }>(
      conn,
      `SELECT CAST(value AS DOUBLE) AS v FROM "Gear"
       WHERE ts >= ${from} AND ts < ${to} ORDER BY ts ASC`
    );

    if (rows.length === 0) return null;

    // Meta' degli eventi sono la folle: il cambio passa per lo zero a
    // ogni innesto e lo registra come evento a se', 37 millisecondi
    // prima della marcia vera. Contare le righe raddoppierebbe i
    // cambi — in un file reale 288 eventi a zero su 576 esatti.
    const engaged = rows.filter((r) => r.v > 0);
    if (engaged.length === 0) return null;

    return {
      shifts: engaged.length,
      maxGear: Math.max(...engaged.map((r) => r.v)),
    };
  } catch {
    return null;
  }
}

function buildHandling(
  throttle: Channel | null,
  throttleRaw: Channel | null,
  tc: Channel | null,
  steering: Channel | null,
  surface: Channel | null,
  frontHeight: Channel | null,
  rearHeight: Channel | null,
  latG: Channel | null,
  longG: Channel | null
): HandlingDetail | null {
  const tcValues = tc?.columns[0] ?? [];
  const steeringValues = steering?.columns[0] ?? [];
  const off = surface ? offTrack(surface) : null;

  const detail: HandlingDetail = {
    requestedThrottlePct: round(average(throttleRaw?.columns[0] ?? [])),
    deliveredThrottlePct: round(average(throttle?.columns[0] ?? [])),
    tcActiveSharePct: tcValues.length
      ? round((tcValues.filter((v) => v > 0).length / tcValues.length) * 100)
      : null,
    maxSteeringPct: steeringValues.length
      ? round(Math.max(...steeringValues.map(Math.abs)))
      : null,
    steeringReversals: steeringValues.length
      ? countReversals(steeringValues, STEERING_REVERSAL_PCT)
      : null,
    avgSteeringRatePctPerSec:
      steeringValues.length > 1 && steering
        ? round(averageRate(steeringValues, steering.freq))
        : null,
    offTrackSeconds: off ? round(off.seconds, 1) : null,
    offTrackEpisodes: off ? off.episodes : null,
    onKerbSeconds: off ? round(off.anyWheelSeconds, 1) : null,
    // Le altezze nel file sono in metri.
    minFrontRideHeightMm: frontHeight?.columns[0]?.length
      ? round(Math.min(...frontHeight.columns[0]) * 1000, 0)
      : null,
    minRearRideHeightMm: rearHeight?.columns[0]?.length
      ? round(Math.min(...rearHeight.columns[0]) * 1000, 0)
      : null,
    maxLatG: latG?.columns[0]?.length
      ? round(Math.max(...latG.columns[0].map(Math.abs)), 2)
      : null,
    // Solo la decelerazione: il segno positivo e' l'accelerazione, che
    // dipende dalla potenza e non dice nulla sulla frenata.
    maxBrakingG: longG?.columns[0]?.length
      ? round(Math.abs(Math.min(...longG.columns[0])), 2)
      : null,
  };

  return Object.values(detail).some((v) => v !== null) ? detail : null;
}

// Quante volte lo sterzo torna indietro di almeno `minAmplitude` dopo
// essere andato avanti. Include sia i cambi di curva sia le correzioni,
// percio' il numero e' utile CONFRONTANDO giri dello stesso circuito,
// non in assoluto.
function countReversals(values: number[], minAmplitude: number): number {
  let count = 0;
  let direction: -1 | 0 | 1 = 0;
  let pivot = values[0];

  for (const value of values) {
    if (direction === 1) {
      if (value > pivot) pivot = value;
      else if (pivot - value >= minAmplitude) {
        count++;
        direction = -1;
        pivot = value;
      }
      continue;
    }

    if (direction === -1) {
      if (value < pivot) pivot = value;
      else if (value - pivot >= minAmplitude) {
        count++;
        direction = 1;
        pivot = value;
      }
      continue;
    }

    // La primissima direzione non e' un'inversione.
    if (value - pivot >= minAmplitude) {
      direction = 1;
      pivot = value;
    } else if (pivot - value >= minAmplitude) {
      direction = -1;
      pivot = value;
    }
  }

  return count;
}

function averageRate(values: number[], freq: number): number {
  let sum = 0;

  for (let i = 1; i < values.length; i++) {
    sum += Math.abs(values[i] - values[i - 1]);
  }

  return (sum * freq) / (values.length - 1);
}
