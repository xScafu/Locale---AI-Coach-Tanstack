import { useSettingsStore } from "../../stores/settings.store";

export default function SidebarFooter() {
  const model = useSettingsStore((state) => state.model);

  return <div className="border-t p-4 text-sm text-slate-400">🟢 {model}</div>;
}
