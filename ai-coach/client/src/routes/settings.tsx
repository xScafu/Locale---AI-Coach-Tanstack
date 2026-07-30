import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getSettings, updateSettings } from "@/services/settings.ap";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

    try {
      await updateSettings(form);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });

      // Prima era uno stato `saved` che, una volta acceso, non veniva
      // mai rimesso a false: la scritta "Salvato" restava a schermo
      // per sempre. Il toast sparisce da solo.
      toast.success("Impostazioni salvate");
    } catch {
      toast.error("Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Impostazioni"
        description="Parametri del modello usato dal coach in chat."
      />

      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="model">Modello OpenAI</Label>
            <Input
              id="model"
              className="font-mono"
              value={form.openAiModel}
              onChange={(e) =>
                setForm({ ...form, openAiModel: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-output">Max output tokens</Label>
            <Input
              id="max-output"
              type="number"
              className="font-mono"
              value={form.maxOutputTokens}
              onChange={(e) =>
                setForm({ ...form, maxOutputTokens: Number(e.target.value) })
              }
            />
            <p className="text-muted-foreground text-xs">
              Include il ragionamento interno sui modelli reasoning: valori
              bassi possono causare risposte vuote.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-input">Max input tokens</Label>
            <Input
              id="max-input"
              type="number"
              className="font-mono"
              value={form.maxInputTokens}
              onChange={(e) =>
                setForm({ ...form, maxInputTokens: Number(e.target.value) })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperature">Temperature</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              className="font-mono"
              value={form.temperature}
              onChange={(e) =>
                setForm({ ...form, temperature: Number(e.target.value) })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-summary">
              Riassunto automatico memoria ogni N messaggi
            </Label>
            <Input
              id="auto-summary"
              type="number"
              className="font-mono"
              value={form.autoSummaryEvery}
              onChange={(e) =>
                setForm({ ...form, autoSummaryEvery: Number(e.target.value) })
              }
            />
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva impostazioni"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
