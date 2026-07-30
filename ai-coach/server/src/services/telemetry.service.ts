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

      const countRows = await all<{ count: number }>(
        conn,
        `SELECT COUNT(*) as count FROM "${t.table_name}"`
      );

      result.push({
        name: t.table_name,
        columns: columns.map((c) => ({
          name: c.column_name,
          type: c.data_type,
        })),
        rowCount: countRows[0]?.count ?? 0,
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

    return await all(conn, finalSql);
  } finally {
    closeConn(conn);
  }
}

export type ChannelMeta = { name: string; frequency: number; unit: string };

export async function getChannelsList(
  filePath: string
): Promise<ChannelMeta[]> {
  const database = await openDb(filePath);
  const conn = database.connect();

  try {
    const rows = await all<{
      channelName: string;
      frequency: number;
      unit: string;
    }>(conn, `SELECT "channelName", "frequency", "unit" FROM "channelsList"`);

    return rows.map((r) => ({
      name: r.channelName,
      frequency: r.frequency,
      unit: r.unit,
    }));
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

  const lapEvents = await all<{ ts: number; value: number }>(
    conn,
    `SELECT "ts", "value" FROM "Lap" ORDER BY "ts" ASC`
  );

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
    const channelRows = await all<{ channelName: string; frequency: number }>(
      conn,
      `SELECT "channelName", "frequency" FROM "channelsList"`
    );
    const channels: ChannelMeta[] = channelRows.map((c) => ({
      name: c.channelName,
      frequency: c.frequency,
      unit: "",
    }));

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
    const channelRows = await all<{ channelName: string; frequency: number }>(
      conn,
      `SELECT "channelName", "frequency" FROM "channelsList"`
    );
    const channels: ChannelMeta[] = channelRows.map((c) => ({
      name: c.channelName,
      frequency: c.frequency,
      unit: "",
    }));
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
    const channelRows = await all<{ channelName: string; frequency: number }>(
      conn,
      `SELECT "channelName", "frequency" FROM "channelsList"`
    );
    const channels: ChannelMeta[] = channelRows.map((c) => ({
      name: c.channelName,
      frequency: c.frequency,
      unit: "",
    }));
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
