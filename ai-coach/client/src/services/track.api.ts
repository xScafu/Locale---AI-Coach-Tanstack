const API_URL = "http://localhost:3001";

export type Track = {
  id: string;
  pilotId: string;
  name: string;
  country: string | null;
  isActive?: boolean;
  layout?: string | null;
};

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
  data: { name: string; country?: string }
) {
  const response = await fetch(`${API_URL}/api/tracks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
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
