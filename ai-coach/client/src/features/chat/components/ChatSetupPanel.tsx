import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Loader2, Sliders, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  applySetupChanges,
  createSetup,
  getSetupSuggestions,
  getSetups,
  importSetupFile,
  setupExportUrl,
  SETUP_FIELD_LABELS,
  type Setup,
  type SetupChange,
} from "@/services/garage.api";
import { useDashboard } from "@/hooks/useDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// "FRONTLEFT.CamberSetting" -> "Frontleft · Camber". Il percorso grezzo
// e' preciso ma illeggibile in una colonna stretta.
function settingLabel(path: string) {
  const [section, key] = path.split(".");

  if (!key) return path;

  const readable = key
    .replace(/Setting$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2");

  const place = section.charAt(0) + section.slice(1).toLowerCase();

  return `${place} · ${readable}`;
}

function EmptyState({
  carId,
  onImported,
}: {
  carId: string | null;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function handleFile(file: File) {
    if (!carId) return;

    setImporting(true);

    try {
      const parsed = await importSetupFile(carId, file);

      const values = parsed.suggestions ?? {};

      if (Object.keys(values).length === 0) {
        toast.error(
          "Nessun valore riconosciuto nel file: il parser è best effort sul formato LMU"
        );
        return;
      }

      // Il setup importato diventa subito attivo (lo fa createSetup lato
      // server), cosi' il coach lo vede alla domanda successiva.
      await createSetup({
        carId,
        name: parsed.fileName.replace(/\.svm$/i, ""),
        // Il file integrale viene conservato: la tabella tiene solo
        // dodici valori, e senza l'originale non si potrebbe piu'
        // riesportare un .svm caricabile nel simulatore.
        sourceSvm: parsed.raw,
        sourceFileName: parsed.fileName,
        ...values,
      });

      toast.success(
        `Setup importato: ${Object.keys(values).length} valori riconosciuti`
      );

      onImported();
    } catch {
      toast.error("Importazione non riuscita");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Il coach non può proporre modifiche senza sapere da dove parti.
        Carica il tuo setup attuale.
      </p>

      <Button
        size="sm"
        className="w-full"
        disabled={!carId || importing}
        onClick={() => inputRef.current?.click()}
      >
        {importing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {importing ? "Lettura..." : "Carica setup .svm"}
      </Button>

      {!carId && (
        <p className="text-muted-foreground text-xs">
          Serve prima un'auto attiva.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".svm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

function Suggestions({
  setup,
  changes,
  onApplied,
}: {
  setup: Setup;
  changes: SetupChange[];
  onApplied: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    changes.map((c) => c.setting)
  );
  const [applying, setApplying] = useState(false);

  function toggle(field: string) {
    setSelected((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field]
    );
  }

  async function apply() {
    const picked = changes.filter((c) => selected.includes(c.setting));
    if (picked.length === 0) return;

    setApplying(true);

    try {
      // Crea una nuova versione invece di sovrascrivere: il setup di
      // partenza resta consultabile e ci si puo' tornare.
      await applySetupChanges(setup.id, picked);

      toast.success(
        picked.length === 1
          ? "Creata una nuova versione con 1 modifica"
          : `Creata una nuova versione con ${picked.length} modifiche`
      );

      onApplied();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Applicazione non riuscita"
      );
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {changes.map((change) => {
          const isSelected = selected.includes(change.setting);

          return (
            <button
              key={change.setting}
              type="button"
              onClick={() => toggle(change.setting)}
              className={
                isSelected
                  ? "border-primary bg-primary/5 w-full rounded-lg border p-2.5 text-left transition-colors"
                  : "hover:border-foreground/20 w-full rounded-lg border p-2.5 text-left transition-colors"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {settingLabel(change.setting)}
                </span>

                <span
                  aria-hidden
                  className={
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded border"
                      : "border-input flex size-4 shrink-0 rounded border"
                  }
                >
                  {isSelected && <Check className="size-3" />}
                </span>
              </div>

              <div className="mt-1 font-mono text-sm">
                <span className="text-primary font-medium">
                  {change.deltaClicks > 0 ? "+" : ""}
                  {change.deltaClicks} click
                </span>
              </div>

              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {change.reason}
              </p>
            </button>
          );
        })}
      </div>

      <Button
        size="sm"
        className="w-full"
        disabled={selected.length === 0 || applying}
        onClick={apply}
      >
        {applying
          ? "Applico..."
          : selected.length === changes.length
            ? "Applica tutte"
            : `Applica ${selected.length}`}
      </Button>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Viene creata una nuova versione, che diventa quella attiva. Il
        setup di partenza resta salvato nel garage.
      </p>
    </div>
  );
}

export default function ChatSetupPanel() {
  const queryClient = useQueryClient();
  const { data: dashboard, isPending: dashboardPending } = useDashboard();

  const carId = dashboard?.car?.id ?? null;

  const setupsQuery = useQuery({
    queryKey: ["setups", carId],
    queryFn: () => getSetups(carId as string),
    enabled: !!carId,
  });

  const suggestionsQuery = useQuery({
    queryKey: ["setup-suggestions"],
    queryFn: getSetupSuggestions,
  });

  const active =
    setupsQuery.data?.items?.find((s) => s.isActive) ??
    setupsQuery.data?.items?.[0] ??
    null;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["setups"] });
    queryClient.invalidateQueries({ queryKey: ["setup-suggestions"] });
  }

  const loading = dashboardPending || (!!carId && setupsQuery.isPending);

  const changes = suggestionsQuery.data?.changes ?? [];

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
          <Sliders className="size-3.5" />
          Setup
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pt-0 pb-4">
        {loading && <Skeleton className="h-28 rounded-lg" />}

        {!loading && !active && (
          <EmptyState carId={carId} onImported={refresh} />
        )}

        {!loading && active && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">
                {active.name}
              </span>
              {active.isActive && <Badge variant="secondary">attivo</Badge>}
            </div>

            {active.sourceSvm && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={setupExportUrl(active.id)} download>
                  <Download className="size-3.5" />
                  Scarica .svm per il simulatore
                </a>
              </Button>
            )}

            <div className="divide-y">
              {Object.entries(SETUP_FIELD_LABELS).map(([key, label]) => {
                const value = (
                  active as unknown as Record<string, number | null>
                )[key];

                if (value === null || value === undefined) return null;

                return (
                  <div
                    key={key}
                    className="flex items-baseline justify-between gap-2 py-1"
                  >
                    <span className="text-muted-foreground text-xs">
                      {label}
                    </span>
                    <span className="font-mono text-sm">{value}</span>
                  </div>
                );
              })}
            </div>

            {changes.length > 0 ? (
              <div className="border-t pt-3">
                <p className="mb-2 text-sm font-medium">
                  Proposte dal coach
                </p>

                <Suggestions
                  setup={active}
                  changes={changes}
                  onApplied={refresh}
                />
              </div>
            ) : (
              <p className="text-muted-foreground border-t pt-3 text-xs leading-relaxed">
                Chiedi al coach cosa cambiare: le modifiche che propone
                compaiono qui, applicabili con un click.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
