import { NavLink, Outlet } from "react-router-dom";
import { Music, ListMusic, Users, Headphones, LogOut, Settings, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import smartCifraLogo from "@/assets/smart-cifra-logo.png";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const navItems = [
  { to: "/", icon: Music, label: "Músicas" },
  { to: "/setlists", icon: ListMusic, label: "Setlists" },
  { to: "/artists", icon: Users, label: "Artistas" },
  { to: "/studio", icon: Headphones, label: "Estúdio" },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("U");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("avatar_url, first_name, last_name").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setAvatarUrl(data.avatar_url);
          const ini = [data.first_name, data.last_name].filter(Boolean).map(n => n![0]?.toUpperCase()).join("");
          setInitials(ini || "U");
        }
      });
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-4">
          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground hover:text-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-card border-border p-0">
              <div className="flex flex-col h-full">
                {/* Logo area */}
                <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
                  <img src={smartCifraLogo} alt="Smart Cifra" className="h-10 w-10 rounded-lg" />
                  <span className="text-base font-bold tracking-tight text-foreground">Smart Cifra</span>
                </div>

                {/* Nav items */}
                <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </nav>

                {/* Bottom actions */}
                <div className="border-t border-border px-3 py-4 space-y-1">
                  <button
                    onClick={() => { navigate("/settings"); setMobileOpen(false); }}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-colors"
                  >
                    <Settings className="h-5 w-5" />
                    <span>Configurações</span>
                  </button>
                  <button
                    onClick={() => { navigate("/profile"); setMobileOpen(false); }}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-colors"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span>Meu Perfil</span>
                  </button>
                  <button
                    onClick={() => { signOut(); setMobileOpen(false); }}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 w-full transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src={smartCifraLogo} alt="Smart Cifra" className="h-12 w-12 rounded-lg" />
            <span className="text-sm font-bold tracking-tight text-foreground hidden sm:inline">
              Smart Cifra
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Spacer mobile */}
          <div className="flex-1 md:hidden" />

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
              title="Configurações"
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-secondary transition-colors"
              title="Meu Perfil"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
            </button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile avatar shortcut */}
          <button
            onClick={() => navigate("/profile")}
            className="md:hidden rounded-full"
            title="Meu Perfil"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </header>

      <main className="container py-6 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}
