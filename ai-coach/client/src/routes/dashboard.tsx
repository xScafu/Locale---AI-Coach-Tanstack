import { createFileRoute } from "@tanstack/react-router";

// Prima il componente Dashboard chiamava se stesso (<Dashboard /> dentro
// Dashboard), causando "Maximum call stack size exceeded" al primo
// render. La vera pagina esisteva già in pages/Dashboard.tsx ma non era
// collegata: bastava importarla.
import DashboardPage from "../pages/Dashboard";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});
