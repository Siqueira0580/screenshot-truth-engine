import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Mic2, Guitar, Radio, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: Music,
    title: "Bem-vindo ao Smart Cifra!",
    description:
      "A sua nova estação de trabalho musical. Vamos dar uma volta rápida pelas ferramentas que vão transformar os seus ensaios.",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    icon: Guitar,
    title: "O Seu Repertório Inteligente",
    description:
      "Crie Setlists para os seus shows. No modo Performance, a tela rola sozinha, avisa a banda da próxima música e até entra em Loop contínuo para você não ter que soltar o instrumento.",
    gradient: "from-fuchsia-500 to-purple-600",
  },
  {
    icon: Mic2,
    title: "Estúdio de Composição IA",
    description:
      "Teve uma ideia? Vá para a aba 'Compor', grave a sua voz e a nossa Inteligência Artificial escreve a letra e sugere os acordes no estilo musical que você escolher.",
    gradient: "from-amber-400 to-orange-600",
  },
  {
    icon: Radio,
    title: "Modo Estúdio e Partilha",
    description:
      "Partilhe a sua tela ao vivo (WebRTC) com a sua banda via WhatsApp ou use o Modo Estúdio para ensaiar com os áudios reais.",
    gradient: "from-emerald-400 to-teal-600",
  },
];

const STORAGE_KEY = "smartcifra_hasSeenTour";

export function useOnboardingTour() {
  const hasSeen = localStorage.getItem(STORAGE_KEY) === "true";
  const dismiss = () => localStorage.setItem(STORAGE_KEY, "true");
  return { shouldShow: !hasSeen, dismiss };
}

interface OnboardingTourProps {
  onComplete: () => void;
}

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const current = STEPS[step];
  const Icon = current.icon;

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden"
      >
        {/* Skip button */}
        <button
          onClick={finish}
          className="absolute top-4 right-4 z-10 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top gradient bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${current.gradient}`} />

        <div className="p-8 flex flex-col items-center text-center gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center gap-5"
            >
              {/* Icon */}
              <div
                className={`w-16 h-16 rounded-xl bg-gradient-to-br ${current.gradient} flex items-center justify-center`}
                style={{ clipPath: "polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)" }}
              >
                <Icon className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-xl font-bold text-foreground font-[var(--font-display)]">
                {current.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {current.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="flex gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-8 bg-gradient-to-r from-primary to-accent"
                    : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step counter */}
          <p className="text-xs text-muted-foreground">{step + 1} de {STEPS.length}</p>

          {/* Buttons */}
          <div className="flex w-full gap-3">
            {!isFirst && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
            )}
            {isFirst && (
              <Button
                variant="ghost"
                onClick={finish}
                className="flex-1 text-slate-500 hover:text-slate-300"
              >
                Pular Tour
              </Button>
            )}
            <Button
              onClick={isLast ? finish : () => setStep((s) => s + 1)}
              className={`flex-1 bg-gradient-to-r ${current.gradient} text-white border-0 hover:opacity-90`}
            >
              {isLast ? "Concluir" : "Próximo"}
              {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
