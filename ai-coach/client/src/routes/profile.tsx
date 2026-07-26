import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { usePilotStore } from "../stores/pilot.store";

export const Route = createFileRoute("/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  const setPilot = usePilotStore((state) => state.setPilot);

  const [form, setForm] = useState({
    name: "",
    level: "",
    experience: "",
    drivingStyle: "",
  });

  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) return;

    setSaving(true);

    try {
      const response = await fetch("http://localhost:3001/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (data?.id) {
        setPilot(data.id, form.name);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Profilo Pilota</h1>

      <input
        className="w-full rounded border p-2"
        placeholder="Nome"
        value={form.name}
        onChange={(e) =>
          setForm({
            ...form,
            name: e.target.value,
          })
        }
      />

      <input
        className="w-full rounded border p-2"
        placeholder="Livello"
        value={form.level}
        onChange={(e) =>
          setForm({
            ...form,
            level: e.target.value,
          })
        }
      />

      <input
        className="w-full rounded border p-2"
        placeholder="Esperienza"
        value={form.experience}
        onChange={(e) =>
          setForm({
            ...form,
            experience: e.target.value,
          })
        }
      />

      <input
        className="w-full rounded border p-2"
        placeholder="Stile guida"
        value={form.drivingStyle}
        onChange={(e) =>
          setForm({
            ...form,
            drivingStyle: e.target.value,
          })
        }
      />

      <button
        className="rounded border px-4 py-2"
        onClick={save}
        disabled={saving}
      >
        {saving ? "Salvataggio..." : "Salva"}
      </button>
    </div>
  );
}
