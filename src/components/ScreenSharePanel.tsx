import { useState, useCallback } from "react";
import { Monitor, MonitorOff, Copy, Check, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const handleShareWhatsApp = useCallback(() => {
    const text = `🎬 Olá! Clique no link para acompanhar o meu ecrã no ensaio:\n\n${inviteUrl}\n\n_Smart Cifra Live_ 🎸`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }, [inviteUrl]);

  if (!isSharing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={startScreenShare}
        className="gap-2"
        title="Transmitir ecrã para os músicos"
      >
        <Monitor className="h-4 w-4" />
        <span className="hidden sm:inline">Transmitir Tela</span>
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="default" className="gap-1 animate-pulse">
          <Monitor className="h-3 w-3" />
          Transmitindo
        </Badge>
        {viewerCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {viewerCount} a ver
          </Badge>
        )}
        <Button variant="destructive" size="sm" onClick={stopScreenShare} className="gap-1 ml-auto">
          <MonitorOff className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Parar</span>
        </Button>
      </div>

      {/* Link display + share buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <code className="flex-1 min-w-0 truncate text-xs bg-background/80 rounded px-2 py-1.5 border border-border font-mono select-all">
          {inviteUrl}
        </code>
        <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1 shrink-0">
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar"}</span>
        </Button>
        <Button
          size="sm"
          onClick={handleShareWhatsApp}
          className="gap-1 shrink-0 bg-[#25D366] hover:bg-[#1da851] text-white"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">WhatsApp</span>
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
