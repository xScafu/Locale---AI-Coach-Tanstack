const API_URL = "http://localhost:3001";

// Prima non esisteva nessuna funzione client per chiamare
// POST /api/sessions: la chat partiva sempre con sessionId undefined
// e la route /api/chat rispondeva 400 "sessionId required" al primo
// messaggio.
export async function createSession() {
  const response = await fetch(`${API_URL}/api/sessions`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Impossibile creare la sessione di chat");
  }

  return response.json() as Promise<{ id: string }>;
}

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
