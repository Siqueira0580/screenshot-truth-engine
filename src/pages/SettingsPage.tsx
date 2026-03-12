import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Guitar, Piano, Mic } from "lucide-react";
import type { Instrument } from "@/lib/chord-diagrams";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MetadataScanner from "@/components/MetadataScanner";

const INSTRUMENTS: { value: Instrument; label: string; description: string; icon: typeof Guitar }[] = [
  { value: "guitar", label: "Violão", description: "6 cordas · Acordes em braço", icon: Guitar },
  { value: "cavaquinho", label: "Cavaquinho", description: "4 cordas · Acordes em braço", icon: Guitar },
  { value: "ukulele", label: "Ukulele", description: "4 cordas · Acordes em braço", icon: Guitar },
  { value: "keyboard", label: "Teclado", description: "Diagrama de teclas", icon: Piano },
];

export default function SettingsPage() {
  const { preferredInstrument, setPreferredInstrument } = useUserPreferences();
  const navigate = useNavigate();

  const handleSelect = async (instrument: Instrument) => {
    await setPreferredInstrument(instrument);
    toast.success(`Instrumento padrão alterado para ${INSTRUMENTS.find((i) => i.value === instrument)?.label}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Personalize a sua experiência</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Instrumento Padrão</CardTitle>
          <CardDescription>
            Os diagramas de acordes serão exibidos para o instrumento selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {INSTRUMENTS.map((inst) => {
              const Icon = inst.icon;
              const isSelected = preferredInstrument === inst.value;
              return (
                <button
                  key={inst.value}
                  onClick={() => handleSelect(inst.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 sm:p-5 transition-all text-center",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                      : "border-border bg-card hover:border-primary/40 hover:bg-secondary/50"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-8 w-8 sm:h-10 sm:w-10 transition-colors",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        "font-semibold text-sm sm:text-base",
                        isSelected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {inst.label}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{inst.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <MetadataScanner />
    </div>
  );
}
