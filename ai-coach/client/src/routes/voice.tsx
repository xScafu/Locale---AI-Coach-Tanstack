import { createFileRoute } from "@tanstack/react-router";

import PageHeader from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/voice")({
  component: Voice,
});

function Voice() {
  return (
    <div className="space-y-6">
      <PageHeader title="Voice" />

      {/* Segnaposto: la rotta esiste ma non e' ancora collegata alla
          sidebar e non ha funzionalita'. */}
      <Card className="border-dashed">
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Funzionalità non ancora implementata.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
