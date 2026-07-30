import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type DashboardCardProps = {
  title: string;
  value: string;
  subtitle?: string | null;
  icon?: LucideIcon;
  /** Il valore e' assente: va reso in tono minore, non come un dato. */
  empty?: boolean;
};

export default function DashboardCard({
  title,
  value,
  subtitle,
  icon: Icon,
  empty,
}: DashboardCardProps) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-5">
        <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
          {Icon && <Icon className="size-3.5" />}
          {title}
        </div>

        <p
          className={
            empty
              ? "text-muted-foreground mt-3 truncate text-lg"
              : "mt-3 truncate text-2xl font-semibold tracking-tight"
          }
          title={value}
        >
          {value}
        </p>

        {subtitle && (
          <p className="text-muted-foreground mt-1 truncate text-sm">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
