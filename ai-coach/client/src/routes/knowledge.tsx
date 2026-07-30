import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  getKnowledgeEntries,
  updateKnowledgeEntry,
  type KnowledgeEntry,
} from "../services/knowledge.api";

export const Route = createFileRoute("/knowledge")({
  component: KnowledgePage,
});

const CATEGORIES = [
  "Setup",
  "Tecnica di guida",
  "Problema-Soluzione",
  "Generale",
];

const emptyForm = {
  category: CATEGORIES[0],
  title: "",
  content: "",
  tags: "",
};

function entryToForm(entry: KnowledgeEntry) {
  return {
    category: entry.category,
    title: entry.title,
    content: entry.content,
    tags: entry.tags ?? "",
  };
}

function KnowledgePage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["knowledge", search],
    queryFn: () => getKnowledgeEntries(search || undefined),
  });

  function startEdit(entry: KnowledgeEntry) {
    setEditingId(entry.id);
    setForm(entryToForm(entry));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save() {
    if (!form.title.trim() || !form.content.trim()) return;

    setSaving(true);

    try {
      if (editingId) {
        await updateKnowledgeEntry(editingId, form);
      } else {
        await createKnowledgeEntry(form);
      }

      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questa voce dalla Knowledge Base?")) return;

    setBusyId(id);

    try {
      await deleteKnowledgeEntry(id);
      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });

      if (editingId === id) {
        cancelEdit();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-sm text-gray-500">
          Voci che il coach consulta automaticamente in base al messaggio
          dell'utente per dare consigli più mirati.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Modifica voce" : "Nuova voce"}
          </h2>

          <div className="space-y-3">
            <select
              className="w-full rounded border p-2"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <input
              className="w-full rounded border p-2"
              placeholder="Titolo"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />

            <textarea
              className="w-full rounded border p-2"
              placeholder="Contenuto"
              rows={5}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />

            <input
              className="w-full rounded border p-2"
              placeholder="Tag separati da virgola (es. sottosterzo, freni, GT3)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />

            <div className="flex gap-3">
              <button
                className="rounded border px-4 py-2 disabled:opacity-50"
                onClick={save}
                disabled={saving}
              >
                {saving
                  ? "Salvataggio..."
                  : editingId
                    ? "Aggiorna voce"
                    : "Salva voce"}
              </button>

              {editingId && (
                <button
                  className="rounded border px-4 py-2"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Annulla
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Voci salvate</h2>

            <input
              className="rounded border p-2 text-sm"
              placeholder="Cerca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isPending && <p>Caricamento...</p>}

          {!isPending && (!data?.items || data.items.length === 0) && (
            <p className="text-sm text-gray-500">Nessuna voce trovata.</p>
          )}

          <div className="space-y-3">
            {data?.items?.map((entry) => (
              <div key={entry.id} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{entry.title}</div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {entry.category}
                  </span>
                </div>

                <p className="mt-2 text-sm text-gray-600">{entry.content}</p>

                {entry.tags && (
                  <div className="mt-2 text-xs text-gray-400">
                    Tag: {entry.tags}
                  </div>
                )}

                <div className="mt-3 flex gap-3">
                  <button
                    className="text-sm text-blue-600 underline"
                    onClick={() => startEdit(entry)}
                  >
                    Modifica
                  </button>
                  <button
                    className="text-sm text-red-600 underline disabled:opacity-50"
                    disabled={busyId === entry.id}
                    onClick={() => remove(entry.id)}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
