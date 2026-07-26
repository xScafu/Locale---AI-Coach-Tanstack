import DashboardCard from "../components/dashboard/DashboardCard";
import { useDashboard } from "../hooks/useDashboard";

export default function Dashboard() {
  const { data, isPending } = useDashboard();

  if (isPending) {
    return <p>Caricamento...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <DashboardCard
          title="Profilo"
          value={data?.pilot?.name ?? "Nessun pilota"}
          subtitle={data?.pilot?.level}
        />

        <DashboardCard title="Auto" value={data?.car?.name ?? "Nessuna auto"} />

        <DashboardCard
          title="Circuito"
          value={data?.track?.name ?? "Nessun circuito"}
        />

        <DashboardCard
          title="Messaggi"
          value={String(data?.stats.messages ?? 0)}
        />

        <div className="rounded-lg border bg-white p-5">
          <h2 className="font-semibold">Coach Memory</h2>
          <p className="mt-4 whitespace-pre-wrap">
            {data?.memory || "Nessuna memoria disponibile"}
          </p>
        </div>
      </div>
    </div>
  );
}
