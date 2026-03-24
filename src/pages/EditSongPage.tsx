import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BackButton from "@/components/ui/BackButton";
import { fetchSong } from "@/lib/supabase-queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import VisualChordEditor from "@/components/VisualChordEditor";

const KEYS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F",
  "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
  "Am", "A#m", "Bbm", "Bm", "Cm", "C#m", "Dm", "D#m",
  "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Abm",
];

const GENRES = [
  "Pop", "Rock", "Sertanejo", "MPB", "Forró", "Gospel",
  "Pagode", "Samba", "Bossa Nova", "Jazz", "Blues", "Country",
  "Reggae", "Funk", "Axé", "Eletrônica", "Hip Hop", "R&B",
  "Clássica", "Folk", "Outro",
];

export default function EditSongPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [musicalKey, setMusicalKey] = useState("");
  const [style, setStyle] = useState("");
  const [bpm, setBpm] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [visualMode, setVisualMode] = useState(false);

  const { data: song, isLoading } = useQuery({
    queryKey: ["song", id],
    queryFn: () => fetchSong(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (song) {
      setTitle(song.title || "");
      setArtist(song.artist || "");
      setMusicalKey(song.musical_key || "");
      setStyle(song.style || "");
      setBpm(song.bpm?.toString() || "");
      setBodyText(song.body_text || "");
    }
  }, [song]);

  const isOwner = user?.id === song?.created_by || user?.id === song?.user_id;
  const canManage = isOwner || isAdmin;

  const handleSave = async () => {
    if (!id || !canManage) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("songs")
        .update({
          title,
          artist: artist || null,
          musical_key: musicalKey || null,
          style: style || null,
          bpm: bpm ? parseInt(bpm) : null,
          body_text: bodyText || null,
        })
        .eq("id", id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["song", id] });
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success("Música atualizada com sucesso!");
      navigate(`/songs/${id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar a música.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!song) return <p className="text-muted-foreground">Música não encontrada.</p>;

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManage) {
    return <p className="text-muted-foreground">Você não tem permissão para editar esta música.</p>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="text-2xl font-bold tracking-tight">Editar Música</h1>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome da música" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="artist">Artista</Label>
          <Input id="artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Nome do artista" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tom</Label>
            <Select value={musicalKey} onValueChange={setMusicalKey}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {KEYS.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Gênero</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bpm">BPM</Label>
            <Input id="bpm" type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="120" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Letra / Cifra</Label>
          <Textarea
            id="body"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Cole aqui a letra com cifras..."
            className="min-h-[300px] font-mono text-sm"
          />
        </div>

        <Button onClick={handleSave} disabled={saving || !title.trim()} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}
