const API_URL = "http://localhost:3001";

export type TrackCorner = {
  number: number;
  direction: "dx" | "sx";
  entryM: number;
  apexM: number;
  exitM: number;
  lengthM: number;
  minSpeedKmh: number;
  peakLatG: number;
  brakingPointM: number | null;
  brakingDistanceM: number | null;
  rpmAtApex: number | null;
};

export type CornerReference = {
  number: number;
  bestMinSpeedKmh: number;
  bestLapNumber: number;
  averageMinSpeedKmh: number;
  bestLapMinSpeedKmh: number;
  deltaKmh: number;
};

export type TrackSector = {
  number: number;
  fromM: number;
  toM: number;
  bestSeconds: number;
  bestLapNumber: number;
  bestLapSeconds: number;
};

export type TrackReference = {
  lapsAnalyzed: number;
  bestLapSeconds: number;
  theoreticalLapSeconds: number | null;
  potentialGainSeconds: number | null;
  sectors: TrackSector[];
  corners: CornerReference[];
};

export type TrackProfile = {
  lengthM: number;
  bestLapSeconds: number;
  lapsAnalyzed: number;
  corners: TrackCorner[];
  detection: {
    latGThreshold: number;
    minLengthM: number;
    mergeGapM: number;
    minPeakG: number;
  };
  reference: TrackReference | null;
};

export type Track = {
  id: string;
  pilotId: string;
  name: string;
  country: string | null;
  variant: string | null;
  lengthM: number | null;
  cornerCount: number | null;
  referenceLapSeconds: number | null;
  notes: string | null;
  // JSON stringificato di TrackProfile, generato dalla telemetria.
  profile: string | null;
  profileUpdatedAt: number | null;
  isActive?: boolean;
  layout?: string | null;
};

export function parseTrackProfile(track: Track): TrackProfile | null {
  if (!track.profile) return null;

  try {
    return JSON.parse(track.profile) as TrackProfile;
  } catch {
    return null;
  }
}

export async function getTracks(pilotId: string) {
  const response = await fetch(`${API_URL}/api/tracks?pilotId=${pilotId}`);
  return response.json() as Promise<{ items: Track[] }>;
}

export async function getTrack(id: string) {
  const response = await fetch(`${API_URL}/api/tracks/${id}`);
  return response.json() as Promise<{ track: Track }>;
}

export async function createTrack(data: {
  pilotId: string;
  name: string;
  country?: string;
}) {
  const response = await fetch(`${API_URL}/api/tracks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

export async function updateTrack(
  id: string,
  data: {
    name: string;
    country?: string | null;
    variant?: string | null;
    lengthM?: number | string | null;
    cornerCount?: number | string | null;
    referenceLapSeconds?: number | string | null;
    notes?: string | null;
  }
) {
  const response = await fetch(`${API_URL}/api/tracks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

// Ricalcola il profilo curve dall'import di telemetria piu' recente
// collegato al circuito.
export async function regenerateTrackProfile(id: string) {
  const response = await fetch(`${API_URL}/api/tracks/${id}/profile`, {
    method: "POST",
  });

  const body = (await response.json()) as {
    profile?: TrackProfile;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error ?? "Impossibile generare il profilo");
  }

  return body;
}

export async function saveTrackLayout(
  id: string,
  points: { lat: number; lon: number }[]
) {
  const response = await fetch(`${API_URL}/api/tracks/${id}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  });

  return response.json();
}

export async function activateTrack(id: string) {
  const response = await fetch(`${API_URL}/api/tracks/${id}/activate`, {
    method: "PATCH",
  });

  return response.json();
}

export async function deleteTrack(id: string) {
  const response = await fetch(`${API_URL}/api/tracks/${id}`, {
    method: "DELETE",
  });

  return response.json();
}
