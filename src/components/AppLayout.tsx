import { NavLink, Outlet } from "react-router-dom";
import { Music, ListMusic, Users, Headphones, PenTool, LogOut, Settings, Sun, Moon, User } from "lucide-react";
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

const navItems = [
  { to: "/songs", icon: Music, label: "Músicas" },
  { to: "/setlists", icon: ListMusic, label: "Setlists" },
  { to: "/artists", icon: Users, label: "Artistas" },
  { to: "/compositions", icon: PenTool, label: "Compor" },
  { to: "/studio", icon: Headphones, label: "Estúdio" },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
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
    <div className="h-screen flex flex-col bg-background overflow-hidden pb-16 lg:pb-0">
      {/* Desktop Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 dark:border-border/30 bg-card/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-6">
          <button type="button" onClick={() => navigate("/songs")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={smartCifraLogo} alt="Smart Cifra" className="h-12 w-12 rounded-lg" />
            <span className="text-sm font-bold tracking-tight text-foreground hidden sm:inline">
              Smart Cifra
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
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

          {/* Spacer for mobile */}
          <div className="flex-1 lg:hidden" />

          <div className="flex items-center gap-1 sm:gap-2">
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

      <main className="container py-6 animate-fade-in flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide max-w-full">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 dark:border-border/30 bg-card/95 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
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
          ))}
        </div>
      </nav>
    </div>
  );
}
