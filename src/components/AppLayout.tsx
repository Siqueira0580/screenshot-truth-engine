import { NavLink, Outlet } from "react-router-dom";
import { Music, ListMusic, Users, Headphones, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Guitar } from "lucide-react";

const navItems = [
  { to: "/", icon: Music, label: "Músicas" },
  { to: "/setlists", icon: ListMusic, label: "Setlists" },
  { to: "/artists", icon: Users, label: "Artistas" },
  { to: "/studio", icon: Headphones, label: "Estúdio" },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-6">
          <div className="flex items-center gap-2">
            <Guitar className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              SetlistPro
            </span>
          </div>
          <nav className="flex items-center gap-1 flex-1">
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}
