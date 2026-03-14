import { useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function PwaInstallBanner() {
  const { canInstall, isInstalled, isDismissed, promptInstall, dismiss } = usePwaInstall();
  const [hidden, setHidden] = useState(false);

  if (!canInstall || isInstalled || isDismissed || hidden) return null;

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) setHidden(true);
  };

  const handleDismiss = () => {
    dismiss();
    setHidden(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 md:bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
      >
        <div className="relative rounded-2xl border border-border bg-card p-4 shadow-lg backdrop-blur-sm">
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Grave as suas ideias num toque!
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Instale o aplicativo na sua tela inicial para aceder ao atalho rápido do Gravador.
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleInstall} className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              Instalar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-muted-foreground">
              Agora não
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
