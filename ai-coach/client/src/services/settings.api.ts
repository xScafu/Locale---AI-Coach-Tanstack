const API_URL = "http://localhost:3001";

export type AppSettings = {
  id: string;
  openAiModel: string | null;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  temperature: number | null;
  autoSummaryEvery: number | null;
};

export async function getSettings() {
  const response = await fetch(`${API_URL}/api/settings`);
  return response.json() as Promise<{ settings: AppSettings | null }>;
}

export async function updateSettings(data: {
  openAiModel: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  temperature: number;
  autoSummaryEvery: number;
}) {
  const response = await fetch(`${API_URL}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}
