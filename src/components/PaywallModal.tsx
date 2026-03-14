import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export default function PaywallModal({
  open,
  onOpenChange,
  title = "Funcionalidade exclusiva do Plano Pro",
  description = "Assine o Plano Pro para desbloquear todas as funcionalidades.",
}: PaywallModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-primary/20">
            <Crown className="h-8 w-8 text-amber-500" />
          </div>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <Button
            size="lg"
            className="gap-2 bg-gradient-to-r from-amber-500 to-primary hover:from-amber-600 hover:to-primary/90 text-primary-foreground"
            onClick={() => {
              onOpenChange(false);
              navigate("/planos");
            }}
          >
            <Sparkles className="h-4 w-4" />
            Ver Planos
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
