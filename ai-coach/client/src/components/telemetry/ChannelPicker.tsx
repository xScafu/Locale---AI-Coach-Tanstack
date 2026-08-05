import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Channel } from "@/services/telemetry.api";

// Questi cinque non compaiono nel selettore perche' la pagina Telemetria
// li mostra gia': i primi tre nei grafici fissi, gli altri due come
// mappa. Metterli nell'elenco inviterebbe a disegnarli due volte.
const ALREADY_ON_SCREEN = new Set([
  "Ground Speed",
  "Throttle Pos",
  "Brake Pos",
  "GPS Latitude",
  "GPS Longitude",
]);

// Il file contiene cinquantotto canali. Disegnarli tutti insieme
// renderebbe la pagina illeggibile e scaricherebbe decine di migliaia di
// punti per niente, quindi si scelgono: i tre di sempre restano fissi,
// il resto si aggiunge da qui. Il campo di ricerca serve perche' con
// cinquantatre voci scorrere l'elenco e' piu' lento che scriverne il
// nome.
export default function ChannelPicker({
  channels,
  picked,
  onToggle,
  onClear,
}: {
  channels: Channel[];
  picked: string[];
  onToggle: (name: string) => void;
  onClear: () => void;
}) {
  const [filter, setFilter] = useState("");

  const available = channels.filter((c) => !ALREADY_ON_SCREEN.has(c.name));
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? available.filter((c) => c.name.toLowerCase().includes(needle))
    : available;

  if (available.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          Altri canali del file ({available.length})
        </span>

        <div className="flex items-center gap-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Cerca canale..."
            className="h-8 w-44"
          />

          {picked.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Togli tutti
            </Button>
          )}
        </div>
      </div>

      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
        {shown.map((channel) => {
          const isPicked = picked.includes(channel.name);

          return (
            <Button
              key={channel.name}
              variant={isPicked ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => onToggle(channel.name)}
              title={`${channel.frequency} Hz${
                channel.unit ? `, ${channel.unit}` : ""
              }${channel.labels.length === 4 ? ", una traccia per ruota" : ""}`}
            >
              {channel.name}
              {channel.labels.length === 4 && (
                <span className="text-muted-foreground ml-1">×4</span>
              )}
            </Button>
          );
        })}

        {shown.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Nessun canale con questo nome.
          </p>
        )}
      </div>
    </div>
  );
}
