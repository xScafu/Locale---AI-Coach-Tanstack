import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">AI Coach</h1>

      <p>Dashboard iniziale</p>
    </div>
  );
}
