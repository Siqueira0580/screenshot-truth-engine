import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, GripVertical, Music2, MonitorPlay, Save, Eye, EyeOff, Radio, Wifi, WifiOff, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  fetchSetlist,
  fetchSetlistItems,
  fetchSongs,
  fetchArtists,
  addSongToSetlist,
  removeSongFromSetlist,
  bulkUpdateSetlistItems,
  createSetlistFromSelection,
} from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Teleprompter from "@/components/Teleprompter";
import { useStageSync } from "@/hooks/useStageSync";
import StageSyncInviteModal from "@/components/StageSyncInviteModal";
import SyncInviteModal from "@/components/SyncInviteModal";
import SetlistToolbar, { type SortBy } from "@/components/SetlistToolbar";
import CreateFromSelectionBar from "@/components/CreateFromSelectionBar";

// Chromatic key order for sorting
const CHROMATIC_ORDER = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
function chromaticIndex(key: string | null | undefined): number {
  if (!key) return 999;
  const base = key.replace(/m$/, "").trim();
  const idx = CHROMATIC_ORDER.indexOf(base);
  return idx >= 0 ? idx : 999;
}

export default function SetlistDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [addOpen, setAddOpen] = useState(false);
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, { loop_count: number | null; speed: number | null; bpm: number | null; transposed_key: string | null }>
  >({});
  const [dirty, setDirty] = useState(false);
  const [autoHideControls, setAutoHideControls] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Filter / sort / selection state
  const [sortBy, setSortBy] = useState<SortBy>("manual");
  const [filterKey, setFilterKey] = useState("all");
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  const { data: setlist } = useQuery({
    queryKey: ["setlist", id],
    queryFn: () => fetchSetlist(id!),
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["setlist-items", id],
    queryFn: () => fetchSetlistItems(id!),
    enabled: !!id,
  });

  const { data: artists = [] } = useQuery({
    queryKey: ["artists"],
    queryFn: fetchArtists,
  });

  const artistPhotoMap = Object.fromEntries(
    artists.filter(a => a.photo_url).map(a => [a.name.toLowerCase(), a.photo_url])
  );

  const { data: allSongs = [] } = useQuery({
    queryKey: ["songs"],
    queryFn: fetchSongs,
    enabled: addOpen,
  });

  // Stage sync
  const stageSync = useStageSync({
    setlistId: id,
    inviteToken,
    onSongChange: (index) => {
      toast.info(`Mestre navegou para música ${index + 1}`);
    },
    onScroll: () => {},
    onPlay: () => toast.info("Mestre iniciou reprodução"),
    onPause: () => toast.info("Mestre pausou"),
  });

  useEffect(() => {
    if (inviteToken && stageSync.isFollowing && items.length > 0 && !teleprompterOpen) {
      setTeleprompterOpen(true);
    }
  }, [inviteToken, stageSync.isFollowing, items.length]);

  // --- Derived: available keys for filter ---
  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach((item: any) => {
      const k = item.songs?.musical_key;
      if (k) keys.add(k);
    });
    return Array.from(keys).sort((a, b) => chromaticIndex(a) - chromaticIndex(b));
  }, [items]);

  // --- Derived: filtered + sorted items ---
  const processedItems = useMemo(() => {
    let result = [...items] as any[];

    // Filter by key
    if (filterKey !== "all") {
      result = result.filter((item: any) => item.songs?.musical_key === filterKey);
    }

    // Sort
    if (sortBy === "artist") {
      result.sort((a: any, b: any) =>
        (a.songs?.artist || "").localeCompare(b.songs?.artist || "")
      );
    } else if (sortBy === "key") {
      result.sort((a: any, b: any) =>
        chromaticIndex(a.songs?.musical_key) - chromaticIndex(b.songs?.musical_key)
      );
    }
    // "manual" keeps original position order

    return result;
  }, [items, filterKey, sortBy]);

  // --- Selection helpers ---
  const visibleIds = useMemo(() => new Set(processedItems.map((i: any) => i.id)), [processedItems]);
  const allVisibleSelected = processedItems.length > 0 && processedItems.every((i: any) => selectedSongs.has(i.id));
  const someVisibleSelected = processedItems.some((i: any) => selectedSongs.has(i.id));

  const toggleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedSongs((prev) => {
        const next = new Set(prev);
        processedItems.forEach((i: any) => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedSongs((prev) => {
        const next = new Set(prev);
        processedItems.forEach((i: any) => next.add(i.id));
        return next;
      });
    }
  }, [allVisibleSelected, processedItems]);

  const toggleSelect = useCallback((itemId: string) => {
    setSelectedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  // --- Create new setlist from selection ---
  const handleCreateFromSelection = useCallback(async (name: string) => {
    const selectedItems = items
      .filter((item: any) => selectedSongs.has(item.id))
      .map((item: any) => ({
        song_id: item.song_id,
        loop_count: localOverrides[item.id]?.loop_count ?? item.loop_count ?? null,
        speed: localOverrides[item.id]?.speed ?? item.speed ?? null,
        bpm: localOverrides[item.id]?.bpm ?? item.bpm ?? null,
        transposed_key: localOverrides[item.id]?.transposed_key ?? item.transposed_key ?? null,
      }));

    const newSetlist = await createSetlistFromSelection(name, selectedItems);
    setSelectedSongs(new Set());
    toast.success(`Repertório "${name}" criado com ${selectedItems.length} música(s)!`);
    navigate(`/setlists/${newSetlist.id}`);
  }, [items, selectedSongs, localOverrides, navigate]);

  // --- Mutations ---
  const addMutation = useMutation({
    mutationFn: (songId: string) => addSongToSetlist(id!, songId, items.length + 1),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlist-items", id] });
      toast.success("Música adicionada!");
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeSongFromSetlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlist-items", id] });
      toast.success("Música removida");
    },
  });

  const bulkSaveMutation = useMutation({
    mutationFn: () => {
      const payload = items.map((item: any) => {
        const ov = localOverrides[item.id];
        return {
          id: item.id,
          loop_count: ov?.loop_count ?? item.loop_count ?? null,
          speed: ov?.speed ?? item.speed ?? null,
          bpm: ov?.bpm ?? item.bpm ?? null,
        };
      });
      return bulkUpdateSetlistItems(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlist-items", id] });
      setLocalOverrides({});
      setDirty(false);
      toast.success("Configurações salvas!");
    },
  });

  const updateField = useCallback(
    (itemId: string, field: "loop_count" | "speed" | "bpm" | "transposed_key", value: number | string | null, item: any) => {
      setLocalOverrides((prev) => ({
        ...prev,
        [itemId]: {
          loop_count: prev[itemId]?.loop_count ?? item.loop_count ?? null,
          speed: prev[itemId]?.speed ?? item.speed ?? null,
          bpm: prev[itemId]?.bpm ?? item.bpm ?? null,
          transposed_key: prev[itemId]?.transposed_key ?? item.transposed_key ?? null,
          [field]: value,
        },
      }));
      setDirty(true);
    },
    []
  );

  // Debounced auto-save
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || items.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const payload = items.map((item: any) => {
        const ov = localOverrides[item.id];
        return {
          id: item.id,
          loop_count: ov?.loop_count ?? item.loop_count ?? null,
          speed: ov?.speed ?? item.speed ?? null,
          bpm: ov?.bpm ?? item.bpm ?? null,
        };
      });
      bulkUpdateSetlistItems(payload).then(() => {
        queryClient.invalidateQueries({ queryKey: ["setlist-items", id] });
        setDirty(false);
        toast.success("Configurações salvas automaticamente");
      });
    }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [dirty, localOverrides]);

  const getVal = (item: any, field: "loop_count" | "speed" | "bpm") => {
    return localOverrides[item.id]?.[field] ?? item[field];
  };

  const existingIds = new Set(items.map((i: any) => i.song_id));
  const availableSongs = allSongs.filter(
    (s) =>
      !existingIds.has(s.id) &&
      (s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.artist && s.artist.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className={`max-w-3xl space-y-6 animate-fade-in ${selectedSongs.size > 0 ? "pb-28" : ""}`}>
      <Button variant="ghost" asChild className="gap-2">
        <Link to="/setlists">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{setlist?.name}</h1>
          <p className="text-muted-foreground mt-1">
            {items.length} música{items.length !== 1 ? "s" : ""}
            {stageSync.connectedCount > 1 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                <Wifi className="h-3 w-3 mr-1" />
                {stageSync.connectedCount} online
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {dirty && (
            <Button
              onClick={() => bulkSaveMutation.mutate()}
              disabled={bulkSaveMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Salvar Configs</span>
            </Button>
          )}
          {items.length > 0 && (
            <>
              {stageSync.isMaster ? (
                <Button variant="destructive" size="sm" onClick={stageSync.stopMaster} className="gap-2 animate-pulse">
                  <Radio className="h-4 w-4" />
                  <span className="hidden sm:inline">Parar Transmissão</span>
                </Button>
              ) : stageSync.isFollowing ? (
                <Button variant="secondary" size="sm" onClick={stageSync.stopFollowing} className="gap-2">
                  <WifiOff className="h-4 w-4" />
                  <span className="hidden sm:inline">Desconectar</span>
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={stageSync.startMaster} className="gap-2" title="Iniciar Modo Palco">
                  <Radio className="h-4 w-4" />
                  <span className="hidden sm:inline">Modo Palco</span>
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)} className="gap-2" title="Convidar músicos">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Convidar</span>
              </Button>

              <Button
                variant={autoHideControls ? "outline" : "secondary"}
                size="sm"
                onClick={() => setAutoHideControls((v) => !v)}
                className="gap-2"
              >
                {autoHideControls ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="hidden sm:inline">{autoHideControls ? "Auto-hide" : "Sempre visível"}</span>
              </Button>
              <Button variant="outline" onClick={() => setTeleprompterOpen(true)} className="gap-2">
                <MonitorPlay className="h-4 w-4" />
                <span className="hidden sm:inline">Teleprompter</span>
              </Button>
            </>
          )}
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Adicionar</span>
          </Button>
        </div>
      </div>

      {/* Following / Master indicators */}
      {stageSync.isFollowing && stageSync.masterName && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Radio className="h-4 w-4 text-primary animate-pulse" />
          <span>A seguir <strong className="text-primary">{stageSync.masterName}</strong> — ecrã sincronizado</span>
        </div>
      )}
      {stageSync.isMaster && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <Radio className="h-4 w-4 text-destructive animate-pulse" />
          <span><strong className="text-destructive">Transmissão Mestre ativa</strong> — {stageSync.connectedCount - 1} membro(s) conectado(s)</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          <Music2 className="h-10 w-10 mb-3 opacity-40" />
          <p>Nenhuma música na setlist</p>
          <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>
            Adicionar música
          </Button>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <SetlistToolbar
            sortBy={sortBy}
            onSortChange={setSortBy}
            filterKey={filterKey}
            onFilterKeyChange={setFilterKey}
            availableKeys={availableKeys}
            allSelected={allVisibleSelected}
            someSelected={someVisibleSelected}
            onSelectAll={toggleSelectAll}
            selectionCount={selectedSongs.size}
          />

          {/* Song list */}
          <div className="space-y-1">
            {processedItems.map((item: any, i: number) => (
              <div
                key={item.id}
                className={`group flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/30 animate-fade-in ${
                  selectedSongs.has(item.id) ? "border-primary/50 bg-primary/5" : "border-border"
                }`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Header row */}
                <div className="flex items-start gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
                  <Checkbox
                    checked={selectedSongs.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    className="mt-2 shrink-0"
                    aria-label={`Selecionar ${item.songs?.title}`}
                  />
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab mt-2 shrink-0 hidden sm:block" />
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary font-mono text-sm font-bold mt-0.5">
                    {item.position}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/songs/${item.song_id}`} className="font-medium hover:text-primary transition-colors text-sm sm:text-base">
                          {item.songs?.title}
                        </Link>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {item.songs?.artist}
                          {item.songs?.musical_key && ` · ${item.songs.musical_key}`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="sm:opacity-0 sm:group-hover:opacity-100 shrink-0 h-8 w-8"
                        onClick={() => removeMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Controls row */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap pl-11 sm:pl-0">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Loop</label>
                    <Select
                      value={String(getVal(item, "loop_count") ?? 0)}
                      onValueChange={(v) => updateField(item.id, "loop_count", Number(v), item)}
                    >
                      <SelectTrigger className="h-7 w-14 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Vel</label>
                    <Input
                      type="number"
                      min={0.5}
                      max={5}
                      step={0.1}
                      className="h-7 w-16 text-xs"
                      value={((getVal(item, "speed") ?? item.songs?.default_speed ?? 250) / 100).toFixed(1)}
                      onChange={(e) =>
                        updateField(item.id, "speed", e.target.value ? Math.round(Number(e.target.value) * 100) : null, item)
                      }
                    />
                    <span className="text-xs text-muted-foreground">x</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">BPM</label>
                    <Input
                      type="number"
                      min={20}
                      max={300}
                      className="h-7 w-16 text-xs"
                      placeholder={item.songs?.bpm ? String(item.songs.bpm) : "—"}
                      value={getVal(item, "bpm") ?? ""}
                      onChange={(e) =>
                        updateField(item.id, "bpm", e.target.value ? Number(e.target.value) : null, item)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create from selection sticky bar */}
      <CreateFromSelectionBar
        count={selectedSongs.size}
        onSubmit={handleCreateFromSelection}
      />

      {/* Add song dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Adicionar Música</DialogTitle>
          </DialogHeader>
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-[50vh] overflow-y-auto space-y-1 mt-2">
            {availableSongs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma música disponível</p>
            ) : (
              availableSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => addMutation.mutate(song.id)}
                  className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-secondary transition-colors"
                >
                  <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{song.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {song.artist} {song.musical_key && `· ${song.musical_key}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StageSyncInviteModal
        open={!!stageSync.invite}
        masterName={stageSync.invite?.masterName || ""}
        onAccept={stageSync.acceptInvite}
        onDecline={stageSync.declineInvite}
      />

      <SyncInviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        setlistId={id!}
        setlistName={setlist?.name || ""}
      />

      <Teleprompter
        songs={items.map((item: any) => ({
          title: item.songs?.title || "",
          artist: item.songs?.artist,
          artist_photo_url: item.songs?.artist ? artistPhotoMap[item.songs.artist.toLowerCase()] || null : null,
          musical_key: item.songs?.musical_key,
          bpm: item.songs?.bpm ?? item.bpm,
          body_text: item.songs?.body_text,
          loop_count: item.loop_count ?? item.songs?.loop_count,
          auto_next: item.songs?.auto_next,
          speed: item.speed ?? item.songs?.default_speed ?? 250,
        }))}
        open={teleprompterOpen}
        onClose={() => setTeleprompterOpen(false)}
        autoHideControls={autoHideControls}
      />
    </div>
  );
}
