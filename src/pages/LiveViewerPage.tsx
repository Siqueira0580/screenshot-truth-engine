import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useScreenShare } from "@/hooks/useScreenShare";
import { Monitor, Loader2, WifiOff, Maximize, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import smartCifraLogo from "@/assets/smart-cifra-logo.webp";

export default function LiveViewerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);

  const { remoteStream, error, connectAsViewer } = useScreenShare({
    sessionId: sessionId || null,
    isMaster: false,
  });

  useEffect(() => {
    if (sessionId && !connected) {
      connectAsViewer();
      setConnected(true);
    }
  }, [sessionId, connected, connectAsViewer]);

  const handleRetry = () => {
    setConnected(false);
  };

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-black flex flex-col items-center justify-center relative"
    >
      {remoteStream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full max-h-screen object-contain"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFullscreen}
            className="absolute top-4 right-4 text-white/60 hover:text-white hover:bg-white/10"
          >
            <Maximize className="h-5 w-5" />
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-6 text-white/80 px-6 text-center">
          <img src={smartCifraLogo} alt="Smart Cifra" className="h-16 w-16 rounded-xl opacity-80" />

          {error ? (
            <>
              <WifiOff className="h-12 w-12 text-red-400" />
              <p className="text-lg">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2 mt-2 text-white border-white/20 hover:bg-white/10">
                <RefreshCw className="h-4 w-4" />
                Tentar Novamente
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div>
                <h1 className="text-xl font-bold mb-2">A conectar à transmissão…</h1>
                <p className="text-sm text-white/50">
                  Aguarde enquanto o mestre inicia a partilha de ecrã.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bottom branding */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/30 text-xs">
        <Monitor className="h-3 w-3" />
        <span>Smart Cifra Live</span>
      </div>
    </div>
  );
}
