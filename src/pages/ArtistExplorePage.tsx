import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Music, Download, Loader2, Play, Compass, Disc3, FileText } from "lucide-react";
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

      const finalArtist = (artist || decodedName).trim().replace(/\s+/g, " ");
      const { error: insertError } = await supabase.from("songs").insert({
        title: title.trim(),
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
      {/* ── Full-Bleed Immersive Hero ── */}
      <div className="relative w-full h-[340px] md:h-[420px] overflow-hidden">
        {/* Background: artist photo full-bleed */}
        {artistPhoto ? (
          <img
            src={artistPhoto}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--background)) 50%, hsl(270 60% 50% / 0.1) 100%)",
            }}
          />
        )}

        {/* Cinematic gradient overlay — fuses into bg-background */}
        <div
          className="absolute inset-0"
          style={{
            background: [
              "linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.92) 30%, hsl(var(--background) / 0.6) 60%, hsl(var(--background) / 0.3) 100%)",
            ].join(","),
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        />

        {/* Top neon accent line */}
        <div
          className="absolute top-0 left-0 w-full h-[2px] z-20"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--primary) / 0.7), transparent 35%, transparent 65%, hsl(270 70% 65% / 0.5))",
          }}
        />

        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-30 text-muted-foreground hover:text-foreground backdrop-blur-sm bg-background/20 rounded-full"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>

        {/* Centered profile identity */}
        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-8 px-4">
          {/* Avatar with neon glow ring */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-5"
          >
            {/* Pulsating outer glow */}
            <div
              className="absolute -inset-2 rounded-full animate-pulse"
              style={{
                background:
                  "conic-gradient(from 180deg, hsl(var(--primary) / 0.5), hsl(270 70% 60% / 0.4), hsl(var(--primary) / 0.5))",
                filter: "blur(10px)",
                opacity: 0.7,
              }}
            />

            {/* Avatar container */}
            <div
              className="relative w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden"
              style={{
                border: "3px solid hsl(var(--primary) / 0.6)",
                boxShadow:
                  "0 0 30px hsl(var(--primary) / 0.3), 0 0 60px hsl(var(--primary) / 0.1), inset 0 0 20px hsl(var(--primary) / 0.05)",
              }}
            >
              {artistPhoto ? (
                <img
                  src={artistPhoto}
                  alt={decodedName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-black text-primary bg-card">
                  {initials}
                </div>
              )}
            </div>
          </motion.div>

          {/* Artist name */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-4xl md:text-5xl font-black text-center tracking-tight text-foreground"
          >
            {decodedName}
          </motion.h1>

          {/* Repertoire badge */}
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Badge
                variant="outline"
                className="mt-3 text-xs font-semibold border-primary/25 text-primary bg-primary/5"
              >
                <Music className="h-3 w-3 mr-1" />
                {songs.length} música{songs.length !== 1 ? "s" : ""} no
                repertório
              </Badge>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Floating Import Panel (glassmorphism, negative margin) ── */}
      {!isLoading && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="-mt-6 relative z-20 mx-4 md:mx-auto max-w-2xl rounded-2xl p-5"
          style={{
            background: "hsl(var(--card) / 0.6)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid hsl(var(--primary) / 0.12)",
            boxShadow:
              "0 8px 40px hsl(var(--background) / 0.5), 0 0 1px hsl(var(--primary) / 0.2), inset 0 1px 0 hsl(var(--foreground) / 0.04)",
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
                background:
                  "linear-gradient(135deg, hsl(var(--primary)), hsl(270 70% 60%))",
                boxShadow: "0 0 20px hsl(var(--primary) / 0.3)",
              }}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> A
                  extrair...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1.5" /> Importar
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── Song List / Empty State ── */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : songs.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-4">
              Repertório ({songs.length})
            </p>
            {songs.map((song, i) => (
              <motion.button
                key={song.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/songs/${song.id}`)}
                className="w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200 group text-left bg-card/40 border border-border/50 hover:border-primary/30 hover:bg-card/60"
                style={{
                  boxShadow: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 0 25px hsl(var(--primary) / 0.06), inset 0 0 20px hsl(var(--primary) / 0.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Play className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-foreground truncate">
                    {song.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {song.musical_key && (
                      <span className="text-[11px] text-muted-foreground">
                        Tom: {song.musical_key}
                      </span>
                    )}
                    {song.style && (
                      <span className="text-[11px] text-muted-foreground/50">
                        • {song.style}
                      </span>
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
            className="flex flex-col items-center text-center py-16 space-y-5"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center bg-primary/5"
              style={{
                boxShadow:
                  "0 0 40px hsl(var(--primary) / 0.08), inset 0 0 20px hsl(var(--primary) / 0.03)",
                border: "1px solid hsl(var(--primary) / 0.1)",
              }}
            >
              <Disc3 className="h-9 w-9 text-primary/40" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                Repertório em branco
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Importe a primeira cifra de{" "}
                <span className="text-primary font-semibold">
                  {decodedName}
                </span>{" "}
                usando o painel acima.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
