import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, ChevronRight, ChevronLeft, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

const STYLES = ["Rock", "Pop", "Worship", "Sertanejo", "Samba", "Pagode", "MPB", "Jazz"];

interface ArtistEntry {
  id: string;
  name: string;
  genre: string[];
  imageUrl: string | null;
}

const ARTISTS_SEED: ArtistEntry[] = [
  { id: "1", name: "Coldplay", genre: ["Rock", "Pop"], imageUrl: null },
  { id: "2", name: "Djavan", genre: ["MPB"], imageUrl: null },
  { id: "3", name: "Marisa Monte", genre: ["MPB"], imageUrl: null },
  { id: "4", name: "Victor & Leo", genre: ["Sertanejo"], imageUrl: null },
  { id: "5", name: "Diante do Trono", genre: ["Worship"], imageUrl: null },
  { id: "6", name: "Jorge & Mateus", genre: ["Sertanejo"], imageUrl: null },
  { id: "7", name: "Anavitória", genre: ["Pop", "MPB"], imageUrl: null },
  { id: "8", name: "Thiaguinho", genre: ["Pagode", "Samba"], imageUrl: null },
  { id: "9", name: "Fernandinho", genre: ["Worship"], imageUrl: null },
  { id: "10", name: "Foo Fighters", genre: ["Rock"], imageUrl: null },
  { id: "11", name: "Péricles", genre: ["Pagode", "Samba"], imageUrl: null },
  { id: "12", name: "Hillsong", genre: ["Worship"], imageUrl: null },
  { id: "13", name: "Gusttavo Lima", genre: ["Sertanejo"], imageUrl: null },
  { id: "14", name: "Gilberto Gil", genre: ["MPB", "Samba"], imageUrl: null },
  { id: "15", name: "U2", genre: ["Rock"], imageUrl: null },
  { id: "16", name: "Anitta", genre: ["Pop"], imageUrl: null },
  { id: "17", name: "Zeca Pagodinho", genre: ["Pagode", "Samba"], imageUrl: null },
  { id: "18", name: "Norah Jones", genre: ["Jazz"], imageUrl: null },
  { id: "19", name: "Imagine Dragons", genre: ["Rock", "Pop"], imageUrl: null },
  { id: "20", name: "Luan Santana", genre: ["Sertanejo"], imageUrl: null },
];

interface Props {
  onComplete: () => void;
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

export default function PersonalizationWizard({ onComplete }: Props) {
  const { saveWizardPreferences } = useUserPreferences();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [artists, setArtists] = useState<ArtistEntry[]>(ARTISTS_SEED);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [saving, setSaving] = useState(false);

  const goTo = useCallback((s: number) => {
    setDirection(s > step ? 1 : -1);
    setStep(s);
  }, [step]);

  useEffect(() => {
    if (step !== 3) return;
    const filtered = ARTISTS_SEED.filter((a) => a.genre.some((g) => selectedStyles.includes(g)));
    if (filtered.length === 0) return;
    const names = filtered.map((a) => a.name);
    setLoadingPhotos(true);
    supabase.functions
      .invoke("deezer-charts", { body: { action: "search-artists", artists: names } })
      .then(({ data }) => {
        if (data?.data) {
          const photoMap = new Map<string, string>();
          for (const r of data.data) {
            if (r.picture) photoMap.set(r.name, r.picture);
          }
          setArtists((prev) =>
            prev.map((a) => (photoMap.has(a.name) ? { ...a, imageUrl: photoMap.get(a.name)! } : a))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPhotos(false));
  }, [step, selectedStyles]);

  const handleSkip = async () => {
    setSaving(true);
    await saveWizardPreferences([], [], true);
    setSaving(false);
    onComplete();
  };

  const handleFinish = async () => {
    setSaving(true);
    const chosen = artists.filter((a) => selectedArtists.includes(a.id));
    await saveWizardPreferences(selectedStyles, chosen);
    setSaving(false);
    onComplete();
  };

  const toggleStyle = (s: string) =>
    setSelectedStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const toggleArtist = (id: string) => {
    setSelectedArtists((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 10) {
        toast.error("Você atingiu o limite de 10 artistas.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const filteredArtists = artists.filter((a) => a.genre.some((g) => selectedStyles.includes(g)));

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-border bg-card p-6 md:p-8 shadow-2xl overflow-hidden"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
      >
        <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-[hsl(310,80%,55%)]/20 blur-3xl" />

        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-8 bg-gradient-to-r from-primary to-[hsl(310,80%,55%)]"
                  : s < step
                  ? "w-2 bg-primary/60"
                  : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 && (
            <motion.div key="step1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }} className="flex flex-col items-center text-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(310,80%,55%)] shadow-lg">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold font-[family-name:var(--font-display)] text-foreground">O seu Estúdio, as suas Regras</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">Queremos que o Smart Cifra tenha a sua cara. Personalize a sua aba Explorar com os seus estilos e cantores favoritos.</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button onClick={() => goTo(2)} className="w-full rounded-xl bg-gradient-to-r from-primary to-[hsl(310,80%,55%)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_hsl(195_100%_50%/0.3)] transition hover:shadow-[0_0_30px_hsl(195_100%_50%/0.5)] hover:scale-[1.02] active:scale-[0.98]">
                  Personalizar Agora
                </button>
                <button onClick={handleSkip} disabled={saving} className="w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Talvez Depois"}
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }} className="flex flex-col gap-5">
              <div className="text-center">
                <h2 className="text-xl font-bold font-[family-name:var(--font-display)] text-foreground">Quais estilos você curte?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Selecione pelo menos 1 estilo.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STYLES.map((style) => {
                  const active = selectedStyles.includes(style);
                  return (
                    <button key={style} onClick={() => toggleStyle(style)} className={`relative rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 ${active ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_hsl(195_100%_50%/0.25)]" : "border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"}`} style={active ? { clipPath: "polygon(6% 0, 100% 0, 100% 85%, 94% 100%, 0 100%, 0 15%)" } : undefined}>
                      {active && <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />}
                      {style}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between pt-2">
                <button onClick={() => goTo(1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"><ChevronLeft className="h-4 w-4" /> Voltar</button>
                <button onClick={() => goTo(3)} disabled={selectedStyles.length === 0} className="flex items-center gap-1 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed">Avançar <ChevronRight className="h-4 w-4" /></button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }} className="flex flex-col gap-5">
              <div className="text-center">
                <h2 className="text-xl font-bold font-[family-name:var(--font-display)] text-foreground">Escolha seus artistas</h2>
                <p className="mt-1 text-sm text-muted-foreground">Selecionados: <span className="font-mono font-bold text-[hsl(310,80%,55%)]">{selectedArtists.length}</span>/10</p>
              </div>
              {loadingPhotos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Buscando artistas…</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                  {filteredArtists.map((artist) => {
                    const active = selectedArtists.includes(artist.id);
                    return (
                      <button key={artist.id} onClick={() => toggleArtist(artist.id)} className="flex flex-col items-center gap-2 group">
                        <div className={`relative h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden border-2 transition-all duration-200 ${active ? "border-[hsl(310,80%,55%)] shadow-[0_0_16px_hsl(310_80%_55%/0.4)]" : "border-border group-hover:border-muted-foreground/50"}`}>
                          {artist.imageUrl ? (
                            <img src={artist.imageUrl} alt={artist.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center text-lg font-bold text-muted-foreground">{artist.name.charAt(0)}</div>
                          )}
                          {active && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 flex items-center justify-center bg-[hsl(310,80%,55%)]/40">
                              <Check className="h-6 w-6 text-primary-foreground drop-shadow" />
                            </motion.div>
                          )}
                        </div>
                        <span className={`text-xs font-medium text-center leading-tight transition ${active ? "text-foreground" : "text-muted-foreground"}`}>{artist.name}</span>
                      </button>
                    );
                  })}
                  {filteredArtists.length === 0 && (
                    <p className="col-span-full text-center text-sm text-muted-foreground py-8">Nenhum artista encontrado para os estilos selecionados.</p>
                  )}
                </div>
              )}
              <div className="flex justify-between pt-2">
                <button onClick={() => goTo(2)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"><ChevronLeft className="h-4 w-4" /> Voltar</button>
                <button onClick={handleFinish} disabled={saving} className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-[hsl(310,80%,55%)] px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_16px_hsl(195_100%_50%/0.25)] transition hover:shadow-[0_0_24px_hsl(195_100%_50%/0.4)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Concluir</span> <Sparkles className="h-4 w-4" /></>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={handleSkip} disabled={saving} className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition">
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    </motion.div>
  );
}
