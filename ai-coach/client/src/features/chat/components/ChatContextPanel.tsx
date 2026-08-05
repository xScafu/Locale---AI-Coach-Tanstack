import { Car, Flag, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatLapTime } from "@/lib/lap-time";
import { useDashboard } from "@/hooks/useDashboard";
import { parseTrackProfile } from "@/services/track.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ContextCard({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: LucideIcon;
  empty?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
          <Icon className="size-3.5" />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pt-0 pb-4">
        {empty ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// Riga chiave/valore: il valore va a capo sotto l'etichetta solo se
// serve, cosi' la colonna resta stretta senza troncare i nomi lunghi.
function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default function ChatContextPanel() {
  const { data, isPending } = useDashboard();

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const pilot = data?.pilot ?? null;
  const car = data?.car ?? null;
  const track = data?.track ?? null;
  const profile = track ? parseTrackProfile(track) : null;

  const carName = car
    ? [car.manufacturer, car.name].filter(Boolean).join(" ")
    : null;

  return (
    <div className="space-y-4">
      <ContextCard
        title="Pilota"
        icon={User}
        empty={pilot ? undefined : "Nessun pilota attivo."}
      >
        <p className="font-medium">{pilot?.name}</p>

        <div className="mt-2 divide-y">
          <Row label="Livello" value={pilot?.level ?? null} />
          <Row label="Esperienza" value={pilot?.experience ?? null} />
          <Row label="Stile" value={pilot?.drivingStyle ?? null} />
        </div>
      </ContextCard>

      <ContextCard
        title="Auto attiva"
        icon={Car}
        empty={car ? undefined : "Nessuna auto attiva."}
      >
        <p className="font-medium">{carName}</p>

        <div className="mt-2 divide-y">
          <Row label="Categoria" value={car?.category ?? null} />
          <Row label="Simulatore" value={car?.simulator ?? null} />
        </div>

        {car?.notes && (
          <p className="text-muted-foreground mt-2 border-t pt-2 text-sm leading-relaxed">
            {car.notes}
          </p>
        )}
      </ContextCard>

      <ContextCard
        title="Circuito"
        icon={Flag}
        empty={track ? undefined : "Nessun circuito attivo."}
      >
        <p className="font-medium">{track?.name}</p>

        <div className="mt-2 divide-y">
          <Row
            label="Variante"
            value={
              track?.variant && track.variant !== track.name
                ? track.variant
                : null
            }
          />
          <Row label="Paese" value={track?.country ?? null} />
          <Row
            label="Lunghezza"
            value={track?.lengthM ? `${Math.round(track.lengthM)} m` : null}
          />
          <Row
            label="Curve"
            value={track?.cornerCount ? String(track.cornerCount) : null}
          />
        </div>

        {profile && (
          <div className="mt-3 space-y-1.5 border-t pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground text-xs">
                Giro migliore
              </span>
              <span className="font-mono text-sm">
                {formatLapTime(profile.bestLapSeconds)}
              </span>
            </div>

            {profile.reference?.theoreticalLapSeconds != null && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground text-xs">Teorico</span>
                <span className="font-mono text-sm">
                  {formatLapTime(profile.reference.theoreticalLapSeconds)}
                  <span className="text-primary ml-1.5 text-xs">
                    −{profile.reference.potentialGainSeconds?.toFixed(2)}s
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {!profile && track && (
          <p className="text-muted-foreground mt-2 border-t pt-2 text-sm">
            Nessun profilo curve: importa una telemetria di questo circuito.
          </p>
        )}
      </ContextCard>

      {/* Il coach riceve esattamente queste informazioni nel prompt: la
          card non e' decorativa, mostra il contesto reale della
          conversazione. */}
      <p className="text-muted-foreground px-1 text-xs leading-relaxed">
        È il contesto che il coach sta usando in questa conversazione.
        {profile ? " Profilo curve incluso." : ""}
      </p>
    </div>
  );
}
