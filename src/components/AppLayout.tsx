import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Music, ListMusic, Users, Headphones, PenTool, LogOut, Settings, Sun, Moon, User, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import smartCifraLogo from "@/assets/smart-cifra-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import PaywallModal from "@/components/PaywallModal";

const navItems = [
  { to: "/songs", icon: Music, label: "Músicas", proOnly: false },
  { to: "/setlists", icon: ListMusic, label: "Setlists", proOnly: false },
  { to: "/artists", icon: Users, label: "Artistas", proOnly: false },
  { to: "/compositions", icon: PenTool, label: "Compor", proOnly: true },
  { to: "/studio", icon: Headphones, label: "Estúdio", proOnly: true },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { isFree } = useSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("U");

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

  return (
    <div className="h-screen flex flex-col landscape:flex-row bg-background overflow-hidden pb-16 lg:pb-0 landscape:pb-0">
      {/* Landscape Side Rail (mobile only, hidden on lg+) */}
      <nav className="hidden landscape:flex landscape:lg:hidden flex-col items-center gap-1 py-2 px-1 w-14 shrink-0 border-r border-border/50 dark:border-border/30 bg-card/95 backdrop-blur-xl z-50 overflow-y-auto">
        <button type="button" onClick={() => navigate("/songs")} className="mb-2">
          <img src={smartCifraLogo} alt="Smart Cifra" className="h-8 w-8 rounded-md" />
        </button>
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          if (item.proOnly && isFree) {
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => setPaywallOpen(true)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-[9px] font-medium transition-colors w-full text-muted-foreground hover:text-foreground opacity-60"
                )}
              >
                <item.icon className="h-4 w-4" />
              </button>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-[9px] font-medium transition-colors w-full",
                isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
            </NavLink>
          );
        })}
      </nav>

      {/* Desktop Header */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      <header className="sticky top-0 z-50 border-b border-border/50 dark:border-border/30 bg-card/80 backdrop-blur-xl">
        <div className="container flex h-16 landscape:h-12 items-center gap-6">
          <button type="button" onClick={() => navigate("/songs")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={smartCifraLogo} alt="Smart Cifra" className="h-12 w-12 rounded-lg" />
            <span className="text-sm font-bold tracking-tight text-foreground hidden sm:inline">
              Smart Cifra
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {navItems.map((item) => {
              if (item.proOnly && isFree) {
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => setPaywallOpen(true)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap text-muted-foreground hover:bg-secondary hover:text-foreground opacity-60"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              }
              return (
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
              );
            })}
          </nav>

          {/* Spacer for mobile */}
          <div className="flex-1 lg:hidden" />

          <div className="flex items-center gap-1 sm:gap-2">
            {["/songs", "/setlists", "/artists", "/compositions", "/studio"].some(p => location.pathname.startsWith(p)) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const path = location.pathname;
                  if (path.startsWith("/songs") && (window as any).__replaySongsTour) {
                    (window as any).__replaySongsTour();
                  } else if (path.startsWith("/setlists") && (window as any).__replaySetlistsTour) {
                    (window as any).__replaySetlistsTour();
                  } else if (path.startsWith("/artists") && (window as any).__replayArtistsTour) {
                    (window as any).__replayArtistsTour();
                  } else if (path.startsWith("/compositions") && (window as any).__replayCompositionsTour) {
                    (window as any).__replayCompositionsTour();
                  } else if (path === "/studio" && (window as any).__replayStudioTour) {
                    (window as any).__replayStudioTour();
                  } else {
                    toast.info("Nenhum tour disponível para esta página.");
                  }
                }}
                title="Tour de Ajuda"
                className="text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
              title="Configurações"
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-secondary transition-colors"
                  title="Meu Perfil"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground hidden lg:block">
                    {user?.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2 cursor-pointer">
                  <User className="h-4 w-4" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    toast.success("Sessão terminada com sucesso");
                  }}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container py-6 landscape:py-3 animate-fade-in flex-1 min-h-0 overflow-y-auto overflow-x-hidden max-w-full">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation — hidden in landscape */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 dark:border-border/30 bg-card/95 backdrop-blur-xl lg:hidden landscape:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            if (item.proOnly && isFree) {
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => setPaywallOpen(true)}
                  className="flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors rounded-lg min-w-[60px] text-muted-foreground opacity-60"
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors rounded-lg min-w-[60px]",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
          ))}
        </div>
      </nav>
      </div>{/* close flex-1 wrapper */}
    </div>
  );
}
