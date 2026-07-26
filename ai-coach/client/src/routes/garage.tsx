import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createCar, getCars } from "../services/garage.api";
import { usePilotStore } from "../stores/pilot.store";

export const Route = createFileRoute("/garage")({
  component: GaragePage,
});

function GaragePage() {
  const queryClient = useQueryClient();

  const pilotId = usePilotStore((state) => state.pilotId);
  const pilotName = usePilotStore((state) => state.pilotName);

  const [form, setForm] = useState({
    manufacturer: "",
    name: "",
    simulator: "Le Mans Ultimate",
    category: "GT3",
    notes: "",
  });

  const [saving, setSaving] = useState(false);

  const { data, isPending, refetch } = useQuery({
    queryKey: ["cars", pilotId],
    queryFn: () => getCars(pilotId as string),
    enabled: !!pilotId,
  });

  async function save() {
    if (!pilotId || !form.name.trim()) return;

    setSaving(true);

    try {
      await createCar({
        pilotId,
        manufacturer: form.manufacturer,
        name: form.name,
        simulator: form.simulator,
        category: form.category,
        notes: form.notes,
      });

      setForm({
        manufacturer: "",
        name: "",
        simulator: "Le Mans Ultimate",
        category: "GT3",
        notes: "",
      });

      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["cars", pilotId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Garage</h1>
        <p className="text-sm text-gray-500">
          {pilotId
            ? `Pilota attivo: ${pilotName ?? pilotId}`
            : "Nessun pilota attivo. Salva prima il profilo."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Nuova auto</h2>

          <div className="space-y-3">
            <input
              className="w-full rounded border p-2"
              placeholder="Marca"
              value={form.manufacturer}
              onChange={(e) =>
                setForm({ ...form, manufacturer: e.target.value })
              }
            />

            <input
              className="w-full rounded border p-2"
              placeholder="Nome auto"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <input
              className="w-full rounded border p-2"
              placeholder="Simulatore"
              value={form.simulator}
              onChange={(e) => setForm({ ...form, simulator: e.target.value })}
            />

            <input
              className="w-full rounded border p-2"
              placeholder="Categoria"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />

            <textarea
              className="w-full rounded border p-2"
              placeholder="Note"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            <button
              className="rounded border px-4 py-2 disabled:opacity-50"
              onClick={save}
              disabled={!pilotId || saving}
            >
              {saving ? "Salvataggio..." : "Salva auto"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Auto salvate</h2>

          {!pilotId && (
            <p className="text-sm text-gray-500">
              Salva prima un profilo pilota per vedere il garage.
            </p>
          )}

          {pilotId && isPending && <p>Caricamento...</p>}

          {pilotId &&
            !isPending &&
            (!data?.items || data.items.length === 0) && (
              <p className="text-sm text-gray-500">Nessuna auto salvata.</p>
            )}

          <div className="space-y-3">
            {data?.items?.map((car) => (
              <div key={car.id} className="rounded border p-3">
                <div className="font-medium">{car.name}</div>
                <div className="text-sm text-gray-500">
                  {car.manufacturer ?? "Senza marca"} ·{" "}
                  {car.category ?? "Senza categoria"} ·{" "}
                  {car.simulator ?? "Senza simulatore"}
                </div>

                {car.notes && <div className="mt-2 text-sm">{car.notes}</div>}

                <div className="mt-3">
                  <Link
                    to="/garage/$carId"
                    params={{ carId: car.id }}
                    className="text-sm underline"
                  >
                    Apri dettaglio
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
