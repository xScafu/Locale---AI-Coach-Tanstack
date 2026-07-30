const API_URL = "http://localhost:3001";

export type Pilot = {
  id: string;
  name: string;
  level: string | null;
  experience: string | null;
  drivingStyle: string | null;
  isActive?: boolean;
};

export async function getActivePilot() {
  const response = await fetch(`${API_URL}/api/profile/current`);

  if (!response.ok) {
    throw new Error("Impossibile leggere il pilota attivo");
  }

  return response.json() as Promise<{ pilot: Pilot | null }>;
}

export async function getPilots() {
  const response = await fetch(`${API_URL}/api/profile`);
  return response.json() as Promise<{ items: Pilot[] }>;
}

export async function createPilot(data: {
  name: string;
  level: string;
  experience: string;
  drivingStyle: string;
}) {
  const response = await fetch(`${API_URL}/api/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json() as Promise<{ id: string }>;
}

export async function updatePilot(
  id: string,
  data: {
    name: string;
    level: string;
    experience: string;
    drivingStyle: string;
  }
) {
  const response = await fetch(`${API_URL}/api/profile/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

export async function activatePilot(id: string) {
  const response = await fetch(`${API_URL}/api/profile/${id}/activate`, {
    method: "PATCH",
  });

  return response.json();
}
