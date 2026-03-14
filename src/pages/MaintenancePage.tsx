import { Wrench } from "lucide-react";
import smartCifraLogo from "@/assets/smart-cifra-logo.png";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <img src={smartCifraLogo} alt="Smart Cifra" className="h-16 w-16 rounded-xl mb-6 opacity-80" />
      <div className="rounded-full bg-destructive/10 p-4 mb-6">
        <Wrench className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Sistema em Manutenção</h1>
      <p className="text-muted-foreground max-w-md">
        Estamos a realizar melhorias no sistema. Por favor, tente novamente em alguns minutos. Agradecemos a sua paciência!
      </p>
    </div>
  );
}
