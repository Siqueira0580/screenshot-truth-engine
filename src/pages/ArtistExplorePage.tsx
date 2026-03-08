import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Music, Download, Loader2, Play, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { findOrCreateArtist } from "@/lib/supabase-queries";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];

export default function ArtistExplorePage() {
  const { artistName } = useParams<{ artistName: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const artistPhoto = (location.state as any)?.photoUrl || "";
  const decodedName = decodeURIComponent(artistName || "");

  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const fetchSongs = useCallback(() => {
    if (!decodedName) return;
    setIsLoading(true);
    supabase
      .from("songs")
      .select("*")
      .ilike("artist", decodedName)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setSongs(data as Song[]);
        setIsLoading(false);
      });
  }, [decodedName]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const handleImport = async () => {
    const url = importUrl.trim();
    if (!url) {
      toast.error("Cole um link válido antes de importar.");
      return;
    }
    try {
      new URL(url);
    } catch {
      toast.error("URL inválida. Cole um link completo (ex: https://...).");
      return;
    }

    setIsImporting(true);
    toast.info("A extrair cifra do link...");

    try {
      const { data, error } = await supabase.functions.invoke("import-song-url", {
        body: { url },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const { title, artist, genre, content } = data;
      if (!title || !content) throw new Error("Não foi possível extrair a cifra deste link.");

      const finalArtist = artist || decodedName;
      const { error: insertError } = await supabase.from("songs").insert({
        title,
        artist: finalArtist,
        style: genre || null,
        body_text: content,
      });
      if (insertError) throw new Error(insertError.message);

      try {
        await findOrCreateArtist(finalArtist, artistPhoto || undefined);
      } catch (e) {
        console.warn("Could not auto-create artist entry:", e);
      }

      toast.success(`"${title}" importada com sucesso!`);
      setImportUrl("");
      fetchSongs();
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(err.message || "Erro ao importar. Tente novamente.");
    } finally {
      setIsImporting(false);
    }
  };

  const initials = decodedName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Cinematic Hero ── */}
      <div className="relative h-[320px] md:h-[400px] overflow-hidden">
        {/* Blurred photo layer */}
        {artistPhoto ? (
          <img
            src={artistPhoto}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-[1.4]"
            style={{ filter: "blur(60px) saturate(1.5)" }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(0,255,255,0.08), hsl(var(--background)), rgba(168,85,247,0.06))" }} />
        )}

        {/* Dark cinematic overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.85) 40%, hsl(var(--background) / 0.4) 100%)" }} />

        {/* Neon scan lines */}
        <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: "linear-gradient(90deg, rgba(0,255,255,0.6), transparent 40%, transparent 60%, rgba(168,85,247,0.5))" }} />
        <div className="absolute bottom-0 left-0 w-full h-px" style={{ background: "linear-gradient(90deg, rgba(0,255,255,0.2), transparent 50%, rgba(168,85,247,0.2))" }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-10 px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5 mr-1" /> Voltar
          </Button>

          {/* Polygonal avatar with neon pulse */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative mb-5"
          >
            {/* Outer glow ring */}
            <div
              className="absolute -inset-1.5 rounded-full animate-pulse"
              style={{
                background: "conic-gradient(from 0deg, rgba(0,255,255,0.4), rgba(168,85,247,0.4), rgba(0,255,255,0.4))",
                filter: "blur(8px)",
                opacity: 0.6,
              }}
            />
            <div
              className="relative w-32 h-32 md:w-40 md:h-40 overflow-hidden"
              style={{
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                border: "none",
              }}
            >
              {artistPhoto ? (
                <img src={artistPhoto} alt={decodedName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-black text-primary" style={{ background: "hsl(var(--card))" }}>
                  {initials}
                </div>
              )}
            </div>
            {/* Inner polygon border overlay */}
            <div
              className="absolute inset-0 w-32 h-32 md:w-40 md:h-40"
              style={{
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                border: "2px solid rgba(0,255,255,0.4)",
                pointerEvents: "none",
              }}
            />
          </motion.div>

          <motion.h1
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-3xl md:text-5xl font-black text-center"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), #e879f9, hsl(var(--primary)))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {decodedName}
          </motion.h1>

          {songs.length > 0 && !isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <Badge
                variant="outline"
                className="mt-3 text-xs font-semibold"
                style={{
                  borderColor: "rgba(0,255,255,0.25)",
                  color: "hsl(var(--primary))",
                  background: "rgba(0,255,255,0.06)",
                }}
              >
                <Music className="h-3 w-3 mr-1" />
                {songs.length} música{songs.length !== 1 ? "s" : ""} no repertório
              </Badge>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Glassmorphism Import Panel */}
        {!isLoading && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl p-5"
            style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(0,255,255,0.12)",
              boxShadow: "0 0 30px rgba(0,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-bold flex items-center gap-1.5">
              <Download className="h-3 w-3" />
              Importar cifra
            </p>
            <div className="flex gap-2">
              <Input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="Cole o link da cifra aqui (ex: Cifra Club, Letras)..."
                className="flex-1 bg-background/50 border-primary/20 focus:border-primary/50 placeholder:text-muted-foreground/40"
                disabled={isImporting}
                onKeyDown={(e) => e.key === "Enter" && handleImport()}
              />
              <Button
                onClick={handleImport}
                disabled={isImporting}
                className="font-bold shrink-0 text-primary-foreground"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)), #a855f7)",
                  boxShadow: "0 0 20px hsla(var(--primary), 0.3)",
                }}
              >
                {isImporting ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> A extrair...</>
                ) : (
                  <><Download className="h-4 w-4 mr-1.5" /> Importar</>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Song List / Empty State */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : songs.length > 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-4">
              No seu repertório ({songs.length})
            </p>
            {songs.map((song, i) => (
              <motion.button
                key={song.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/songs/${song.id}`)}
                className="w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200 group text-left"
                style={{
                  background: "linear-gradient(135deg, rgba(0,255,255,0.03), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(0,255,255,0.08)",
                  clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,255,255,0.3)";
                  e.currentTarget.style.boxShadow = "0 0 25px rgba(0,255,255,0.06), inset 0 0 20px rgba(0,255,255,0.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,255,255,0.08)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  className="shrink-0 w-10 h-10 flex items-center justify-center transition-colors"
                  style={{
                    clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                    background: "rgba(0,255,255,0.08)",
                  }}
                >
                  <Play className="h-4 w-4 text-primary group-hover:text-primary/80" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-foreground truncate">{song.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {song.musical_key && (
                      <span className="text-[11px] text-muted-foreground">Tom: {song.musical_key}</span>
                    )}
                    {song.style && (
                      <span className="text-[11px] text-muted-foreground/50">• {song.style}</span>
                    )}
                  </div>
                </div>
                <Compass className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center text-center py-14 space-y-5"
          >
            <div
              className="w-20 h-20 flex items-center justify-center"
              style={{
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                background: "rgba(0,255,255,0.06)",
                boxShadow: "0 0 40px rgba(0,255,255,0.06)",
              }}
            >
              <Music className="h-8 w-8 text-primary/50" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                Você ainda não tem músicas de {decodedName}
              </h3>
              <p className="text-sm text-muted-foreground">
                Cole o link de uma cifra acima para importar automaticamente.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
