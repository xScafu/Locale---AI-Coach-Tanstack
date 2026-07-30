import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getSettings, updateSettings } from "../services/settings.ap";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const defaultForm = {
  openAiModel: "gpt-5-mini",
  maxInputTokens: 3000,
  maxOutputTokens: 4000,
  temperature: 0.7,
  autoSummaryEvery: 20,
};

function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  useEffect(() => {
    const current = settingsQuery.data?.settings;
    if (!current) return;

    setForm({
      openAiModel: current.openAiModel ?? defaultForm.openAiModel,
      maxInputTokens: current.maxInputTokens ?? defaultForm.maxInputTokens,
      maxOutputTokens: current.maxOutputTokens ?? defaultForm.maxOutputTokens,
      temperature: current.temperature ?? defaultForm.temperature,
      autoSummaryEvery:
        current.autoSummaryEvery ?? defaultForm.autoSummaryEvery,
    });
  }, [settingsQuery.data]);

  async function save() {
    setSaving(true);
    setSaved(false);

    try {
      await updateSettings(form);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-sm text-gray-500">
          Parametri del modello usato dal coach in chat.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <label className="text-sm font-medium">Modello OpenAI</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.openAiModel}
            onChange={(e) => setForm({ ...form, openAiModel: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Max output tokens (include il ragionamento interno sui modelli
            reasoning: valori bassi possono causare risposte vuote)
          </label>
          <input
            type="number"
            className="mt-1 w-full rounded border p-2"
            value={form.maxOutputTokens}
            onChange={(e) =>
              setForm({ ...form, maxOutputTokens: Number(e.target.value) })
            }
          />
        </div>

        <div>
          <label className="text-sm font-medium">Max input tokens</label>
          <input
            type="number"
            className="mt-1 w-full rounded border p-2"
            value={form.maxInputTokens}
            onChange={(e) =>
              setForm({ ...form, maxInputTokens: Number(e.target.value) })
            }
          />
        </div>

        <div>
          <label className="text-sm font-medium">Temperature</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="2"
            className="mt-1 w-full rounded border p-2"
            value={form.temperature}
            onChange={(e) =>
              setForm({ ...form, temperature: Number(e.target.value) })
            }
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Riassunto automatico memoria ogni N messaggi
          </label>
          <input
            type="number"
            className="mt-1 w-full rounded border p-2"
            value={form.autoSummaryEvery}
            onChange={(e) =>
              setForm({ ...form, autoSummaryEvery: Number(e.target.value) })
            }
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            className="rounded border px-4 py-2 disabled:opacity-50"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Salvataggio..." : "Salva impostazioni"}
          </button>

          {saved && <span className="text-sm text-green-600">Salvato ✓</span>}
        </div>
      </div>
    </div>
  );
}
