const API_URL = "http://localhost:3001";

export type SessionSummary = {
  id: string;
  title: string;
  createdAt: number;
  messageCount: number;
};

export type SessionMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: number;
};

export async function getSessions() {
  const response = await fetch(`${API_URL}/api/sessions`);
  return response.json() as Promise<{ items: SessionSummary[] }>;
}

export async function getSessionMessages(id: string) {
  const response = await fetch(`${API_URL}/api/sessions/${id}/messages`);
  return response.json() as Promise<{ items: SessionMessage[] }>;
}

export async function deleteSession(id: string) {
  const response = await fetch(`${API_URL}/api/sessions/${id}`, {
    method: "DELETE",
  });
  return response.json();
}
