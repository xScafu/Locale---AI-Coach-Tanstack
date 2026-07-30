import duckdb from "duckdb";

export type TableInfo = {
  name: string;
  columns: { name: string; type: string }[];
  rowCount: number;
};

const dbCache = new Map<string, duckdb.Database>();

function openDb(filePath: string): Promise<duckdb.Database> {
  const cached = dbCache.get(filePath);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const database = new duckdb.Database(filePath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      dbCache.set(filePath, database);
      resolve(database);
    });
  });
}

function all<T = any>(conn: duckdb.Connection, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

function closeConn(conn: duckdb.Connection) {
  conn.close();
}

// DuckDB restituisce gli interi a 64 bit come BigInt, e JSON.stringify
// lancia "Do not know how to serialize a BigInt": è così che ogni import
// finiva in stato "error". Le colonne dei file di telemetria sono
// FLOAT/DOUBLE/INTEGER, quindi il BigInt non arriva dai dati grezzi ma
// dalle aggregazioni (COUNT, SUM), che tornano sempre BIGINT/HUGEINT.
// Va applicata a tutto ciò che finisce in una risposta JSON o nella
// colonna `tables` di telemetry_imports.
function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") {
    // Oltre 2^53 Number perderebbe cifre in silenzio: meglio una stringa
    // esatta che un numero sbagliato.
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }

  if (Array.isArray(value)) return value.map(toJsonSafe);

  // Date e Buffer li serializza già JSON.stringify: ricostruirli campo
  // per campo li trasformerebbe in oggetti inutilizzabili.
  if (value instanceof Date || value instanceof Uint8Array) return value;

  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[key] = toJsonSafe(v);
    return out;
  }

  return value;
}

export async function inspectDuckDbFile(
  filePath: string
): Promise<TableInfo[]> {
  const database = await openDb(filePath);
  const conn = database.connect();

  try {
    const tables = await all<{ table_name: string }>(
      conn,
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    );

    const result: TableInfo[] = [];

    for (const t of tables) {
      const columns = await all<{ column_name: string; data_type: string }>(
        conn,
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t.table_name}'`
      );

      const countRows = await all<{ count: bigint }>(
        conn,
        `SELECT COUNT(*) as count FROM "${t.table_name}"`
      );

      result.push({
        name: t.table_name,
        columns: columns.map((c) => ({
          name: c.column_name,
          type: c.data_type,
        })),
        // COUNT(*) torna BIGINT: senza Number() il JSON.stringify della
        // route fallisce e l'import viene salvato come "error".
        rowCount: Number(countRows[0]?.count ?? 0),
      });
    }

    return result;
  } finally {
    closeConn(conn);
  }
}

export async function runReadOnlyQuery(filePath: string, sql: string) {
  const database = await openDb(filePath);
  const conn = database.connect();

  try {
    const hasLimit = /limit\s+\d+/i.test(sql);
    const finalSql = hasLimit ? sql : `${sql.replace(/;\s*$/, "")} LIMIT 200`;

    const rows = await all(conn, finalSql);

    // La query arriva dal client e viene rimandata indietro come JSON:
    // basta un COUNT/SUM per avere BigInt tra i risultati.
    return toJsonSafe(rows) as Record<string, unknown>[];
  } finally {
    closeConn(conn);
  }
}

export type ChannelMeta = { name: string; frequency: number; unit: string };

// Unico punto di lettura di channelsList: `frequency` finisce sia nelle
// risposte JSON sia come divisore negli allineamenti per indice, dove un
// BigInt darebbe "Cannot mix BigInt and other types". Nei file esistenti
// la colonna è INTEGER, ma la conversione costa nulla e vale per tutti i
// chiamanti.
async function fetchChannels(conn: duckdb.Connection): Promise<ChannelMeta[]> {
  const rows = await all<{
    channelName: string;
    frequency: number | bigint;
    unit: string | null;
  }>(conn, `SELECT "channelName", "frequency", "unit" FROM "channelsList"`);

  return rows.map((r) => ({
    name: r.channelName,
    frequency: Number(r.frequency),
    unit: r.unit ?? "",
  }));
}

export async function getChannelsList(
  filePath: string
): Promise<ChannelMeta[]> {
  const database = await openDb(filePath);
  const conn = database.connect();

  try {
    return await fetchChannels(conn);
  } finally {
    closeConn(conn);
  }
}

export async function getMetadata(
  filePath: string
): Promise<Record<string, string>> {
  const database = await openDb(filePath);
  const conn = database.connect();

  try {
    const rows = await all<{ key: string; value: string }>(
      conn,
      `SELECT "key", "value" FROM metadata`
    );

    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  } finally {
    closeConn(conn);
  }
}

async function fetchChannelRange(
  conn: duckdb.Connection,
  tableName: string,
  startIdx: number,
  endIdx: number
): Promise<number[]> {
  const sql = `
    SELECT value FROM (
      SELECT value, ROW_NUMBER() OVER () - 1 AS __idx FROM "${tableName}"
    ) WHERE __idx BETWEEN ${startIdx} AND ${endIdx}
    ORDER BY __idx ASC
  `;

  const rows = await all<{ value: number }>(conn, sql);
  return rows.map((r) => r.value);
}

async function fetchWholeChannel(
  conn: duckdb.Connection,
  tableName: string
): Promise<number[]> {
  const rows = await all<{ value: number }>(
    conn,
    `SELECT value FROM (SELECT value, ROW_NUMBER() OVER () - 1 AS __idx FROM "${tableName}") ORDER BY __idx ASC`
  );

  return rows.map((r) => r.value);
}

export type LapSegment = {
  lapNumber: number;
  startIdx: number;
  endIdx: number;
};

// "Lap Dist" campiona alla STESSA frequenza del GPS (10Hz, vedi
// channelsList): indice i in "Lap Dist" e indice i in "GPS Latitude" /
// "GPS Longitude" sono sempre lo stesso istante, nessuna interpolazione
// necessaria tra questi tre canali.
//
// "Lap Dist" si azzera fisicamente SOLO quando l'auto attraversa la
// linea del traguardo: usarlo per rilevare i confini del giro è più
// affidabile che dedurli dal ts dell'evento "Lap" (che segna solo
// quando cambia il contatore, senza garanzia di coincidere col frame
// GPS esatto dell'attraversamento).
export async function computeLapSegments(
  conn: duckdb.Connection,
  channels: ChannelMeta[]
): Promise<LapSegment[]> {
  const lapDist = await fetchWholeChannel(conn, "Lap Dist");
  const gpsFreq =
    channels.find((c) => c.name === "GPS Latitude")?.frequency ?? 10;

  const DROP_THRESHOLD_M = 500;
  const resetIndices: number[] = [];

  for (let i = 1; i < lapDist.length; i++) {
    if (lapDist[i - 1] - lapDist[i] > DROP_THRESHOLD_M) {
      resetIndices.push(i);
    }
  }

  const boundaries = [0, ...resetIndices, lapDist.length];

  const lapEventRows = await all<{
    ts: number | bigint;
    value: number | bigint;
  }>(conn, `SELECT "ts", "value" FROM "Lap" ORDER BY "ts" ASC`);

  // `value` diventa il lapNumber restituito in JSON dalla route /laps:
  // convertito qui una volta sola invece che in ogni chiamante.
  const lapEvents = lapEventRows.map((e) => ({
    ts: Number(e.ts),
    value: Number(e.value),
  }));

  function labelForTime(t: number): number {
    let label = lapEvents[0]?.value ?? 0;
    for (const ev of lapEvents) {
      if (ev.ts <= t) label = ev.value;
      else break;
    }
    return label;
  }

  const segments: LapSegment[] = [];

  for (let k = 0; k < boundaries.length - 1; k++) {
    const startIdx = boundaries[k];
    const endIdx = boundaries[k + 1] - 1;
    if (endIdx <= startIdx) continue;

    const startTime = startIdx / gpsFreq;

    segments.push({
      lapNumber: labelForTime(startTime),
      startIdx,
      endIdx,
    });
  }

  return segments;
}

export type LapInfo = { lapNumber: number; startTs: number };

export async function getLaps(filePath: string): Promise<LapInfo[]> {
  const database = await openDb(filePath);
  const conn = database.connect();

  try {
    const channels = await fetchChannels(conn);

    const segments = await computeLapSegments(conn, channels);
    const gpsFreq =
      channels.find((c) => c.name === "GPS Latitude")?.frequency ?? 10;

    return segments.map((s) => ({
      lapNumber: s.lapNumber,
      startTs: s.startIdx / gpsFreq,
    }));
  } finally {
    closeConn(conn);
  }
}

export type LapTelemetryPoint = {
  t: number;
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  throttlePct: number | null;
  brakePct: number | null;
  lapDistM: number | null;
};

export async function getLapTelemetrySeries(
  filePath: string,
  lapNumber: number
): Promise<LapTelemetryPoint[]> {
  const database = await openDb(filePath);
  const conn = database.connect();

  try {
    const channels = await fetchChannels(conn);
    const freqOf = (name: string) =>
      channels.find((c) => c.name === name)?.frequency ?? null;

    const segments = await computeLapSegments(conn, channels);
    const segment = segments.find((s) => s.lapNumber === lapNumber);

    if (!segment) {
      throw new Error(`Giro ${lapNumber} non trovato nel file`);
    }

    const gpsFreq = freqOf("GPS Latitude") ?? 10;
    const gpsStartIdx = segment.startIdx;
    const gpsEndIdx = segment.endIdx;
    const startTs = gpsStartIdx / gpsFreq;
    const endTs = (gpsEndIdx + 1) / gpsFreq;

    const lats = await fetchChannelRange(
      conn,
      "GPS Latitude",
      gpsStartIdx,
      gpsEndIdx
    );
    const lons = await fetchChannelRange(
      conn,
      "GPS Longitude",
      gpsStartIdx,
      gpsEndIdx
    );

    async function fetchAligned(
      channelName: string
    ): Promise<(number | null)[]> {
      const freq = freqOf(channelName);
      if (!freq) return lats.map(() => null);

      const startIdxLocal = Math.floor(startTs * freq);
      const endIdxLocal = Math.max(startIdxLocal, Math.ceil(endTs * freq) - 1);
      const values = await fetchChannelRange(
        conn,
        channelName,
        startIdxLocal,
        endIdxLocal
      );

      if (values.length === 0) return lats.map(() => null);

      return lats.map((_, i) => {
        const t = (gpsStartIdx + i) / gpsFreq;
        const localIdx = Math.round((t - startTs) * freq);
        const clamped = Math.min(Math.max(localIdx, 0), values.length - 1);
        return values[clamped];
      });
    }

    const speeds = await fetchAligned("Ground Speed");
    const throttles = await fetchAligned("Throttle Pos");
    const brakes = await fetchAligned("Brake Pos");
    const lapDists = await fetchAligned("Lap Dist");

    return lats.map((lat, i) => ({
      t: Math.round(((gpsStartIdx + i) / gpsFreq - startTs) * 1000) / 1000,
      lat: lat ?? null,
      lon: lons[i] ?? null,
      speedKmh: speeds[i],
      throttlePct: throttles[i],
      brakePct: brakes[i],
      lapDistM: lapDists[i],
    }));
  } finally {
    closeConn(conn);
  }
}

export type TelemetrySummary = {
  trackName: string | null;
  carName: string | null;
  lapsAnalyzed: number;
  bestLap: {
    lapNumber: number;
    lapTimeSeconds: number;
    topSpeedKmh: number;
    avgThrottlePct: number;
    avgBrakePct: number;
  } | null;
};

// Cache per file: il riassunto non cambia finché il file .duckdb resta
// lo stesso (un nuovo import = un nuovo filePath), quindi non serve
// invalidarla finché il server è in esecuzione.
const summaryCache = new Map<string, TelemetrySummary>();

// Riassunto compatto usato nel prompt del coach: NON i dati grezzi
// (troppo pesanti e inutili per il modello), solo le statistiche del
// giro migliore. Riusa la stessa logica di rilevamento giri via
// "Lap Dist" già validata per la mappa.
export async function getTelemetrySummary(
  filePath: string
): Promise<TelemetrySummary> {
  const cached = summaryCache.get(filePath);
  if (cached) return cached;

  const database = await openDb(filePath);
  const conn = database.connect();

  try {
    const channels = await fetchChannels(conn);
    const freqOf = (name: string) =>
      channels.find((c) => c.name === name)?.frequency ?? null;
    const gpsFreq = freqOf("GPS Latitude") ?? 10;

    const segments = await computeLapSegments(conn, channels);

    const speedFreq = freqOf("Ground Speed") ?? gpsFreq;
    const throttleFreq = freqOf("Throttle Pos") ?? gpsFreq;
    const brakeFreq = freqOf("Brake Pos") ?? gpsFreq;

    const speeds = await fetchWholeChannel(conn, "Ground Speed");
    const throttles = await fetchWholeChannel(conn, "Throttle Pos");
    const brakes = await fetchWholeChannel(conn, "Brake Pos");

    function sliceFor(freq: number, values: number[], segment: LapSegment) {
      const startTime = segment.startIdx / gpsFreq;
      const endTime = (segment.endIdx + 1) / gpsFreq;
      const startIdx = Math.floor(startTime * freq);
      const endIdx = Math.min(values.length - 1, Math.ceil(endTime * freq) - 1);

      if (endIdx < startIdx) return [];
      return values.slice(startIdx, endIdx + 1);
    }

    type LapStat = {
      lapNumber: number;
      lapTimeSeconds: number;
      topSpeedKmh: number;
      avgThrottlePct: number;
      avgBrakePct: number;
    };

    const lapStats: LapStat[] = [];

    for (const segment of segments) {
      const lapTimeSeconds = (segment.endIdx - segment.startIdx + 1) / gpsFreq;

      // Filtra giri troppo corti: probabile uscita/rientro ai box o
      // formation lap parziale, non un giro cronometrato reale.
      if (lapTimeSeconds < 20) continue;

      const speedSlice = sliceFor(speedFreq, speeds, segment);
      const throttleSlice = sliceFor(throttleFreq, throttles, segment);
      const brakeSlice = sliceFor(brakeFreq, brakes, segment);

      const topSpeedKmh = speedSlice.length ? Math.max(...speedSlice) : 0;
      const avgThrottlePct = throttleSlice.length
        ? throttleSlice.reduce((a, b) => a + b, 0) / throttleSlice.length
        : 0;
      const avgBrakePct = brakeSlice.length
        ? brakeSlice.reduce((a, b) => a + b, 0) / brakeSlice.length
        : 0;

      lapStats.push({
        lapNumber: segment.lapNumber,
        lapTimeSeconds,
        topSpeedKmh,
        avgThrottlePct,
        avgBrakePct,
      });
    }

    const bestLap =
      lapStats.length > 0
        ? lapStats.reduce((best, cur) =>
            cur.lapTimeSeconds < best.lapTimeSeconds ? cur : best
          )
        : null;

    const metadataRows = await all<{ key: string; value: string }>(
      conn,
      `SELECT "key", "value" FROM metadata`
    );
    const metadata: Record<string, string> = {};
    for (const r of metadataRows) metadata[r.key] = r.value;

    const summary: TelemetrySummary = {
      trackName: metadata["TrackName"] ?? null,
      carName: metadata["CarName"] ?? null,
      lapsAnalyzed: lapStats.length,
      bestLap: bestLap
        ? {
            lapNumber: bestLap.lapNumber,
            lapTimeSeconds: Math.round(bestLap.lapTimeSeconds * 1000) / 1000,
            topSpeedKmh: Math.round(bestLap.topSpeedKmh * 10) / 10,
            avgThrottlePct: Math.round(bestLap.avgThrottlePct * 10) / 10,
            avgBrakePct: Math.round(bestLap.avgBrakePct * 10) / 10,
          }
        : null,
    };

    summaryCache.set(filePath, summary);
    return summary;
  } finally {
    closeConn(conn);
  }
}

// ---------------------------------------------------------------------
// Profilo del tracciato
// ---------------------------------------------------------------------

export type TrackCorner = {
  number: number;
  direction: "dx" | "sx";
  entryM: number;
  apexM: number;
  exitM: number;
  lengthM: number;
  minSpeedKmh: number;
  peakLatG: number;
  // Dove inizia la frenata che prepara questa curva, e quanti metri
  // prima dell'ingresso. null se ci si arriva senza frenare.
  brakingPointM: number | null;
  brakingDistanceM: number | null;
  rpmAtApex: number | null;
};

export type TrackProfile = {
  lengthM: number;
  bestLapSeconds: number;
  lapsAnalyzed: number;
  corners: TrackCorner[];
  detection: typeof DETECTION;
};

// Parametri di rilevamento, tarati sul giro migliore di un file reale
// (Hypercar a Monza: 10 curve, lunghezza 5775 m contro i 5793 ufficiali).
//
// LAT_G_THRESHOLD definisce cosa conta come "curva": non la geometria
// del tracciato ma il carico che impone al pilota. Un curvone veloce
// preso in pieno resta fuori di proposito — a Monza la Curva Grande fa
// segnare 0.5G a 250 km/h e non richiede ne' frenata ne' correzione di
// traiettoria. La soglia dipende quindi anche dall'auto: la stessa
// curva con una GT3 piu' lenta puo' rientrare.
const DETECTION = {
  latGThreshold: 0.6,
  minLengthM: 25,
  mergeGapM: 60,
  minPeakG: 0.9,
};

// Riporta un canale sulla griglia temporale di "Lap Dist" (10Hz): i
// canali hanno frequenze diverse (fino a 100Hz) e senza riallineamento
// gli indici non sono confrontabili tra loro.
function alignToLapGrid(
  values: number[],
  channelFreq: number,
  gridFreq: number,
  startIdx: number,
  endIdx: number
): number[] {
  const out: number[] = [];

  for (let i = startIdx; i <= endIdx; i++) {
    const t = i / gridFreq;
    const idx = Math.min(Math.round(t * channelFreq), values.length - 1);
    out.push(values[idx]);
  }

  return out;
}

export async function computeTrackProfile(
  filePath: string
): Promise<TrackProfile | null> {
  const database = await openDb(filePath);
  const conn = database.connect();

  try {
    const channelRows = await all<{ channelName: string; frequency: number }>(
      conn,
      `SELECT "channelName", "frequency" FROM "channelsList"`
    );

    const freqOf = (name: string) =>
      channelRows.find((c) => c.channelName === name)?.frequency ?? null;

    const channels: ChannelMeta[] = channelRows.map((c) => ({
      name: c.channelName,
      frequency: c.frequency,
      unit: "",
    }));

    const gridFreq = freqOf("GPS Latitude") ?? 10;
    const segments = await computeLapSegments(conn, channels);

    const valid = segments.filter(
      (s) => (s.endIdx - s.startIdx + 1) / gridFreq >= 20
    );

    if (valid.length === 0) return null;

    const best = valid.reduce((b, c) =>
      c.endIdx - c.startIdx < b.endIdx - b.startIdx ? c : b
    );

    const lapDistAll = await fetchWholeChannel(conn, "Lap Dist");
    const dist = lapDistAll.slice(best.startIdx, best.endIdx + 1);

    if (dist.length === 0) return null;

    async function aligned(name: string): Promise<number[] | null> {
      const freq = freqOf(name);
      if (!freq) return null;

      const values = await fetchWholeChannel(conn, name);
      return alignToLapGrid(
        values,
        freq,
        gridFreq,
        best.startIdx,
        best.endIdx
      );
    }

    const latG = await aligned("G Force Lat");
    const speed = await aligned("Ground Speed");

    // Senza G laterale e velocita' non c'e' modo di segmentare il giro.
    if (!latG || !speed) return null;

    const brake = await aligned("Brake Pos");
    const rpm = await aligned("Engine RPM");

    // 1. Tratti in cui il carico laterale supera la soglia.
    const raw: [number, number][] = [];
    let open: number | null = null;

    for (let i = 0; i < latG.length; i++) {
      const cornering = Math.abs(latG[i]) > DETECTION.latGThreshold;

      if (cornering && open === null) open = i;
      if (!cornering && open !== null) {
        raw.push([open, i - 1]);
        open = null;
      }
    }

    if (open !== null) raw.push([open, latG.length - 1]);

    const directionOf = ([a, b]: [number, number]) =>
      latG.slice(a, b + 1).reduce((x, y) => x + y, 0) > 0 ? 1 : -1;

    // 2. Unisce solo i tratti dello STESSO verso: due tratti di verso
    // opposto sono curve distinte (una chicane), mentre lo stesso verso
    // spezzato in due e' quasi sempre una curva sola il cui carico e'
    // sceso sotto soglia a meta'. Senza questa distinzione le curve
    // lunghe venivano contate due volte.
    const merged: [number, number][] = [];

    for (const seg of raw) {
      const last = merged[merged.length - 1];
      const gap = last ? dist[seg[0]] - dist[last[1]] : Infinity;

      if (last && gap < DETECTION.mergeGapM && directionOf(last) === directionOf(seg)) {
        last[1] = seg[1];
      } else {
        merged.push([...seg] as [number, number]);
      }
    }

    // 3. Scarta i tratti troppo corti o troppo blandi: sono correzioni
    // di traiettoria in rettilineo, non curve.
    const kept = merged.filter(([a, b]) => {
      const peak = Math.max(...latG.slice(a, b + 1).map(Math.abs));
      return (
        dist[b] - dist[a] >= DETECTION.minLengthM && peak >= DETECTION.minPeakG
      );
    });

    const corners: TrackCorner[] = kept.map(([a, b], n) => {
      let apex = a;
      for (let i = a; i <= b; i++) if (speed[i] < speed[apex]) apex = i;

      // La staccata si cerca risalendo dall'ingresso, senza mai oltre-
      // passare l'uscita della curva precedente: altrimenti a una curva
      // veniva attribuita la frenata di quella prima.
      const floor = n > 0 ? kept[n - 1][1] : 0;
      let brakingIdx: number | null = null;

      if (brake) {
        let i = a;
        while (i > floor && brake[i] <= 5) i--;

        if (brake[i] > 5) {
          while (i > floor && brake[i] > 5) i--;
          brakingIdx = i;
        }
      }

      const signed = latG.slice(a, b + 1).reduce((x, y) => x + y, 0);

      return {
        number: n + 1,
        direction: signed > 0 ? "dx" : "sx",
        entryM: Math.round(dist[a]),
        apexM: Math.round(dist[apex]),
        exitM: Math.round(dist[b]),
        lengthM: Math.round(dist[b] - dist[a]),
        minSpeedKmh: Math.round(speed[apex] * 10) / 10,
        peakLatG:
          Math.round(Math.max(...latG.slice(a, b + 1).map(Math.abs)) * 100) /
          100,
        brakingPointM: brakingIdx !== null ? Math.round(dist[brakingIdx]) : null,
        brakingDistanceM:
          brakingIdx !== null ? Math.round(dist[a] - dist[brakingIdx]) : null,
        rpmAtApex: rpm ? Math.round(rpm[apex]) : null,
      };
    });

    return {
      lengthM: Math.round(Math.max(...dist)),
      bestLapSeconds:
        Math.round(((best.endIdx - best.startIdx + 1) / gridFreq) * 1000) / 1000,
      lapsAnalyzed: valid.length,
      corners,
      detection: DETECTION,
    };
  } finally {
    closeConn(conn);
  }
}
