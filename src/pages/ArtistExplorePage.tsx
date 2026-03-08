import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Music, Download, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
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

  useEffect(() => {
    if (!decodedName) return;
    setIsLoading(true);
    supabase
      .from("songs")
      .select("*")
      .ilike("artist", decodedName)
      .order("title")
      .then(({ data, error }) => {
        if (!error && data) setSongs(data as Song[]);
        setIsLoading(false);
      });
  }, [decodedName]);

  const handleImport = () => {
    if (!importUrl.trim()) {
      toast.error("Cole um link válido antes de importar.");
      return;
    }
    console.log("Import URL:", importUrl);
    toast.success("Iniciando captura do link...");
    setImportUrl("");
  };

  const initials = decodedName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Banner */}
      <div className="relative h-[260px] md:h-[320px] overflow-hidden">
        {/* Blurred background */}
        {artistPhoto ? (
          <img
            src={artistPhoto}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/60 via-slate-900 to-fuchsia-900/50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Neon accents */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400 via-transparent to-fuchsia-500" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-6 px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-1" /> Voltar
          </Button>

          {/* Artist photo */}
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden ring-4 ring-cyan-400/40 shadow-[0_0_30px_rgba(0,255,255,0.2)] mb-3">
            {artistPhoto ? (
              <img src={artistPhoto} alt={decodedName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center text-2xl font-black text-cyan-400">
                {initials}
              </div>
            )}
          </div>

          <h1 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-center">
            {decodedName}
          </h1>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        ) : songs.length > 0 ? (
          /* Cenário A – Tem músicas */
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <h2 className="text-sm uppercase tracking-widest text-cyan-400 font-semibold mb-4">
              No seu repertório ({songs.length})
            </h2>
            {songs.map((song) => (
              <button
                key={song.id}
                onClick={() => navigate(`/songs/${song.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-cyan-500/10 hover:border-cyan-400/30 hover:shadow-[0_0_15px_rgba(0,255,255,0.08)] transition-all group text-left"
              >
                <div className="shrink-0 w-10 h-10 rounded-md bg-gradient-to-br from-cyan-900/60 to-fuchsia-900/40 flex items-center justify-center">
                  <Play className="h-4 w-4 text-cyan-400 group-hover:text-cyan-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-white truncate">{song.title}</p>
                  {song.musical_key && (
                    <span className="text-xs text-slate-500">Tom: {song.musical_key}</span>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        ) : (
          /* Cenário B – Empty State Premium */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center py-12 space-y-6"
          >
            <div className="w-20 h-20 rounded-full bg-slate-800/80 border border-cyan-500/20 flex items-center justify-center">
              <Music className="h-9 w-9 text-cyan-400/60" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">
                Você ainda não tem músicas de {decodedName} no seu repertório.
              </h3>
              <p className="text-sm text-slate-500">
                Cole o link de uma cifra para importar automaticamente.
              </p>
            </div>
            <div className="flex w-full max-w-md gap-2">
              <Input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="Cole o link da cifra aqui (ex: Cifra Club, Letras)..."
                className="flex-1 bg-slate-800/60 border-cyan-500/20 focus:border-cyan-400/50 text-white placeholder:text-slate-600"
              />
              <Button
                onClick={handleImport}
                className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-white font-semibold shadow-[0_0_15px_rgba(0,255,255,0.2)]"
              >
                <Download className="h-4 w-4 mr-1" /> Importar
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
