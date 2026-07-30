import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { usePilotStore } from "../stores/pilot.store";
import {
  activatePilot,
  createPilot,
  getPilots,
  updatePilot,
  type Pilot,
} from "../services/profile.api";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

const emptyForm = {
  name: "",
  level: "",
  experience: "",
  drivingStyle: "",
};

function pilotToForm(pilot: Pilot) {
  return {
    name: pilot.name,
    level: pilot.level ?? "",
    experience: pilot.experience ?? "",
    drivingStyle: pilot.drivingStyle ?? "",
  };
}

function ProfilePage() {
  const queryClient = useQueryClient();
  const setPilot = usePilotStore((state) => state.setPilot);
  const activePilotId = usePilotStore((state) => state.pilotId);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["pilots"],
    queryFn: getPilots,
  });

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function startEdit(pilot: Pilot) {
    setEditingId(pilot.id);
    setForm(pilotToForm(pilot));
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save() {
    if (!form.name.trim()) return;

    setSaving(true);

    try {
      if (editingId) {
        await updatePilot(editingId, form);

        // Se stavo modificando il pilota attualmente attivo, aggiorna
        // anche il nome mostrato altrove nell'app (es. Garage).
        if (editingId === activePilotId) {
          setPilot(editingId, form.name);
        }
      } else {
        const result = await createPilot(form);

        // Un pilota appena creato diventa automaticamente attivo lato
        // server (vedi createPilot -> deactivatePilots), quindi
        // sincronizziamo subito anche lo store del client.
        setPilot(result.id, form.name);
      }

      await queryClient.invalidateQueries({ queryKey: ["pilots"] });
      cancelForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(pilot: Pilot) {
    setBusyId(pilot.id);

    try {
      await activatePilot(pilot.id);
      setPilot(pilot.id, pilot.name);
      await queryClient.invalidateQueries({ queryKey: ["pilots"] });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profilo Pilota</h1>
          <p className="text-sm text-gray-500">
            Il pilota attivo è quello di cui il coach conosce caratteristiche e
            stile di guida.
          </p>
        </div>

        {!formOpen && (
          <button className="rounded border px-4 py-2" onClick={startCreate}>
            + Nuovo pilota
          </button>
        )}
      </div>

      {formOpen && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Modifica pilota" : "Nuovo pilota"}
          </h2>

          <div className="space-y-3">
            <input
              className="w-full rounded border p-2"
              placeholder="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <input
              className="w-full rounded border p-2"
              placeholder="Livello"
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            />

            <input
              className="w-full rounded border p-2"
              placeholder="Esperienza"
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
            />

            <input
              className="w-full rounded border p-2"
              placeholder="Stile guida"
              value={form.drivingStyle}
              onChange={(e) =>
                setForm({ ...form, drivingStyle: e.target.value })
              }
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
                    ? "Aggiorna pilota"
                    : "Salva pilota"}
              </button>

              <button
                className="rounded border px-4 py-2"
                onClick={cancelForm}
                disabled={saving}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold">Piloti salvati</h2>

        {isPending && <p>Caricamento...</p>}

        {!isPending && (!data?.items || data.items.length === 0) && (
          <p className="text-sm text-gray-500">
            Nessun pilota ancora. Creane uno per iniziare.
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.items?.map((pilot) => (
            <div
              key={pilot.id}
              className={`cursor-pointer rounded-lg border p-4 transition ${
                pilot.isActive ? "border-blue-500 bg-blue-50" : ""
              }`}
              onClick={() => {
                if (!pilot.isActive) handleActivate(pilot);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{pilot.name}</div>

                {pilot.isActive && (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    Attivo
                  </span>
                )}
              </div>

              <div className="mt-2 space-y-1 text-sm text-gray-500">
                <div>Livello: {pilot.level ?? "-"}</div>
                <div>Esperienza: {pilot.experience ?? "-"}</div>
                <div>Stile: {pilot.drivingStyle ?? "-"}</div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                {!pilot.isActive && (
                  <span className="text-sm text-blue-600">
                    {busyId === pilot.id
                      ? "Attivazione..."
                      : "Click per attivare"}
                  </span>
                )}

                <button
                  className="text-sm text-gray-600 underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(pilot);
                  }}
                >
                  Modifica
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
