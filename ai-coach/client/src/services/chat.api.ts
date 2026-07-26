const API_URL = "http://localhost:3001";

export async function sendMessage(
  message: string,
  sessionId?: string,
  pilotId?: string
) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      sessionId,
      pilotId,
    }),
  });

  if (!response.ok) {
    throw new Error("Chat error");
  }

  return response.json();
}
