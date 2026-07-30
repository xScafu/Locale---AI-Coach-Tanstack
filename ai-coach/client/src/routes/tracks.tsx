import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  activateTrack,
  createTrack,
  deleteTrack,
  getTracks,
} from "../services/track.api";
import { usePilotStore } from "../stores/pilot.store";

export const Route = createFileRoute("/tracks")({
  component: TracksPage,
});

function TracksPage() {
  const queryClient = useQueryClient();
  const pilotId = usePilotStore((state) => state.pilotId);

  const [form, setForm] = useState({ name: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["tracks", pilotId],
    queryFn: () => getTracks(pilotId as string),
    enabled: !!pilotId,
  });

  async function save() {
    if (!pilotId || !form.name.trim()) return;

    setSaving(true);

    try {
      await createTrack({ pilotId, name: form.name, country: form.country });
      setForm({ name: "", country: "" });
      await queryClient.invalidateQueries({ queryKey: ["tracks", pilotId] });
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    setBusyId(id);
    try {
      await activateTrack(id);
      await queryClient.invalidateQueries({ queryKey: ["tracks", pilotId] });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminare questo circuito?")) return;

    setBusyId(id);
    try {
      await deleteTrack(id);
      await queryClient.invalidateQueries({ queryKey: ["tracks", pilotId] });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Circuiti</h1>
        <p className="text-sm text-gray-500">
          Il circuito attivo viene passato al coach come contesto in chat.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Nuovo circuito</h2>

          <div className="space-y-3">
            <input
              className="w-full rounded border p-2"
              placeholder="Nome circuito"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="w-full rounded border p-2"
              placeholder="Paese"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />

            <button
              className="rounded border px-4 py-2 disabled:opacity-50"
              onClick={save}
              disabled={!pilotId || saving}
            >
              {saving ? "Salvataggio..." : "Salva circuito"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Circuiti salvati</h2>

          {!pilotId && (
            <p className="text-sm text-gray-500">
              Salva prima un profilo pilota.
            </p>
          )}

          {pilotId && isPending && <p>Caricamento...</p>}

          <div className="space-y-3">
            {data?.items?.map((track) => (
              <div key={track.id} className="rounded border p-3">
                <div className="font-medium">
                  {track.name}
                  {track.isActive && (
                    <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      Attivo
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {track.country ?? "Paese non specificato"}
                </div>

                <div className="mt-3 flex gap-3">
                  {!track.isActive && (
                    <button
                      className="text-sm text-blue-600 underline disabled:opacity-50"
                      disabled={busyId === track.id}
                      onClick={() => handleActivate(track.id)}
                    >
                      Imposta come attivo
                    </button>
                  )}
                  <button
                    className="text-sm text-red-600 underline disabled:opacity-50"
                    disabled={busyId === track.id}
                    onClick={() => handleDelete(track.id)}
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
