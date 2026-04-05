import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Guitar, Piano, Mic, ShieldCheck, ChevronRight, BookOpen } from "lucide-react";
import type { Instrument } from "@/lib/chord-diagrams";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MetadataScanner from "@/components/MetadataScanner";
import BackButton from "@/components/ui/BackButton";

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
      <div className="flex items-center gap-2">
        <BackButton />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Personalize a sua experiência</p>
        </div>
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

      {/* Ferramentas */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Ferramentas</CardTitle>
          <CardDescription>Utilitários para músicos</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="gap-2 w-full sm:w-auto"
            onClick={() => navigate("/tuner")}
          >
            <Mic className="h-4 w-4" />
            Afinador Digital
          </Button>
        </CardContent>
      </Card>

      {/* Biblioteca de Acordes */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Biblioteca de Acordes</CardTitle>
          <CardDescription>Visualize todas as posições mapeadas no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to="/settings/chords"
            className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 -mx-2 hover:bg-secondary/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-sm font-medium text-foreground">Dicionário de Acordes</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <MetadataScanner />

      {/* Legal */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Legal</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            to="/terms"
            className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 -mx-2 hover:bg-secondary/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-sm font-medium text-foreground">Termos de Uso e Privacidade</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
