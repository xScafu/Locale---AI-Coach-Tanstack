import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/voice")({
  component: Voice,
});

function Voice() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Voice</h1>
    </div>
  );
}
