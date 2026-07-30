const API_URL = "http://localhost:3001";

export type TelemetryImport = {
  id: string;
  carId: string | null;
  fileName: string;
  filePath: string;
  tables: string | null;
  status: "pending" | "parsed" | "error";
  errorMessage: string | null;
};

export async function uploadTelemetry(file: File, carId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (carId) formData.append("carId", carId);

  const response = await fetch(`${API_URL}/api/telemetry/import`, {
    method: "POST",
    body: formData,
  });

  return response.json();
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
