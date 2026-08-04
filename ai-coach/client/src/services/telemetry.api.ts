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

export async function uploadTelemetry(file: File, carId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (carId) formData.append("carId", carId);

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

// "index" e' la posizione nel file ed e' l'unico valore univoco:
// lapNumber viene dalle etichette degli eventi "Lap" e piu' giri
// possono condividerlo.
export type Lap = { index: number; lapNumber: number; startTs: number };

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

export async function getLapTelemetry(id: string, lapIndex: number) {
  const response = await fetch(
    `${API_URL}/api/telemetry/${id}/laps/${lapIndex}`
  );
  return response.json() as Promise<{ points: TelemetryPoint[] }>;
}
