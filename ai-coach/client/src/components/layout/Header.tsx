import ThemeToggle from "@/components/theme-toggle";

type HeaderProps = {
  title?: string;
};

export default function Header({ title }: HeaderProps) {
  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b px-6 backdrop-blur">
      <h1 className="text-base font-semibold tracking-tight">
        {title ?? "AI Coach"}
      </h1>

      <ThemeToggle />
    </header>
  );
}
