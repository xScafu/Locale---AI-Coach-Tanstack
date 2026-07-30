import { createFileRoute, redirect } from "@tanstack/react-router";

// La rotta "/" era un segnaposto con scritto "Dashboard iniziale", cioe'
// un vicolo cieco: la vera dashboard e' su /dashboard.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
