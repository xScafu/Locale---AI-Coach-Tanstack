import { Brain, Car, Flag, MessageSquare, User } from "lucide-react";

import DashboardCard from "@/components/dashboard/DashboardCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/useDashboard";

// Prima era `data?.car?.manufacturer + " " + data?.car?.name`: senza
// auto in DB il risultato era la stringa "undefined undefined", che
// essendo truthy passava indenne dal `?? "Nessuna auto"`. Il fallback
// non si vedeva mai.
function carLabel(car: { manufacturer: string | null; name: string } | null) {
  if (!car) return null;

  return [car.manufacturer, car.name].filter(Boolean).join(" ");
}

export default function Dashboard() {
  const { data, isPending, isError } = useDashboard();

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>

        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardContent>
          <p className="text-sm">
            Impossibile caricare la dashboard. Controlla che il server sia
            attivo su <code className="font-mono">localhost:3001</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const car = carLabel(data.car);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Il contesto che il coach sta usando in questo momento.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Pilota"
          icon={User}
          value={data.pilot?.name ?? "Nessun pilota"}
          subtitle={data.pilot?.level}
          empty={!data.pilot}
        />

        <DashboardCard
          title="Auto"
          icon={Car}
          value={car ?? "Nessuna auto"}
          empty={!car}
        />

        <DashboardCard
          title="Circuito"
          icon={Flag}
          value={data.track?.name ?? "Nessun circuito"}
          subtitle={data.track?.country}
          empty={!data.track}
        />

        <DashboardCard
          title="Messaggi"
          icon={MessageSquare}
          value={String(data.stats.messages)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Brain className="size-4" />
            Memoria del coach
          </CardTitle>
        </CardHeader>

        <CardContent>
          {data.memory ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {data.memory}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nessuna memoria disponibile. Viene generata automaticamente ogni
              20 messaggi di chat.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
