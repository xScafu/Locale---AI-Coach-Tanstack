const API_URL = "http://localhost:3001";

export type KnowledgeEntry = {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string | null;
};

export async function getKnowledgeEntries(query?: string) {
  const url = query
    ? `${API_URL}/api/knowledge?q=${encodeURIComponent(query)}`
    : `${API_URL}/api/knowledge`;

  const response = await fetch(url);
  return response.json() as Promise<{ items: KnowledgeEntry[] }>;
}

export async function createKnowledgeEntry(data: {
  category: string;
  title: string;
  content: string;
  tags?: string;
}) {
  const response = await fetch(`${API_URL}/api/knowledge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

export async function updateKnowledgeEntry(
  id: string,
  data: {
    category: string;
    title: string;
    content: string;
    tags?: string;
  }
) {
  const response = await fetch(`${API_URL}/api/knowledge/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return response.json();
}

export async function deleteKnowledgeEntry(id: string) {
  const response = await fetch(`${API_URL}/api/knowledge/${id}`, {
    method: "DELETE",
  });

  return response.json();
}
