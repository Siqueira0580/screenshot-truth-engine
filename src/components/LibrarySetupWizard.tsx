import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Box, Globe, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { addAllSongsToLibrary, addFilteredSongsToLibrary } from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

interface Props {
  onComplete: () => void;
}

const OPTIONS = [
  {
    key: "empty",
    icon: Box,
    title: "Estúdio Vazio",
    desc: "Começar do zero. Vou importar apenas as músicas que eu toco.",
    accent: "hsl(var(--primary))",
  },
  {
    key: "all",
    icon: Globe,
    title: "Catálogo Global",
    desc: "Carregar todas as músicas disponíveis na minha biblioteca.",
    accent: "hsl(270 70% 60%)",
  },
  {
    key: "vip",
    icon: Sparkles,
    title: "Seleção VIP",
    desc: "Apenas músicas dos meus estilos e artistas favoritos.",
    accent: "hsl(45 90% 55%)",
  },
] as const;

export default function LibrarySetupWizard({ onComplete }: Props) {
  const { user } = useAuth();
  const { favoriteStyles, favoriteArtists } = useUserPreferences();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selected || !user) return;
    setLoading(true);

    try {
      if (selected === "all") {
        await addAllSongsToLibrary();
        toast.success("Todas as músicas adicionadas à sua biblioteca!");
      } else if (selected === "vip") {
        const artistNames = favoriteArtists.map((a: any) => a.name);
        await addFilteredSongsToLibrary(artistNames, favoriteStyles);
        toast.success("Músicas dos seus favoritos adicionadas!");
      } else {
        toast.success("Estúdio pronto! Importe suas músicas quando quiser.");
      }

      await supabase
        .from("profiles")
        .update({ library_setup_completed: true } as any)
        .eq("id", user.id);

      onComplete();
    } catch (err: any) {
      toast.error("Erro ao configurar biblioteca: " + (err.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: "hsl(var(--background) / 0.95)",
        backdropFilter: "blur(24px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-lg rounded-2xl border border-border/50 bg-card p-6 md:p-8 space-y-6"
        style={{
          boxShadow: "0 0 60px hsl(var(--primary) / 0.1), 0 0 1px hsl(var(--primary) / 0.3)",
        }}
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-foreground">
            Como você quer montar seu estúdio?
          </h2>
          <p className="text-sm text-muted-foreground">
            Escolha como inicializar sua biblioteca pessoal de músicas.
          </p>
        </div>

        <div className="space-y-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selected === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setSelected(opt.key)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border/50 bg-background/50 hover:border-primary/30"
                }`}
                style={isSelected ? { boxShadow: `0 0 20px hsl(var(--primary) / 0.15)` } : undefined}
              >
                <div
                  className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: isSelected ? `${opt.accent}20` : "hsl(var(--muted))",
                  }}
                >
                  <Icon className="h-6 w-6" style={{ color: opt.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground">{opt.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
                {isSelected && (
                  <div className="shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <svg className="h-3.5 w-3.5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={!selected || loading}
          className="w-full h-12 font-bold text-base"
          style={{
            background: selected
              ? "linear-gradient(135deg, hsl(var(--primary)), hsl(270 70% 60%))"
              : undefined,
          }}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              A configurar...
            </>
          ) : (
            "Confirmar e Entrar"
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
