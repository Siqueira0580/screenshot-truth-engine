import { Outlet } from "react-router-dom";
import smartCifraLogo from "@/assets/smart-cifra-logo.png";

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center gap-3">
          <img src={smartCifraLogo} alt="Smart Cifra" className="h-9 w-9 rounded-lg" />
          <span className="text-sm font-bold tracking-tight text-foreground">
            Smart Cifra
          </span>
        </div>
      </header>
      <main className="container py-6 flex-1 animate-fade-in">
        <Outlet />
      </main>
      <footer className="border-t border-border/50 bg-card/50 py-4">
        <div className="container text-center text-xs text-muted-foreground">
          Compartilhado via <strong>Smart Cifra</strong> 🎸
        </div>
      </footer>
    </div>
  );
}
