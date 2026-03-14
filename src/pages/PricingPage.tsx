import { Check, X, Crown, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import BackButton from "@/components/ui/BackButton";

const plans = [
  {
    id: "free" as const,
    name: "Free",
    price: "R$ 0",
    period: "para sempre",
    description: "Músicas ilimitadas, Importação por Link, Auto-Scroll, Até 3 Repertórios simultâneos.",
    features: [
      { text: "Músicas ilimitadas", included: true },
      { text: "Importação por Link (URL)", included: true },
      { text: "Auto-Scroll (Teleprompter)", included: true },
      { text: "Até 3 Repertórios simultâneos", included: true },
      { text: "Estúdio de Criação (Compor)", included: false },
      { text: "Edição Avançada (Estúdio)", included: false },
      { text: "Repertórios ilimitados", included: false },
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "R$ 19,90",
    period: "/mês",
    description: "Tudo do Free + Criação autoral (Compor), Edição Avançada (Estúdio) e Repertórios Ilimitados.",
    features: [
      { text: "Tudo do plano Free", included: true },
      { text: "Repertórios ilimitados", included: true },
      { text: "Estúdio de Criação (Compor)", included: true },
      { text: "Edição Avançada (Estúdio)", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    highlighted: true,
  },
];

export default function PricingPage() {
  const { plan: currentPlan } = useSubscription();

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <BackButton />

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Escolha o seu Plano
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Comece grátis e desbloqueie todo o potencial do Smart Cifra quando estiver pronto.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          {plans.map((p) => {
            const isCurrent = p.id === currentPlan;
            return (
              <Card
                key={p.id}
                className={`relative overflow-hidden transition-all ${
                  p.highlighted
                    ? "border-primary/50 shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                    : ""
                }`}
              >
                {p.highlighted && (
                  <div className="absolute top-0 right-0">
                    <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground gap-1 px-3 py-1">
                      <Crown className="h-3 w-3" /> Recomendado
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {p.id === "free" ? (
                      <Music className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Crown className="h-5 w-5 text-amber-500" />
                    )}
                    <CardTitle className="text-xl">{p.name}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-bold text-foreground">{p.price}</span>
                    <span className="text-sm text-muted-foreground">{p.period}</span>
                  </div>
                  <CardDescription className="mt-2">{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2.5">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        {f.included ? (
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={f.included ? "text-foreground" : "text-muted-foreground/60"}>
                          {f.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plano atual
                    </Button>
                  ) : p.id === "pro" ? (
                    <Button className="w-full gap-2 bg-gradient-to-r from-amber-500 to-primary hover:from-amber-600 hover:to-primary/90 text-primary-foreground">
                      <Crown className="h-4 w-4" /> Assinar Pro
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Gratuito
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
