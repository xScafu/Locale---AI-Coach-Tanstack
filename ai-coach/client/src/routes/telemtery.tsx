import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/telemtery")({
  component: Telemetry,
});

function Telemetry() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Telemetry</h1>
    </div>
  );
}
