import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, GripVertical, Music2, MonitorPlay, Save, Eye, EyeOff, Radio, Wifi, WifiOff, UserPlus, Share2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  fetchSetlist, fetchSetlistItems, fetchSongs, fetchArtists,
  addSongToSetlist, removeSongFromSetlist, bulkUpdateSetlistItems,
  createSetlistFromSelection, updateSetlist, updateSetlistItemPositions,
} from "@/lib/supabase-queries";

import { toast } from "sonner";
import Teleprompter from "@/components/Teleprompter";
import { useStageSync } from "@/hooks/useStageSync";
import StageSyncInviteModal from "@/components/StageSyncInviteModal";
import SyncInviteModal from "@/components/SyncInviteModal";
import SetlistToolbar, { type SortBy } from "@/components/SetlistToolbar";
import CreateFromSelectionBar from "@/components/CreateFromSelectionBar";
import SetlistSettingsModal from "@/components/SetlistSettingsModal";
import SetlistHeader from "@/components/SetlistHeader";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const CHROMATIC_ORDER = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
function chromaticIndex(key: string | null | undefined): number {
  if (!key) return 999;
  const base = key.replace(/m$/, "").trim();
  const idx = CHROMATIC_ORDER.indexOf(base);
  return idx >= 0 ? idx : 999;
}

// Speed cycle values for mobile
const SPEED_CYCLE = [80, 100, 120, 150, 200, 250, 300, 400];
function nextSpeedCycle(current: number): number {
  const idx = SPEED_CYCLE.findIndex(v => v > current);
  return idx >= 0 ? SPEED_CYCLE[idx] : SPEED_CYCLE[0];
}
function prevSpeedCycle(current: number): number {
  const reversed = [...SPEED_CYCLE].reverse();
  const idx = reversed.findIndex(v => v < current);
  return idx >= 0 ? reversed[idx] : reversed[0];
}

// Sortable song item component
function SortableSongItem({
  item, selectedSongs, toggleSelect, getVal, updateField,
  removeMutation, isMobile,
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const currentSpeed = getVal(item, "speed") ?? item.songs?.default_speed ?? 250;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/30 animate-fade-in",
        selectedSongs.has(item.id) ? "border-primary/50 bg-primary/5" : "border-border",
        isDragging && "shadow-lg"
      )}
    >
      <div className="flex items-start gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
        <Checkbox
          checked={selectedSongs.has(item.id)}
          onCheckedChange={() => toggleSelect(item.id)}
          className="mt-2 shrink-0"
          aria-label={`Selecionar ${item.songs?.title}`}
        />
        <button {...attributes} {...listeners} className="touch-none mt-2 shrink-0 cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
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
            <Button variant="ghost" size="icon" className="sm:opacity-0 sm:group-hover:opacity-100 shrink-0 h-8 w-8" onClick={() => removeMutation.mutate(item.id)}>
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
            <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Speed: Mobile = cycle buttons, Desktop = input */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Vel</label>
          {isMobile ? (
            <div className="flex items-center gap-0.5">
              <Button
                variant="outline" size="icon"
                className="h-8 w-8"
                onClick={() => updateField(item.id, "speed", prevSpeedCycle(currentSpeed), item)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <button
                className="h-8 min-w-[3rem] px-2 rounded-md border border-border bg-card text-xs font-mono font-bold text-center"
                onClick={() => updateField(item.id, "speed", nextSpeedCycle(currentSpeed), item)}
              >
                {(currentSpeed / 100).toFixed(1)}x
              </button>
              <Button
                variant="outline" size="icon"
                className="h-8 w-8"
                onClick={() => updateField(item.id, "speed", nextSpeedCycle(currentSpeed), item)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <Input
                type="number" min={0.5} max={5} step={0.1}
                className="h-7 w-16 text-xs"
                value={(currentSpeed / 100).toFixed(1)}
                onChange={(e) => updateField(item.id, "speed", e.target.value ? Math.round(Number(e.target.value) * 100) : null, item)}
              />
              <span className="text-xs text-muted-foreground">x</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <label className="text-xs text-muted-foreground whitespace-nowrap">BPM</label>
          <Input
            type="number" min={20} max={300}
            className="h-7 w-16 text-xs"
            placeholder={item.songs?.bpm ? String(item.songs.bpm) : "—"}
            value={getVal(item, "bpm") ?? ""}
            onChange={(e) => updateField(item.id, "bpm", e.target.value ? Number(e.target.value) : null, item)}
          />
        </div>
      </div>
    </div>
  );
}

export default function SetlistDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const { data: artists = [] } = useQuery({ queryKey: ["artists"], queryFn: fetchArtists });

  const artistPhotoMap = Object.fromEntries(
    artists.filter(a => a.photo_url).map(a => [a.name.toLowerCase(), a.photo_url])
  );

  const { data: allSongs = [] } = useQuery({
    queryKey: ["songs"],
    queryFn: fetchSongs,
    enabled: addOpen,
  });

  // Offline cache
  useOfflineCache(id, setlist, items);

  // Stage sync
  const stageSync = useStageSync({
    setlistId: id,
    inviteToken,
    onSongChange: (index) => { toast.info(`Mestre navegou para música ${index + 1}`); },
    onScroll: () => {},
    onPlay: () => toast.info("Mestre iniciou reprodução"),
    onPause: () => toast.info("Mestre pausou"),
  });

  useEffect(() => {
    if (inviteToken && stageSync.isFollowing && items.length > 0 && !teleprompterOpen) {
      setTeleprompterOpen(true);
    }
  }, [inviteToken, stageSync.isFollowing, items.length]);

  // Available keys for filter
  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach((item: any) => {
      const k = item.songs?.musical_key;
      if (k) keys.add(k);
    });
    return Array.from(keys).sort((a, b) => chromaticIndex(a) - chromaticIndex(b));
  }, [items]);

  // Filtered + sorted items
  const processedItems = useMemo(() => {
    let result = [...items] as any[];
    if (filterKey !== "all") {
      result = result.filter((item: any) => item.songs?.musical_key === filterKey);
    }
    if (sortBy === "artist") {
      result.sort((a: any, b: any) => (a.songs?.artist || "").localeCompare(b.songs?.artist || ""));
    } else if (sortBy === "key") {
      result.sort((a: any, b: any) => chromaticIndex(a.songs?.musical_key) - chromaticIndex(b.songs?.musical_key));
    }
    return result;
  }, [items, filterKey, sortBy]);

  // Selection helpers
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
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }, []);

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

  // Drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || sortBy !== "manual") return;

    const oldIndex = items.findIndex((i: any) => i.id === active.id);
    const newIndex = items.findIndex((i: any) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove([...items] as any[], oldIndex, newIndex);
    const updates = reordered.map((item: any, idx: number) => ({ id: item.id, position: idx + 1 }));

    // Optimistic update
    queryClient.setQueryData(["setlist-items", id], reordered.map((item: any, idx: number) => ({ ...item, position: idx + 1 })));

    try {
      await updateSetlistItemPositions(updates);
      queryClient.invalidateQueries({ queryKey: ["setlist-items", id] });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["setlist-items", id] });
      toast.error("Erro ao reordenar");
    }
  }, [items, sortBy, id, queryClient]);

  // Mutations
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
    }, []
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
    (s) => !existingIds.has(s.id) &&
      (s.title.toLowerCase().includes(search.toLowerCase()) ||
        (s.artist && s.artist.toLowerCase().includes(search.toLowerCase())))
  );

  // WhatsApp share
  const handleShareWhatsApp = useCallback(() => {
    if (!setlist || items.length === 0) return;
    const sl = setlist as any;
    let text = `🎵 *${sl.name}*\n`;
    if (sl.show_date) text += `📅 ${format(new Date(sl.show_date), "dd/MM/yyyy")}\n`;
    if (sl.start_time) {
      text += `⏰ ${sl.start_time}`;
      if (sl.end_time) text += ` às ${sl.end_time}`;
      text += "\n";
    }
    if (sl.musicians && sl.musicians.length > 0) {
      text += `👥 ${sl.musicians.join(", ")}\n`;
    }
    text += `\n📋 *Músicas (${items.length}):*\n`;
    items.forEach((item: any, idx: number) => {
      text += `${idx + 1}. ${item.songs?.title || "—"}`;
      if (item.songs?.artist) text += ` — ${item.songs.artist}`;
      if (item.songs?.musical_key) text += ` [${item.songs.musical_key}]`;
      text += "\n";
    });
    text += "\n_Gerado pelo Smart Cifra_ 🎸";
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }, [setlist, items]);

  return (
    <div className={`max-w-3xl space-y-6 animate-fade-in ${selectedSongs.size > 0 ? "pb-28" : ""}`}>
      <Button variant="ghost" asChild className="gap-2">
        <Link to="/setlists"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      </Button>

      <SetlistHeader
        name={setlist?.name || ""}
        itemCount={items.length}
        showDate={(setlist as any)?.show_date}
        startTime={(setlist as any)?.start_time}
        endTime={(setlist as any)?.end_time}
        intervalDuration={(setlist as any)?.interval_duration}
        showDuration={(setlist as any)?.show_duration}
        musicians={(setlist as any)?.musicians}
        onSettingsClick={() => setSettingsOpen(true)}
      >
        {stageSync.connectedCount > 1 && (
          <Badge variant="secondary" className="text-xs">
            <Wifi className="h-3 w-3 mr-1" />
            {stageSync.connectedCount} online
          </Badge>
        )}
      </SetlistHeader>

      <div className="flex items-center gap-2 flex-wrap">
        {dirty && (
          <Button onClick={() => {
            const payload = items.map((item: any) => {
              const ov = localOverrides[item.id];
              return { id: item.id, loop_count: ov?.loop_count ?? item.loop_count ?? null, speed: ov?.speed ?? item.speed ?? null, bpm: ov?.bpm ?? item.bpm ?? null };
            });
            bulkUpdateSetlistItems(payload).then(() => {
              queryClient.invalidateQueries({ queryKey: ["setlist-items", id] });
              setLocalOverrides({});
              setDirty(false);
              toast.success("Configurações salvas!");
            });
          }} className="gap-2">
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Salvar</span>
          </Button>
        )}
        {items.length > 0 && (
          <>
            {stageSync.isMaster ? (
              <Button variant="destructive" size="sm" onClick={stageSync.stopMaster} className="gap-2 animate-pulse">
                <Radio className="h-4 w-4" /><span className="hidden sm:inline">Parar</span>
              </Button>
            ) : stageSync.isFollowing ? (
              <Button variant="secondary" size="sm" onClick={stageSync.stopFollowing} className="gap-2">
                <WifiOff className="h-4 w-4" /><span className="hidden sm:inline">Desconectar</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={stageSync.startMaster} className="gap-2">
                <Radio className="h-4 w-4" /><span className="hidden sm:inline">Palco</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Convidar</span>
            </Button>
            <Button variant={autoHideControls ? "outline" : "secondary"} size="sm" onClick={() => setAutoHideControls((v) => !v)} className="gap-2">
              {autoHideControls ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="hidden sm:inline">{autoHideControls ? "Auto-hide" : "Visível"}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleShareWhatsApp} className="gap-2" title="Compartilhar via WhatsApp">
              <Share2 className="h-4 w-4" /><span className="hidden sm:inline">WhatsApp</span>
            </Button>
            <Button variant="outline" onClick={() => setTeleprompterOpen(true)} className="gap-2">
              <MonitorPlay className="h-4 w-4" /><span className="hidden sm:inline">Teleprompter</span>
            </Button>
          </>
        )}
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /><span className="hidden sm:inline ml-1">Adicionar</span>
        </Button>
      </div>

      {stageSync.isFollowing && stageSync.masterName && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Radio className="h-4 w-4 text-primary animate-pulse" />
          <span>A seguir <strong className="text-primary">{stageSync.masterName}</strong></span>
        </div>
      )}
      {stageSync.isMaster && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <Radio className="h-4 w-4 text-destructive animate-pulse" />
          <span><strong className="text-destructive">Transmissão Mestre</strong> — {stageSync.connectedCount - 1} conectado(s)</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          <Music2 className="h-10 w-10 mb-3 opacity-40" />
          <p>Nenhuma música na setlist</p>
          <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>Adicionar música</Button>
        </div>
      ) : (
        <>
          <SetlistToolbar
            sortBy={sortBy} onSortChange={setSortBy}
            filterKey={filterKey} onFilterKeyChange={setFilterKey}
            availableKeys={availableKeys}
            allSelected={allVisibleSelected} someSelected={someVisibleSelected}
            onSelectAll={toggleSelectAll} selectionCount={selectedSongs.size}
          />

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={processedItems.map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {processedItems.map((item: any, i: number) => (
                  <SortableSongItem
                    key={item.id}
                    item={item} i={i}
                    selectedSongs={selectedSongs}
                    toggleSelect={toggleSelect}
                    getVal={getVal}
                    updateField={updateField}
                    removeMutation={removeMutation}
                    
                    isMobile={isMobile}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      <CreateFromSelectionBar count={selectedSongs.size} onSubmit={handleCreateFromSelection} />

      {/* Add song dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[80vh]">
          <DialogHeader><DialogTitle>Adicionar Música</DialogTitle></DialogHeader>
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-[50vh] overflow-y-auto space-y-1 mt-2">
            {availableSongs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma música disponível</p>
            ) : (
              availableSongs.map((song) => (
                <button key={song.id} onClick={() => addMutation.mutate(song.id)} className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-secondary transition-colors">
                  <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{song.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{song.artist} {song.musical_key && `· ${song.musical_key}`}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StageSyncInviteModal open={!!stageSync.invite} masterName={stageSync.invite?.masterName || ""} onAccept={stageSync.acceptInvite} onDecline={stageSync.declineInvite} />
      <SyncInviteModal open={inviteOpen} onOpenChange={setInviteOpen} setlistId={id!} setlistName={setlist?.name || ""} />

      <SetlistSettingsModal
        open={settingsOpen} onOpenChange={setSettingsOpen}
        setlist={setlist ? { ...(setlist as any) } : null}
        onSave={async (data) => {
          await updateSetlist(id!, data as any);
          queryClient.invalidateQueries({ queryKey: ["setlist", id] });
        }}
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
