import { Wrench, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import smartCifraLogo from "@/assets/smart-cifra-logo.webp";

export default function MaintenancePage() {
  const { user, signOut } = useAuth();

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 text-center">
      <img src={smartCifraLogo} alt="Smart Cifra" className="h-16 w-16 rounded-xl mb-6 opacity-80" />
      <div className="rounded-full bg-destructive/10 p-4 mb-6">
        <Wrench className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Estamos a fazer melhorias!</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        O SmartCifra está em manutenção no momento. Voltaremos em breve com novidades. Agradecemos a sua paciência!
      </p>
      {user && (
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      )}
    </div>
  );
}
