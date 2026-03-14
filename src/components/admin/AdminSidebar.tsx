import { NavLink } from "react-router-dom";
import { BarChart3, Users, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { to: "/admin", icon: BarChart3, label: "Visão Geral", end: true },
  { to: "/admin/users", icon: Users, label: "Gerir Utilizadores" },
  { to: "/admin/settings", icon: Settings, label: "Configurações" },
];

export default function AdminSidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card hidden md:flex flex-col">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-bold text-foreground text-sm tracking-tight">Admin</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {adminNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
