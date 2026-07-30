import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";

import { activateCar, createCar, deleteCar, getCars } from "@/services/garage.api";
import { usePilotStore } from "@/stores/pilot.store";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/garage/")({
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
  const [busyCarId, setBusyCarId] = useState<string | null>(null);

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

  async function handleActivate(carId: string) {
    setBusyCarId(carId);

    try {
      await activateCar(carId);
      await refetch();
    } finally {
      setBusyCarId(null);
    }
  }

  async function handleDelete(carId: string) {
    if (!confirm("Eliminare questa auto? L'azione non è reversibile.")) {
      return;
    }

    setBusyCarId(carId);

    try {
      await deleteCar(carId);
      await refetch();
    } finally {
      setBusyCarId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Garage"
        description={
          pilotId
            ? `Pilota attivo: ${pilotName ?? pilotId}`
            : "Nessun pilota attivo. Salva prima il profilo."
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nuova auto</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="car-manufacturer">Marca</Label>
                <Input
                  id="car-manufacturer"
                  placeholder="Es. BMW"
                  value={form.manufacturer}
                  onChange={(e) =>
                    setForm({ ...form, manufacturer: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="car-name">Nome auto</Label>
                <Input
                  id="car-name"
                  placeholder="Es. M4 GT3"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="car-simulator">Simulatore</Label>
                <Input
                  id="car-simulator"
                  value={form.simulator}
                  onChange={(e) =>
                    setForm({ ...form, simulator: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="car-category">Categoria</Label>
                <Input
                  id="car-category"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="car-notes">Note</Label>
              <Textarea
                id="car-notes"
                placeholder="Comportamento, gomme preferite, problemi ricorrenti..."
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <Button onClick={save} disabled={!pilotId || saving}>
              {saving ? "Salvataggio..." : "Salva auto"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto salvate</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {!pilotId && (
              <p className="text-muted-foreground text-sm">
                Salva prima un profilo pilota per vedere il garage.
              </p>
            )}

            {pilotId && isPending && (
              <>
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
              </>
            )}

            {pilotId &&
              !isPending &&
              (!data?.items || data.items.length === 0) && (
                <p className="text-muted-foreground text-sm">
                  Nessuna auto salvata.
                </p>
              )}

            {data?.items?.map((car) => (
              <div key={car.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{car.name}</span>
                  {car.isActive && <Badge>Attiva</Badge>}
                </div>

                <div className="text-muted-foreground mt-0.5 text-sm">
                  {car.manufacturer ?? "Senza marca"} ·{" "}
                  {car.category ?? "Senza categoria"} ·{" "}
                  {car.simulator ?? "Senza simulatore"}
                </div>

                {car.notes && (
                  <p className="mt-2 text-sm leading-relaxed">{car.notes}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/garage/$carId" params={{ carId: car.id }}>
                      Apri dettaglio
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </Button>

                  {!car.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyCarId === car.id}
                      onClick={() => handleActivate(car.id)}
                    >
                      Imposta come attiva
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busyCarId === car.id}
                    onClick={() => handleDelete(car.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Elimina
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
