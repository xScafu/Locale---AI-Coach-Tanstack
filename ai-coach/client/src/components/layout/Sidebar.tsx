import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Car,
  ChartLine,
  Flag,
  FolderClock,
  LayoutDashboard,
  MessageSquare,
  Settings,
  User,
} from "lucide-react";

import type { NavigationItem } from "@/types/navigation";
import SidebarFooter from "@/components/sidebar/SidebarFooter";

const menu: NavigationItem[] = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Chat", to: "/chat", icon: MessageSquare },
  { title: "Profilo", to: "/profile", icon: User },
  { title: "Garage", to: "/garage", icon: Car },
  { title: "Circuiti", to: "/tracks", icon: Flag },
  // La rotta e' "/session" al singolare: il file e' stato rinominato da
  // sessions.tsx a session.tsx, ma questo link puntava ancora al
  // vecchio "/sessions" e non risolveva piu'.
  { title: "Sessioni", to: "/session", icon: FolderClock },
  { title: "Telemetria", to: "/telemetry", icon: ChartLine },
  { title: "Knowledge Base", to: "/knowledge", icon: BookOpen },
  { title: "Impostazioni", to: "/settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex w-64 shrink-0 flex-col border-r">
      <div className="border-sidebar-border flex h-16 items-center gap-2.5 border-b px-5">
        <span
          aria-hidden
          className="bg-primary size-2.5 rounded-full shadow-[0_0_12px_var(--color-primary)]"
        />
        <span className="text-[15px] font-semibold tracking-tight">
          AI Coach
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {menu.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            activeProps={{
              className:
                "bg-sidebar-accent text-sidebar-accent-foreground group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
            }}
          >
            {({ isActive }) => (
              <>
                {/* Barra verticale invece dello sfondo pieno colorato:
                    segnala la pagina attiva senza far competere il
                    rosso dell'accento con i pulsanti di azione. */}
                <span
                  aria-hidden
                  className={
                    isActive
                      ? "bg-primary absolute inset-y-1.5 left-0 w-0.5 rounded-full"
                      : "hidden"
                  }
                />
                <item.icon className="size-4 shrink-0" />
                <span>{item.title}</span>
              </>
            )}
          </Link>
        ))}
      </nav>

      <SidebarFooter />
    </aside>
  );
}
