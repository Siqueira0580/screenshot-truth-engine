import { useState, useEffect } from "react";
import { Music, Mic2, Guitar, Radio, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FEATURES = [
  {
    icon: Mic2,
    emoji: "✍️",
    title: "Estúdio de Composição IA",
    description:
      "Cante e deixe a Inteligência Artificial deduzir os acordes e escrever a cifra por você.",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    icon: Music,
    emoji: "🎧",
    title: "Modo Estúdio Pró",
    description:
      "Faça upload das suas músicas, isole instrumentos e pratique com perfeição.",
    gradient: "from-fuchsia-500 to-purple-600",
  },
  {
    icon: Guitar,
    emoji: "🎸",
    title: "Performance de Palco",
    description:
      "Motor de Repertório com troca automática de música, notificações em tempo real para a banda e repetição em Loop para ensaios.",
    gradient: "from-amber-400 to-orange-600",
  },
  {
    icon: Radio,
    emoji: "📡",
    title: "Partilha ao Vivo",
    description:
      "Transmita a sua tela em tempo real para toda a banda via link direto. Sincronize repertórios e ensaios sem complicação.",
    gradient: "from-emerald-400 to-teal-600",
  },
];

export default function AuthFeatureShowcase() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((p) => (p + 1) % FEATURES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const f = FEATURES[current];
  const Icon = f.icon;

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-8 lg:p-12">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        <h2 className="text-2xl lg:text-3xl font-bold text-white font-[var(--font-display)]">
          A revolução musical na palma da sua mão
        </h2>

        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-6"
          >
            {/* Icon circle */}
            <div
              className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-lg shadow-cyan-500/20`}
              style={{ clipPath: "polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)" }}
            >
              <Icon className="w-9 h-9 text-white" />
            </div>

            <div className="space-y-3">
              <p className="text-lg font-semibold text-white flex items-center justify-center gap-2">
                <span>{f.emoji}</span> {f.title}
              </p>
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
                {f.description}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setCurrent((p) => (p - 1 + FEATURES.length) % FEATURES.length)}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex gap-2">
            {FEATURES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-8 bg-gradient-to-r from-primary to-accent"
                    : "w-2 bg-muted hover:bg-muted-foreground"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrent((p) => (p + 1) % FEATURES.length)}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
