import { Link } from "@tanstack/react-router";
import type { NavigationItem } from "../../types/navigation";
import SidebarFooter from "../sidebar/SidebarFooter";

const menu: NavigationItem[] = [
  {
    title: "Dashboard",
    to: "/dashboard",
    icon: "🏠",
  },
  {
    title: "Chat",
    to: "/chat",
    icon: "💬",
  },
  {
    title: "Profilo",
    to: "/profile",
    icon: "👤",
  },
  {
    title: "Garage",
    to: "/garage",
    icon: "🚗",
  },
  {
    title: "Circuiti",
    to: "/tracks",
    icon: "🏁",
  },
  {
    title: "Sessioni",
    to: "/sessions",
    icon: "📂",
  },
  {
    title: "Settings",
    to: "/settings",
    icon: "⚙",
  },
];

export default function Sidebar() {
  return (
    <aside className="flex w-64 flex-col border-r bg-slate-900 text-white">
      <div className="border-b p-6">
        <h1 className="text-xl font-bold">🚦 AI Coach</h1>
      </div>

      <nav className="flex-1 p-3">
        {menu.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800"
            activeProps={{
              className:
                "mb-1 flex items-center gap-3 rounded-lg bg-blue-600 px-3 py-2",
            }}
          >
            <span>{item.icon}</span>

            <span>{item.title}</span>
          </Link>
        ))}
      </nav>

      <SidebarFooter />
    </aside>
  );
}
