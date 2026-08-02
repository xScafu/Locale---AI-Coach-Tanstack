const API_URL = "http://localhost:3001";

export type GarageCar = {
  id: string;
  pilotId: string;
  manufacturer: string | null;
  name: string;
  simulator: string | null;
  category: string | null;
  notes: string | null;
  isActive?: boolean;
};

// I campi numerici del setup che il coach puo' proporre di cambiare:
// stessa lista dell'enum nello schema lato server.
export const SETUP_FIELD_LABELS: Record<string, string> = {
  brakeBias: "Brake bias",
  frontRideHeight: "Altezza ant.",
  rearRideHeight: "Altezza post.",
  frontCamber: "Camber ant.",
  rearCamber: "Camber post.",
  frontToe: "Convergenza ant.",
  rearToe: "Convergenza post.",
  frontARB: "Barra ant.",
  rearARB: "Barra post.",
  frontSpring: "Molla ant.",
  rearSpring: "Molla post.",
  diffPreload: "Precarico diff.",
};

export type SetupChange = {
  field: keyof typeof SETUP_FIELD_LABELS;
  currentValue: number | null;
  suggestedValue: number;
  reason: string;
};

export type Setup = {
  id: string;
  carId: string;
  isActive?: boolean;
  name: string;
  brakeBias: number | null;
  frontRideHeight: number | null;
  rearRideHeight: number | null;
  frontCamber: number | null;
  rearCamber: number | null;
  frontToe: number | null;
  rearToe: number | null;
  frontARB: number | null;
  rearARB: number | null;
  frontSpring: number | null;
  rearSpring: number | null;
  diffPreload: number | null;
  notes: string | null;
};

export type CarProblem = {
  id: string;
  carId: string;
  phase: string;
  problem: string;
  severity: number | null;
  notes: string | null;
};

// ---------- Cars ----------

export async function getCars(pilotId: string) {
  const response = await fetch(`${API_URL}/api/cars?pilotId=${pilotId}`);
  return response.json() as Promise<{ items: GarageCar[] }>;
}

export async function getCar(carId: string) {
  const response = await fetch(`${API_URL}/api/cars/${carId}`);
  return response.json() as Promise<{ car: GarageCar }>;
}

export async function createCar(data: {
  pilotId: string;
  manufacturer?: string;
  name: string;
  simulator?: string;
  category?: string;
  notes?: string;
}) {
  const response = await fetch(`${API_URL}/api/cars`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

// Prima mancava del tutto: nessun modo dal client di modificare un'auto.
export async function updateCar(
  carId: string,
  data: {
    manufacturer?: string | null;
    name: string;
    simulator?: string | null;
    category?: string | null;
    notes?: string | null;
  }
) {
  const response = await fetch(`${API_URL}/api/cars/${carId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

// Prima mancava del tutto: nessun modo dal client di eliminare un'auto.
export async function deleteCar(carId: string) {
  const response = await fetch(`${API_URL}/api/cars/${carId}`, {
    method: "DELETE",
  });

  return response.json();
}

// Prima mancava del tutto: nessun modo di impostare un'auto come attiva
// (il contesto usato dal coach in chat/dashboard).
export async function activateCar(carId: string) {
  const response = await fetch(`${API_URL}/api/cars/${carId}/activate`, {
    method: "PATCH",
  });

  return response.json();
}

// ---------- Setups ----------

export async function getSetups(carId: string) {
  const response = await fetch(`${API_URL}/api/setups?carId=${carId}`);
  return response.json() as Promise<{ items: Setup[] }>;
}

export async function createSetup(data: {
  carId: string;
  name: string;
  brakeBias?: number | null;
  frontRideHeight?: number | null;
  rearRideHeight?: number | null;
  frontCamber?: number | null;
  rearCamber?: number | null;
  frontToe?: number | null;
  rearToe?: number | null;
  frontARB?: number | null;
  rearARB?: number | null;
  frontSpring?: number | null;
  rearSpring?: number | null;
  diffPreload?: number | null;
  notes?: string | null;
}) {
  const response = await fetch(`${API_URL}/api/setups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

// Prima mancava del tutto.
export async function updateSetup(
  setupId: string,
  data: {
    name: string;
    brakeBias?: number | null;
    frontRideHeight?: number | null;
    rearRideHeight?: number | null;
    frontCamber?: number | null;
    rearCamber?: number | null;
    frontToe?: number | null;
    rearToe?: number | null;
    frontARB?: number | null;
    rearARB?: number | null;
    frontSpring?: number | null;
    rearSpring?: number | null;
    diffPreload?: number | null;
    notes?: string | null;
  }
) {
  const response = await fetch(`${API_URL}/api/setups/${setupId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

// Imposta questo setup come attivo per la sua auto: e' quello che il
// coach usa come base per proporre modifiche.
export async function activateSetup(setupId: string) {
  const response = await fetch(`${API_URL}/api/setups/${setupId}/activate`, {
    method: "PATCH",
  });

  return response.json();
}

// Ultime modifiche proposte dal coach, rilette dallo storico messaggi:
// la chat lato client non conserva nulla dopo una ricarica.
export async function getSetupSuggestions() {
  const response = await fetch(`${API_URL}/api/setups/suggestions`);

  if (!response.ok) {
    throw new Error("Impossibile leggere i suggerimenti del coach");
  }

  return response.json() as Promise<{
    changes: SetupChange[];
    createdAt: number | null;
  }>;
}

// Prima mancava del tutto.
export async function deleteSetup(setupId: string) {
  const response = await fetch(`${API_URL}/api/setups/${setupId}`, {
    method: "DELETE",
  });

  return response.json();
}

// ---------- Problems ----------

export async function getProblems(carId: string) {
  const response = await fetch(`${API_URL}/api/problems?carId=${carId}`);
  return response.json() as Promise<{ items: CarProblem[] }>;
}

export async function createProblem(data: {
  carId: string;
  phase: string;
  problem: string;
  severity?: number | null;
  notes?: string | null;
}) {
  const response = await fetch(`${API_URL}/api/problems`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

// Prima mancava del tutto.
export async function updateProblem(
  problemId: string,
  data: {
    phase: string;
    problem: string;
    severity?: number | null;
    notes?: string | null;
  }
) {
  const response = await fetch(`${API_URL}/api/problems/${problemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

// Prima mancava del tutto.
export async function deleteProblem(problemId: string) {
  const response = await fetch(`${API_URL}/api/problems/${problemId}`, {
    method: "DELETE",
  });

  return response.json();
}

export type SvmImportResult = {
  fileName: string;
  keyValues: Record<string, string>;
  suggestions: Partial<{
    brakeBias: number;
    frontRideHeight: number;
    rearRideHeight: number;
    frontCamber: number;
    rearCamber: number;
    frontToe: number;
    rearToe: number;
    frontARB: number;
    rearARB: number;
    frontSpring: number;
    rearSpring: number;
    diffPreload: number;
  }>;
};

export async function importSetupFile(carId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("carId", carId);

  const response = await fetch(`${API_URL}/api/setups/import`, {
    method: "POST",
    body: formData,
  });

  return response.json() as Promise<SvmImportResult>;
}
