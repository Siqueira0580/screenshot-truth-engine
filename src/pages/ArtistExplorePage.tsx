import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Music, Download, Loader2, Play, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

      if (!title || !content) {
        throw new Error("Não foi possível extrair a cifra deste link.");
      }

      const finalArtist = artist || decodedName;

      const { error: insertError } = await supabase.from("songs").insert({
        title,
        artist: finalArtist,
        style: genre || null,
        body_text: content,
      });

      if (insertError) throw new Error(insertError.message);

      // Auto-create artist in the artists table
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
      <div className="relative h-[280px] md:h-[360px] overflow-hidden">
        {/* Blurred background layer */}
        {artistPhoto ? (
          <img
            src={artistPhoto}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-30"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/80 via-slate-950 to-fuchsia-950/60" />
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />

        {/* Neon accent lines */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400 via-transparent to-fuchsia-500" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-cyan-400/40 via-transparent to-fuchsia-500/40" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-8 px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5 mr-1" /> Voltar
          </Button>

          {/* Avatar with neon ring */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden mb-4"
            style={{
              boxShadow: "0 0 40px rgba(0,255,255,0.25), 0 0 80px rgba(255,0,255,0.15), inset 0 0 20px rgba(0,255,255,0.1)",
              border: "3px solid rgba(0,255,255,0.4)",
            }}
          >
            {artistPhoto ? (
              <img src={artistPhoto} alt={decodedName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center text-3xl font-black text-cyan-400">
                {initials}
              </div>
            )}
          </motion.div>

          <motion.h1
            initial={{ y: 12, opacity: 0 }}
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
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-sm text-muted-foreground mt-2"
            >
              {songs.length} música{songs.length !== 1 ? "s" : ""} no seu repertório
            </motion.p>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Glassmorphism Import Panel */}
        {!isLoading && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl p-4 md:p-5"
            style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(0,255,255,0.12)",
              boxShadow: "0 0 20px rgba(0,255,255,0.05)",
            }}
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">
              <Download className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
              Importar cifra
            </p>
            <div className="flex gap-2">
              <Input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="Cole o link da cifra aqui (ex: Cifra Club, Letras)..."
                className="flex-1 bg-background/50 border-primary/20 focus:border-primary/50 placeholder:text-muted-foreground/50"
                disabled={isImporting}
                onKeyDown={(e) => e.key === "Enter" && handleImport()}
              />
              <Button
                onClick={handleImport}
                disabled={isImporting}
                className="font-semibold shrink-0"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)), #a855f7)",
                  boxShadow: "0 0 15px hsla(var(--primary), 0.3)",
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
            <h2 className="text-xs uppercase tracking-widest text-primary font-semibold mb-4">
              No seu repertório ({songs.length})
            </h2>
            {songs.map((song, i) => (
              <motion.button
                key={song.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/songs/${song.id}`)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl transition-all group text-left"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(0,255,255,0.08)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,255,255,0.25)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(0,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,255,255,0.08)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Play className="h-4 w-4 text-primary group-hover:text-primary/80" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-foreground truncate">{song.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {song.musical_key && (
                      <span className="text-xs text-muted-foreground">Tom: {song.musical_key}</span>
                    )}
                    {song.style && (
                      <span className="text-xs text-muted-foreground/60">• {song.style}</span>
                    )}
                  </div>
                </div>
                <Compass className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center text-center py-12 space-y-5"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(0,255,255,0.06)",
                border: "1px solid rgba(0,255,255,0.15)",
                boxShadow: "0 0 30px rgba(0,255,255,0.08)",
              }}
            >
              <Music className="h-9 w-9 text-primary/60" />
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
