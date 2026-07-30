import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CloudUpload,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import {
  uploadTelemetry,
  type ImportSync,
  type SyncEntity,
} from "@/services/telemetry.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatLapTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;

  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, "0")}` : `${s.toFixed(3)}s`;
}

function SyncRow({ label, entity }: { label: string; entity: SyncEntity | null }) {
  if (!entity) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">non presente nel file</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>

      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{entity.name}</span>

        <Badge
          variant={entity.action === "created" ? "default" : "secondary"}
          className="shrink-0"
        >
          {entity.action === "created" ? (
            <>
              <Plus className="size-3" />
              creato
            </>
          ) : (
            <>
              <RefreshCw className="size-3" />
              riconosciuto
            </>
          )}
        </Badge>
      </span>
    </div>
  );
}

export default function TelemetryUploader() {
  const queryClient = useQueryClient();

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportSync | null>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".duckdb")) {
      toast.error("Serve un file .duckdb esportato da Le Mans Ultimate");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const response = await uploadTelemetry(file);
      const sync = response.sync ?? null;

      setResult(sync);

      // Tutto puo' essere cambiato: pilota, auto e circuito attivi,
      // profilo del tracciato, elenco degli import. Il pilota attivo
      // arriva dal server, quindi basta invalidare.
      await queryClient.invalidateQueries();

      toast.success(`${file.name} importato`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Importazione non riuscita"
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);

            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={
            dragging
              ? "border-primary bg-primary/5 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors"
              : "hover:border-foreground/25 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors"
          }
        >
          {uploading ? (
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          ) : (
            <CloudUpload className="text-muted-foreground size-6" />
          )}

          <p className="text-sm font-medium">
            {uploading
              ? "Lettura del file in corso..."
              : "Trascina qui una telemetria, o clicca per sceglierla"}
          </p>

          <p className="text-muted-foreground max-w-md text-sm">
            Dal file <span className="font-mono">.duckdb</span> vengono
            riconosciuti pilota, auto e circuito: se non esistono li crea, poi
            li rende attivi e ricalcola il profilo del tracciato.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".duckdb"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {result && (
          <div className="mt-4 rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="text-primary size-4" />
              Contesto aggiornato da questa sessione
            </div>

            <div className="divide-y">
              <SyncRow label="Pilota" entity={result.pilot} />
              <SyncRow label="Auto" entity={result.car} />
              <SyncRow label="Circuito" entity={result.track} />
            </div>

            <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm">
              {result.session.type && <span>Sessione: {result.session.type}</span>}
              {result.session.weather && <span>Meteo: {result.session.weather}</span>}
              {result.session.recordedAt && (
                <span>
                  Registrata:{" "}
                  {new Date(result.session.recordedAt * 1000).toLocaleString(
                    "it-IT"
                  )}
                </span>
              )}
            </div>

            {result.profile && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm">
                <span>
                  <span className="text-muted-foreground">Curve: </span>
                  <span className="font-mono">{result.profile.corners}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Lunghezza: </span>
                  <span className="font-mono">{result.profile.lengthM} m</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Giro migliore: </span>
                  <span className="font-mono">
                    {formatLapTime(result.profile.bestLapSeconds)}
                  </span>
                </span>
                {result.profile.theoreticalLapSeconds !== null && (
                  <span>
                    <span className="text-muted-foreground">Teorico: </span>
                    <span className="font-mono">
                      {formatLapTime(result.profile.theoreticalLapSeconds)}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {!result && !uploading && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => inputRef.current?.click()}
          >
            Scegli un file
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
