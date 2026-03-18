import { useRef, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, Music2, Trash2, Edit, Loader2, FileUp, Link2, FileText, Mic, MicOff } from "lucide-react";
import { useVoiceSearch, isVoiceSupported } from "@/hooks/useVoiceSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchUserLibrary, removeFromUserLibrary, createSongAndAddToLibrary, findOrCreateArtist } from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SongFormDialog from "@/components/SongFormDialog";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import ImportSongModal from "@/components/ImportSongModal";
import OnboardingGuard from "@/components/OnboardingGuard";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAutoEnrichment } from "@/hooks/useAutoEnrichment";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ExploreTab from "@/components/explore/ExploreTab";
import OnboardingTour, { useOnboardingTour } from "@/components/OnboardingTour";
import PersonalizationWizard from "@/components/PersonalizationWizard";
import LibrarySetupWizard from "@/components/LibrarySetupWizard";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import GuidedTour from "@/components/GuidedTour";
import { useGuidedTour } from "@/hooks/useGuidedTour";
import { cn } from "@/lib/utils";
import type { Step } from "react-joyride";

type SortMode = "recent" | "oldest" | "az" | "za";

const SONGS_TOUR_STEPS: Step[] = [
  {
    target: "body",
    content: "Bem-vindo ao Smart Cifra! Vamos fazer um tour rápido pelas ferramentas da sua página de músicas.",
    title: "🎵 Bem-vindo!",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: "#tour-tabs",
    content: "Alterne entre 'Explorar' para descobrir novas músicas e 'Minhas Músicas' para gerir o seu repertório pessoal.",
    title: "📑 Abas de Navegação",
    placement: "bottom",
  },
  {
    target: "#tour-search",
    content: "Encontre qualquer música ou artista num piscar de olhos. Basta digitar o nome!",
    title: "🔎 Pesquisa Rápida",
    placement: "bottom",
  },
  {
    target: "#tour-add-buttons",
    content: "Importe PDFs, adicione via link ou crie músicas manualmente. Tudo num só lugar!",
    title: "➕ Adicionar Músicas",
    placement: "bottom",
  },
  {
    target: "nav.fixed",
    content: "Navegue para o Estúdio para ensaiar com áudios, monte os seus Repertórios (Setlists) ou componha com a IA.",
    title: "🧭 Menu de Navegação",
    placement: "top",
  },
];

export default function SongsPage() {
  const { user } = useAuth();
  const { wizardCompleted, librarySetupCompleted, markLibrarySetupDone, loading: prefsLoading } = useUserPreferences();
  const [search, setSearch] = useState("");
  const voiceSearch = useVoiceSearch(useCallback((text: string) => {
    setSearch(text);
    toast.info(`Buscando: "${text}"`);
  }, []));
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [formOpen, setFormOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<string | null>(null);
  const [importingPdfs, setImportingPdfs] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ done: 0, total: 0 });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [importLinkOpen, setImportLinkOpen] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { shouldShow: showTour, dismiss: dismissTour } = useOnboardingTour();
  const [tourVisible, setTourVisible] = useState(showTour);
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const [librarySetupDismissed, setLibrarySetupDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState<"explore" | "library">("library");

  const { isAdmin } = useUserRole();

  const showWizard = !isAdmin && !prefsLoading && !wizardCompleted && !wizardDismissed;
  const showLibrarySetup = !isAdmin && !prefsLoading && wizardCompleted && !librarySetupCompleted && !librarySetupDismissed && !showWizard;

  const { run: runGuidedTour, completeTour, replayTour } = useGuidedTour("songs_page");
  const shouldRunGuidedTour = runGuidedTour && !tourVisible && !showWizard && !showLibrarySetup;

  useState(() => {
    (window as any).__replaySongsTour = replayTour;
  });

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["user-library"],
    queryFn: fetchUserLibrary,
    enabled: !!user,
  });

  useAutoEnrichment(songs);

  const removeM = useMutation({
    mutationFn: removeFromUserLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-library"] });
      toast.success("Música removida da sua biblioteca");
    },
  });

  const handleBulkPdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const filesToProcess = Array.from(input.files || []);
    input.value = "";

    if (filesToProcess.length === 0) return;

    const pdfFiles = filesToProcess.filter((file) => file.type === "application/pdf");
    if (pdfFiles.length === 0) {
      toast.error("Nenhum arquivo PDF selecionado");
      return;
    }

    setImportingPdfs(true);
    setPdfProgress({ done: 0, total: pdfFiles.length });
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const [index, file] of pdfFiles.entries()) {
        try {
          if (file.size > 5 * 1024 * 1024) {
            toast.warning(`O arquivo ${file.name} excede o limite de 5MB.`);
            errorCount++;
            continue;
          }

          const formData = new FormData();
          formData.append("file", file);

          const { data, error } = await supabase.functions.invoke("parse-pdf", { body: formData });
          if (error) throw error;

          if (data && (data.title || data.body_text)) {
            const artistName = data.artist || null;
            const songTitle = data.title || file.name.replace(/\.pdf$/i, "");
            const { checkDuplicateSong } = await import("@/lib/supabase-queries");
            const duplicateId = await checkDuplicateSong(songTitle, artistName);

            if (duplicateId) {
              toast.warning(`"${songTitle}" já existe no seu repertório — ignorada.`);
              errorCount++;
            } else {
              if (artistName) {
                try {
                  await findOrCreateArtist(artistName);
                } catch {}
              }

              await createSongAndAddToLibrary({
                title: songTitle,
                artist: artistName,
                composer: data.composer || null,
                musical_key: data.musical_key || null,
                style: data.style || null,
                bpm: data.bpm ? parseInt(data.bpm) : null,
                time_signature: data.time_signature || "4/4",
                body_text: data.body_text || data.text || null,
              });
              successCount++;
            }
          } else {
            toast.warning(`O arquivo ${file.name} falhou ao ser processado.`);
            errorCount++;
          }
        } catch {
          toast.warning(`O arquivo ${file.name} falhou ao ser processado.`);
          errorCount++;
        } finally {
          setPdfProgress({ done: index + 1, total: pdfFiles.length });
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      queryClient.invalidateQueries({ queryKey: ["user-library"] });
      if (successCount > 0) toast.success(`${successCount} música${successCount > 1 ? "s" : ""} importada${successCount > 1 ? "s" : ""} com sucesso!`);
      if (errorCount > 0) toast.warning(`${errorCount} PDF${errorCount > 1 ? "s" : ""} não pôde${errorCount > 1 ? "ram" : ""} ser processado${errorCount > 1 ? "s" : ""}`);
    } finally {
      setImportingPdfs(false);
      setPdfProgress({ done: 0, total: 0 });
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const filtered = useMemo(() => {
    let list = songs.filter(
      (s) =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.artist && s.artist.toLowerCase().includes(search.toLowerCase()))
    );

    switch (sortMode) {
      case "oldest":
        list = [...list].sort((a, b) => new Date(a.added_at || a.created_at).getTime() - new Date(b.added_at || b.created_at).getTime());
        break;
      case "az":
        list = [...list].sort((a, b) => a.title.localeCompare(b.title, "pt"));
        break;
      case "za":
        list = [...list].sort((a, b) => b.title.localeCompare(a.title, "pt"));
        break;
      case "recent":
      default:
        list = [...list].sort((a, b) => new Date(b.added_at || b.created_at).getTime() - new Date(a.added_at || a.created_at).getTime());
        break;
    }

    return list;
  }, [songs, search, sortMode]);

  return (
    <OnboardingGuard>
      <div className="space-y-4 w-full max-w-full overflow-x-hidden px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Músicas</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{songs.length} música{songs.length !== 1 ? "s" : ""} na biblioteca</p>
          </div>
        </div>

        <Tabs defaultValue="explore" value={activeTab} onValueChange={(value) => setActiveTab(value as "explore" | "library")} className="w-full">
          <TabsList id="tour-tabs" className="w-full grid grid-cols-2">
            <TabsTrigger value="explore">🔍 Explorar</TabsTrigger>
            <TabsTrigger value="library">🎵 Minhas Músicas</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-3 mt-3">
            <div id="tour-add-buttons" className="flex items-center gap-1.5 justify-end flex-wrap">
              <input ref={pdfInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleBulkPdfImport} />
              <Button variant="outline" onClick={() => pdfInputRef.current?.click()} disabled={importingPdfs} size="icon" className="h-8 w-8 md:w-auto md:h-9 md:px-3 md:gap-2">
                {importingPdfs ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden md:inline text-xs">PDFs {pdfProgress.done}/{pdfProgress.total}</span>
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    <span className="hidden md:inline text-xs">Importar PDFs</span>
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setImportLinkOpen(true)} size="icon" className="h-8 w-8 md:w-auto md:h-9 md:px-3 md:gap-2">
                <Link2 className="h-4 w-4" />
                <span className="hidden md:inline text-xs">Link</span>
              </Button>
              <Button onClick={() => { setEditingSong(null); setFormOpen(true); }} size="icon" className="h-8 w-8 md:w-auto md:h-9 md:px-3 md:gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline text-xs">Nova</span>
              </Button>
            </div>

            <div id="tour-search" className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar por título ou artista..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-9 text-sm" />
                </div>
                <VoiceSearchButton />
              </div>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs sm:text-sm bg-background/50 border-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recentes</SelectItem>
                  <SelectItem value="oldest">Mais Antigas</SelectItem>
                  <SelectItem value="az">A-Z</SelectItem>
                  <SelectItem value="za">Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-lg bg-card" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Music2 className="h-12 w-12 mb-4 opacity-40" />
                <p className="text-lg">Nenhuma música encontrada</p>
                <p className="text-sm mt-1">Importe ou adicione músicas à sua biblioteca pessoal.</p>
              </div>
            ) : (
              <div className="grid gap-2 w-full max-w-full landscape:grid-cols-2 lg:grid-cols-1">
                {filtered.map((song, i) => (
                  <div
                    key={song.id}
                    className="group flex items-center justify-between w-full max-w-full gap-3 p-3 rounded-lg border-none bg-card transition-all hover:shadow-[var(--shadow-glow)] animate-fade-in"
                    style={{ boxShadow: "var(--shadow-card)", animationDelay: `${i * 30}ms` }}
                  >
                    <Link to={`/songs/${song.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-mono text-sm font-bold">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-semibold truncate">{song.title}</p>
                          {(song as any).pdf_url && (
                            <span className="shrink-0 text-red-500" title="Partitura PDF">
                              <FileText className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                          {song.artist && <span className="truncate">{song.artist}</span>}
                          {song.musical_key && (
                            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs font-mono font-medium text-secondary-foreground">
                              {song.musical_key}
                            </span>
                          )}
                          {song.bpm && <span className="shrink-0">{song.bpm} BPM</span>}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => { setEditingSong(song.id); setFormOpen(true); }}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(song.id)}
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="explore" className="mt-4">
            <ExploreTab />
          </TabsContent>
        </Tabs>

        <SongFormDialog open={formOpen} onOpenChange={setFormOpen} songId={editingSong} />
        <ImportSongModal open={importLinkOpen} onOpenChange={setImportLinkOpen} />
        <ConfirmDeleteModal
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          onConfirm={() => {
            if (deleteTarget) {
              removeM.mutate(deleteTarget);
              setDeleteTarget(null);
            }
          }}
          title="Remover da Biblioteca"
          description="Deseja remover esta música da sua biblioteca pessoal? A música permanece disponível no catálogo global."
        />

        {tourVisible && (
          <OnboardingTour onComplete={() => { dismissTour(); setTourVisible(false); }} />
        )}

        {showWizard && !tourVisible && (
          <PersonalizationWizard onComplete={() => setWizardDismissed(true)} />
        )}

        {showLibrarySetup && !tourVisible && (
          <LibrarySetupWizard onComplete={() => { setLibrarySetupDismissed(true); markLibrarySetupDone(); queryClient.invalidateQueries({ queryKey: ["user-library"] }); }} />
        )}

        <GuidedTour
          steps={SONGS_TOUR_STEPS}
          run={shouldRunGuidedTour}
          onFinish={completeTour}
        />
      </div>
    </OnboardingGuard>
  );
}
