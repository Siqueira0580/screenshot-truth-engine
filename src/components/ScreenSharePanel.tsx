import { useState, useCallback } from "react";
import { Monitor, MonitorOff, Copy, Check, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useScreenShare } from "@/hooks/useScreenShare";
import { toast } from "sonner";

interface ScreenSharePanelProps {
  setlistId: string;
}

export default function ScreenSharePanel({ setlistId: _setlistId }: ScreenSharePanelProps) {
  const [sessionId] = useState(() => crypto.randomUUID().slice(0, 8));
  const [copied, setCopied] = useState(false);

  const { isSharing, viewerCount, error, startScreenShare, stopScreenShare } = useScreenShare({
    sessionId,
    isMaster: true,
  });

  const inviteUrl = `${window.location.origin}/live/${sessionId}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  }, [inviteUrl]);

  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(
    `🎬 Olá! Clique no link para acompanhar a cifra no ensaio:\n\n${inviteUrl}\n\n_Smart Cifra Live_ 🎸`
  )}`;

  if (!isSharing) {
    return (
      <button
        onClick={startScreenShare}
        className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-4 py-3 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Transmitir ecrã para os músicos"
      >
        <Satellite className="h-6 w-6" />
        <span className="text-[10px] font-medium leading-tight">Transmitir Tela</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 animate-fade-in">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="default" className="gap-1 animate-pulse">
          <Monitor className="h-3 w-3" />
          Transmissão Ativa
        </Badge>
        {viewerCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {viewerCount} a ver
          </Badge>
        )}
        <Button variant="destructive" size="sm" onClick={stopScreenShare} className="gap-1 ml-auto">
          <MonitorOff className="h-3.5 w-3.5" />
          Parar
        </Button>
      </div>

      {/* Invite panel */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">
          📡 Transmissão Ativa. Envie o link para a banda:
        </p>
        <Input
          readOnly
          value={inviteUrl}
          className="font-mono text-xs select-all bg-background"
          onFocus={(e) => e.target.select()}
        />
        <div className="flex items-center gap-2">
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white bg-[#25D366] hover:bg-[#1da851] transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar via WhatsApp
          </a>
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado!" : "Copiar Link"}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
