const API_URL = "http://localhost:3001";

export type DashboardData = {
  pilot: { name: string; level: string | null } | null;
  car: { manufacturer: string | null; name: string } | null;
  track: { name: string; country: string | null } | null;
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
