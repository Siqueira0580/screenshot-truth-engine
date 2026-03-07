import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShowButtonProps {
  onClick: () => void;
  className?: string;
  compact?: boolean;
}

export default function ShowButton({ onClick, className, compact = false }: ShowButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 font-black uppercase tracking-widest rounded-xl text-white transition-all duration-300",
        "bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400",
        "hover:from-blue-500 hover:via-sky-400 hover:to-cyan-300 hover:scale-105",
        "shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:shadow-[0_0_30px_rgba(56,189,248,0.6)]",
        "animate-pulse-alert",
        compact
          ? "px-4 py-2 text-sm"
          : "px-8 py-3 text-lg",
        className
      )}
    >
      <Mic className={compact ? "h-4 w-4" : "h-5 w-5"} />
      SHOW
    </button>
  );
}
