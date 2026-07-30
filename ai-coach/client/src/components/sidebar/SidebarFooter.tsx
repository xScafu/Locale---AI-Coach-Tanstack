import { useSettingsStore } from "@/stores/settings.store";

export default function SidebarFooter() {
  const model = useSettingsStore((state) => state.model);

  return (
    <div className="border-sidebar-border border-t p-4">
      <div className="text-sidebar-foreground/60 flex items-center gap-2 text-xs">
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-emerald-400"
        />
        <span className="truncate font-mono">{model}</span>
      </div>
    </div>
  );
}
