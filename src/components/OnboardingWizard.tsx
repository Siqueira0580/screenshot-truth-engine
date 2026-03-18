import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, FileText, Mic, Radio, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: Home,
    title: "Sua Home, Seu Estilo",
    description:
      "Agora pode personalizar a tela inicial! Vá ao seu Perfil, escolha o gênero musical favorito e veja a aba Explorar adaptada ao seu gosto.",
    gradient: "from-cyan-500 to-blue-600",
    emoji: "🏠",
  },
  {
    icon: FileText,
    title: "Cifras Profissionais",
    description:
      "Os acordes agora ficam perfeitamente alinhados acima da letra no formato ChordPro. Leitura limpa e sem confusão, como numa partitura profissional.",
    gradient: "from-fuchsia-500 to-purple-600",
    emoji: "🎼",
  },
  {
    icon: Mic,
    title: "Assistente de Repertório",
    description:
      "Procure músicas com a voz! Toque no ícone de microfone na barra de busca e diga o nome da música ou do artista. Rápido e sem digitar.",
    gradient: "from-amber-400 to-orange-600",
    emoji: "🎤",
  },
  {
    icon: Radio,
    title: "Transmissão Ao Vivo",
    description:
      "O novo Modo Mestre permite partilhar a sua tela em tempo real com toda a banda. Cada músico acompanha a cifra sincronizada no seu próprio telemóvel.",
    gradient: "from-emerald-400 to-teal-600",
    emoji: "📡",
  },
];

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

export default function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const current = STEPS[step];
  const Icon = current.icon;

  const handleComplete = () => {
    setStep(0);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleComplete()}>
      <DialogContent className="max-w-md p-0 gap-0 border-border overflow-hidden [&>button]:hidden">
        {/* Top gradient bar */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${current.gradient}`} />

        <div className="p-8 flex flex-col items-center text-center gap-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Sparkles className="w-3 h-3" />
            Novidades
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-5"
            >
              {/* Icon */}
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${current.gradient} flex items-center justify-center shadow-lg`}
              >
                <Icon className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-xl font-bold text-foreground">
                {current.emoji} {current.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                {current.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="flex gap-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-8 bg-gradient-to-r from-primary to-accent"
                    : "w-2 bg-muted hover:bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Step counter */}
          <p className="text-xs text-muted-foreground">
            {step + 1} de {STEPS.length}
          </p>

          {/* Buttons */}
          <div className="flex w-full gap-3">
            {!isFirst && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
            )}
            {isFirst && (
              <Button
                variant="ghost"
                onClick={handleComplete}
                className="flex-1 text-muted-foreground"
              >
                Pular
              </Button>
            )}
            <Button
              onClick={isLast ? handleComplete : () => setStep((s) => s + 1)}
              className={`flex-1 bg-gradient-to-r ${current.gradient} text-white border-0 hover:opacity-90`}
            >
              {isLast ? "Concluir" : "Próximo"}
              {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
