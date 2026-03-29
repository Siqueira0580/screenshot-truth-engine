import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Music, Sparkles, Zap, ListMusic, Import, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import smartCifraLogo from "@/assets/smart-cifra-logo.webp";


const features = [
  {
    icon: Import,
    title: "Importação Mágica",
    desc: "Cole um link e a IA extrai título, artista, acordes e foto — tudo em segundos.",
  },
  {
    icon: ListMusic,
    title: "Repertórios Inteligentes",
    desc: "Gere setlists automáticas por estilo, duração e energia do show.",
  },
  {
    icon: Brain,
    title: "Enriquecimento com IA",
    desc: "Gênero, BPM e foto do artista preenchidos automaticamente em segundo plano.",
  },
  {
    icon: Zap,
    title: "Teleprompter de Palco",
    desc: "Leitura contínua com rolagem automática, metrônomo e troca de tom em tempo real.",
  },
];

const mockChordLines = [
  { chords: "Am        F         C          G", lyrics: "Hoje eu sei que o mundo gira e nunca pára de girar" },
  { chords: "Am        F         C          G", lyrics: "E na corrente eu vou levando o que a maré deixar levar" },
  { chords: "Dm        Am        Em         G", lyrics: "Cada acorde é uma história, cada nota uma oração" },
  { chords: "F         G         C", lyrics: "A música é a voz do coração" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Radial glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3 h-[700px] w-[700px] rounded-full bg-primary/[0.07] blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-accent/[0.05] blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-ring/[0.04] blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <img src={smartCifraLogo} alt="Smart Cifra" className="h-9 w-9 rounded-lg" />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            Smart<span className="text-primary">Cifra</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
            Entrar
          </Button>
          <Button size="sm" onClick={() => navigate("/register")}>
            Criar Conta
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-16 pb-10 text-center sm:pt-24">
        {/* Logo animation */}
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-primary/30 bg-secondary/60 shadow-lg shadow-primary/10 backdrop-blur-sm">
            <img src={smartCifraLogo} alt="Smart Cifra" className="h-16 w-16 rounded-full" />
          </div>
          <div
            className="absolute -inset-3 rounded-full border border-dashed border-primary/20 animate-spin"
            style={{ animationDuration: '20s' }}
          />
        </div>

        {/* Headline */}
        <h1
          className="max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl"
        >
          A Evolução da{" "}
          <span className="bg-gradient-to-r from-primary via-accent to-ring bg-clip-text text-transparent">
            Leitura Musical
          </span>{" "}
          no Palco.
        </h1>

        {/* Sub-headline */}
        <p
          className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
        >
          Importe links em segundos, gere repertórios automáticos e leia suas cifras com
          formatação perfeita. Deixe a tecnologia cuidar do papel, para você focar apenas
          na música.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            className="relative overflow-hidden px-8 text-base font-semibold shadow-lg shadow-primary/20 transition-shadow hover:shadow-primary/40"
            onClick={() => navigate("/register")}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Começar Agora
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="px-8 text-base font-semibold"
            onClick={() => {
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Conheça os Recursos
          </Button>
        </div>
      </section>

      {/* Mockup */}
      <section
        className="relative z-10 mx-auto mt-8 max-w-3xl px-6 sm:mt-14"
      >
        <div className="rounded-2xl border border-border/60 bg-secondary/40 p-1 shadow-2xl shadow-primary/5 backdrop-blur-md">
          {/* Tab bar */}
          <div className="flex items-center gap-2 rounded-t-xl bg-muted/60 px-4 py-2.5">
            <span className="h-3 w-3 rounded-full bg-destructive/60" />
            <span className="h-3 w-3 rounded-full bg-accent/60" />
            <span className="h-3 w-3 rounded-full bg-primary/60" />
            <span className="ml-3 text-xs text-muted-foreground font-mono">smart-cifra • Meu Repertório</span>
          </div>

          {/* Faux cipher content */}
          <div className="space-y-0.5 p-5 sm:p-7 font-mono text-sm leading-relaxed">
            <div className="mb-4 flex items-center gap-3">
              <Music className="h-5 w-5 text-primary" />
              <span className="font-display text-base font-bold text-foreground">Canção do Coração</span>
              <span className="text-xs text-muted-foreground">— Artista Demo</span>
            </div>
            {mockChordLines.map((line, i) => (
              <div key={i}>
                <div className="text-primary font-bold select-none whitespace-pre">{line.chords}</div>
                <div className="text-foreground/80 whitespace-pre mb-3">{line.lyrics}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-5xl px-6 py-24">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-14 text-center font-display text-3xl font-bold sm:text-4xl"
        >
          Recursos que transformam o{" "}
          <span className="text-primary">seu palco</span>
        </motion.h2>

        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="group rounded-xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm transition-colors hover:border-primary/30"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 font-display text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-primary/20 bg-gradient-to-br from-secondary/80 to-muted/60 px-8 py-12 backdrop-blur-sm"
        >
          <h3 className="mb-3 font-display text-2xl font-bold sm:text-3xl">
            Pronto para <span className="text-primary">revolucionar</span> seus ensaios?
          </h3>
          <p className="mb-8 text-muted-foreground">
            Crie sua conta grátis e experimente o futuro da leitura musical.
          </p>
          <Button
            size="lg"
            className="px-10 text-base font-semibold shadow-lg shadow-primary/20"
            onClick={() => navigate("/register")}
          >
            Criar Conta Gratuita
          </Button>
        </motion.div>
      </section>

      {/* Minimal footer */}
      <footer className="relative z-10 border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Smart Cifra — Feito com ♪ para músicos.
      </footer>
    </div>
  );
}
