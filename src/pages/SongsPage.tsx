import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Search, Music2, Trash2, Edit, Eye, Loader2, FileUp, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchSongs, deleteSong, createSong, findOrCreateArtist } from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SongFormDialog from "@/components/SongFormDialog";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import ImportSongModal from "@/components/ImportSongModal";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoEnrichment } from "@/hooks/useAutoEnrichment";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ExploreTab from "@/components/explore/ExploreTab";
import OnboardingTour, { useOnboardingTour } from "@/components/OnboardingTour";
import PersonalizationWizard, { usePersonalizationWizard } from "@/components/PersonalizationWizard";

export default function SongsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
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
  const { shouldShow: showWizard } = usePersonalizationWizard();
  const [wizardVisible, setWizardVisible] = useState(showWizard);

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["songs"],
    queryFn: fetchSongs,
  });

  useAutoEnrichment(songs);

  const deleteM = useMutation({
    mutationFn: deleteSong,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success("Música excluída");
    },
  });

  const handleBulkPdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const pdfFiles = Array.from(files).filter(f => f.type === "application/pdf");
    if (pdfFiles.length === 0) {
      toast.error("Nenhum arquivo PDF selecionado");
      return;
    }

    setImportingPdfs(true);
    setPdfProgress({ done: 0, total: pdfFiles.length });
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      try {
        const formData = new FormData();
        formData.append("file", file);
        const { data, error } = await supabase.functions.invoke("parse-pdf", { body: formData });
        if (error) throw error;

        if (data && (data.title || data.body_text)) {
          let artistName = data.artist || null;
          if (artistName) {
            try { await findOrCreateArtist(artistName); } catch {}
          }

          const newSong = await createSong({
            title: data.title || file.name.replace(/\.pdf$/i, ""),
            artist: artistName,
            composer: data.composer || null,
            musical_key: data.musical_key || null,
            style: data.style || null,
            bpm: data.bpm ? parseInt(data.bpm) : null,
            time_signature: data.time_signature || "4/4",
            body_text: data.body_text || data.text || null,
          });

          if (data.chordpro_text && newSong?.id) {
            await supabase.from("audio_tracks").insert({
              song_id: newSong.id,
              ai_chordpro_text: data.chordpro_text,
              user_id: user?.id || null,
            });
          }
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
      setPdfProgress({ done: i + 1, total: pdfFiles.length });
    }

    queryClient.invalidateQueries({ queryKey: ["songs"] });
    if (successCount > 0) toast.success(`${successCount} música${successCount > 1 ? "s" : ""} importada${successCount > 1 ? "s" : ""} com sucesso!`);
    if (errorCount > 0) toast.warning(`${errorCount} PDF${errorCount > 1 ? "s" : ""} não pôde${errorCount > 1 ? "ram" : ""} ser processado${errorCount > 1 ? "s" : ""}`);
    setImportingPdfs(false);
    setPdfProgress({ done: 0, total: 0 });
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  const filtered = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      (s.artist && s.artist.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4 w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Músicas</h1>
          <p className="text-muted-foreground mt-1">
            {songs.length} música{songs.length !== 1 ? "s" : ""} no repertório
          </p>
        </div>
      </div>

      <Tabs defaultValue="explore" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="library">🎵 Minhas Músicas</TabsTrigger>
          <TabsTrigger value="explore">🔍 Explorar</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4 mt-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2 justify-end">
            <input ref={pdfInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleBulkPdfImport} />
            <Button variant="outline" onClick={() => pdfInputRef.current?.click()} disabled={importingPdfs} size="icon" className="md:w-auto md:px-4 md:gap-2">
              {importingPdfs ? (
                <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden md:inline">PDFs {pdfProgress.done}/{pdfProgress.total}</span></>
              ) : (
                <><FileUp className="h-4 w-4" /><span className="hidden md:inline">Importar PDFs</span></>
              )}
            </Button>
            <Button variant="outline" onClick={() => setImportLinkOpen(true)} size="icon" className="md:w-auto md:px-4 md:gap-2">
              <Link2 className="h-4 w-4" /><span className="hidden md:inline">Importar Link</span>
            </Button>
            <Button onClick={() => { setEditingSong(null); setFormOpen(true); }} size="icon" className="md:w-auto md:px-4 md:gap-2">
              <Plus className="h-4 w-4" /><span className="hidden md:inline">Nova Música</span>
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por título ou artista..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>

          {/* List */}
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
            </div>
          ) : (
            <div className="grid gap-2">
              {filtered.map((song, i) => (
                <div
                  key={song.id}
                  className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 animate-fade-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-mono text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{song.title}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {song.artist && <span>{song.artist}</span>}
                      {song.musical_key && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono font-medium text-secondary-foreground">
                          {song.musical_key}
                        </span>
                      )}
                      {song.bpm && <span>{song.bpm} BPM</span>}
                      {song.style && <span>{song.style}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/songs/${song.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingSong(song.id); setFormOpen(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(song.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
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
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={() => { if (deleteTarget) { deleteM.mutate(deleteTarget); setDeleteTarget(null); } }}
        description="Tem a certeza de que deseja excluir esta música? Esta ação não pode ser desfeita."
      />

      {tourVisible && (
        <OnboardingTour onComplete={() => { dismissTour(); setTourVisible(false); }} />
      )}
    </div>
  );
}
