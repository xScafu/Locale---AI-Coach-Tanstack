const API_URL = "http://localhost:3001";

export type TelemetryImport = {
  id: string;
  carId: string | null;
  trackId: string | null;
  pilotId: string | null;
  fileName: string;
  filePath: string;
  tables: string | null;
  status: "pending" | "parsed" | "error";
  errorMessage: string | null;
  metadata: string | null;
  recordedAt: number | null;
  // Il giro con cui confrontarsi su questo circuito. Uno per pista.
  isReference: boolean;
};

export type SyncEntity = {
  id: string;
  name: string;
  action: "created" | "matched";
  activated: boolean;
};

// Cosa il server ha riconosciuto nel file e come ha allineato l'app.
export type ImportSync = {
  pilot: SyncEntity | null;
  car: SyncEntity | null;
  track: SyncEntity | null;
  session: {
    type: string | null;
    weather: string | null;
    recordedAt: number | null;
  };
  profile: {
    corners: number;
    lengthM: number;
    bestLapSeconds: number;
    theoreticalLapSeconds: number | null;
  } | null;
};

export type UploadResult = {
  id: string;
  status: "parsed" | "error";
  sync?: ImportSync;
  error?: string;
};

export async function uploadTelemetry(
  file: File,
  carId?: string,
  asReference?: boolean
) {
  const formData = new FormData();
  formData.append("file", file);
  if (carId) formData.append("carId", carId);
  // Un riferimento non riconfigura l'app: il server salta del tutto la
  // sincronizzazione da metadata, che altrimenti renderebbe attivo il
  // pilota scritto nel file.
  if (asReference) formData.append("asReference", "true");

  const response = await fetch(`${API_URL}/api/telemetry/import`, {
    method: "POST",
    body: formData,
  });

  const body = (await response.json()) as UploadResult;

  if (!response.ok) {
    throw new Error(body.error ?? "Importazione non riuscita");
  }

  return body;
}

export async function getTelemetryImports(carId?: string) {
  const url = carId
    ? `${API_URL}/api/telemetry?carId=${carId}`
    : `${API_URL}/api/telemetry`;

  const response = await fetch(url);
  return response.json() as Promise<{ items: TelemetryImport[] }>;
}

export async function runTelemetryQuery(id: string, sql: string) {
  const response = await fetch(`${API_URL}/api/telemetry/${id}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });

  return response.json() as Promise<{ rows?: any[]; error?: string }>;
}

export async function deleteTelemetryImport(id: string) {
  const response = await fetch(`${API_URL}/api/telemetry/${id}`, {
    method: "DELETE",
  });

  return response.json();
}

// I giri sono numerati in sequenza da 1 nell'ordine del file, non con
// il contatore del simulatore: quello non e' univoco.
export type Lap = { lapNumber: number; startTs: number };

export async function getTelemetryLaps(id: string) {
  const response = await fetch(`${API_URL}/api/telemetry/${id}/laps`);
  return response.json() as Promise<{ laps: Lap[] }>;
}

export type TelemetryPoint = {
  t: number;
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  throttlePct: number | null;
  brakePct: number | null;
  lapDistM: number | null;
};

export async function getLapTelemetry(id: string, lapNumber: number) {
  const response = await fetch(
    `${API_URL}/api/telemetry/${id}/laps/${lapNumber}`
  );
  return response.json() as Promise<{ points: TelemetryPoint[] }>;
}

// Un canale del file .duckdb. `labels` ha un'etichetta per traccia: una
// sola per i canali normali, quattro (AS/AD/PS/PD) per quelli per ruota.
export type Channel = {
  name: string;
  frequency: number;
  unit: string;
  columns: string[];
  labels: string[];
  boolean: boolean;
};

export async function getTelemetryChannels(id: string) {
  const response = await fetch(`${API_URL}/api/telemetry/${id}/channels`);
  return response.json() as Promise<{ channels: Channel[] }>;
}

export type ChannelSeries = {
  name: string;
  unit: string;
  frequency: number;
  labels: string[];
  // Una serie per traccia, gia' allineata alla stessa griglia dei
  // TelemetryPoint dello stesso giro: stesso indice, stesso istante.
  values: number[][];
};

export async function setTelemetryReference(id: string, isReference: boolean) {
  const response = await fetch(`${API_URL}/api/telemetry/${id}/reference`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isReference }),
  });

  return response.json() as Promise<{ ok?: boolean; error?: string }>;
}

export type CornerComparison = {
  number: number;
  entryM: number;
  exitM: number;
  // Dentro la curva.
  deltaSeconds: number;
  // Nel rettilineo che la segue.
  exitDeltaSeconds: number;
  // I due sommati. Le sezioni piastrellano il giro, quindi sommate danno
  // lo scarto totale.
  sectionDeltaSeconds: number;
  minSpeedKmh: number | null;
  referenceMinSpeedKmh: number | null;
  brakingPointM: number | null;
  referenceBrakingPointM: number | null;
  brakingDeltaM: number | null;
  // Qui "Lap Dist" salta in uno dei due giri: il delta esiste ma non
  // vuol dire niente.
  unreliable: boolean;
};

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

export type LapSummary = {
  importId: string | null;
  lapNumber: number;
  seconds: number;
  minSpeedKmh: number;
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
  sameCar: boolean;
  gapSeconds: number;
  glitches: { fromM: number; toM: number }[];
  beforeFirstCornerSeconds: number | null;
  lengthM: number;
  samples: ComparisonSample[];
  corners: CornerComparison[];
};

export async function getComparison(
  id: string,
  options: { against?: string; lap?: number; againstLap?: number } = {}
) {
  const params = new URLSearchParams();
  if (options.against) params.set("against", options.against);
  if (options.lap) params.set("lap", String(options.lap));
  if (options.againstLap) params.set("againstLap", String(options.againstLap));

  const query = params.toString();

  const response = await fetch(
    `${API_URL}/api/telemetry/${id}/compare${query ? `?${query}` : ""}`
  );

  return response.json() as Promise<{
    comparison?: LapComparison;
    error?: string;
  }>;
}

export async function getLapChannels(
  id: string,
  lapNumber: number,
  names: string[]
) {
  const query = encodeURIComponent(names.join(","));

  const response = await fetch(
    `${API_URL}/api/telemetry/${id}/laps/${lapNumber}/channels?names=${query}`
  );

  return response.json() as Promise<{ series: ChannelSeries[] }>;
}
