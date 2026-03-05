import { NavLink, Outlet } from "react-router-dom";
import { Music, ListMusic, Users, Headphones, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import smartCifraLogo from "@/assets/smart-cifra-logo.png";
import { useNavigate } from "react-router-dom";
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-6">
          <div className="flex items-center gap-2">
            <img src={smartCifraLogo} alt="Smart Cifra" className="h-40 w-40 rounded-lg" />
          </div>
          <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
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
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
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
              <span className="text-sm text-muted-foreground hidden md:block">
                {user?.email}
              </span>
            </button>
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
