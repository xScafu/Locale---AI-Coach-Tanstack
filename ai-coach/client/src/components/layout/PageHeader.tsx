type PageHeaderProps = {
  title: string;
  description?: string;
  /** Azione principale della pagina, allineata a destra del titolo. */
  action?: React.ReactNode;
};

export default function PageHeader({
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>

        {description && (
          <p className="text-muted-foreground mt-1 max-w-prose text-sm">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}
