import { NavLink, Outlet } from "react-router-dom";
import { Music, ListMusic, Users, Guitar } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Music, label: "Músicas" },
  { to: "/setlists", icon: ListMusic, label: "Setlists" },
  { to: "/artists", icon: Users, label: "Artistas" },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-6">
          <div className="flex items-center gap-2">
            <Guitar className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              SetlistPro
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
        </div>
      </header>

      {/* Main */}
      <main className="container py-6 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}
