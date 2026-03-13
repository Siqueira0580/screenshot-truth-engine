import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  className?: string;
}

export default function BackButton({ className }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}
      className={cn("shrink-0 text-muted-foreground hover:text-foreground", className)}
      aria-label="Voltar"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}
