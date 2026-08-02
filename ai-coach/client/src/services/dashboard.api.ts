import type { Track } from "@/services/track.api";

const API_URL = "http://localhost:3001";

export type DashboardPilot = {
  id: string;
  name: string;
  level: string | null;
  experience: string | null;
  drivingStyle: string | null;
};

export type DashboardCar = {
  id: string;
  manufacturer: string | null;
  name: string;
  simulator: string | null;
  category: string | null;
  notes: string | null;
};

export type DashboardData = {
  pilot: DashboardPilot | null;
  // La route restituisce la riga completa del circuito attivo, profilo
  // curve incluso: la chat lo usa per la card di contesto senza dover
  // interrogare /api/tracks a parte.
  car: DashboardCar | null;
  track: Track | null;
  memory: string;
  stats: { messages: number; tokens: number; cost: number };
};

export async function getDashboard() {
  const response = await fetch(`${API_URL}/api/dashboard`);

  if (!response.ok) {
    throw new Error("Impossibile caricare la dashboard");
  }

  return response.json() as Promise<DashboardData>;
}
