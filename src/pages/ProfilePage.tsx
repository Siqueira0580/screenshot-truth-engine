import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, Save, ShieldCheck, ChevronRight, Crown, CalendarClock, RefreshCw, Download, Music, Instagram, Facebook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import DangerZone from "@/components/DangerZone";
import BackButton from "@/components/ui/BackButton";
import { usePwaInstall } from "@/hooks/usePwaInstall";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  subscription_plan: string;
  pro_expires_at: string | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isPro } = useSubscription();
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultGenre, setDefaultGenre] = useState("todos");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .single();

    if (error) {
      toast.error("Erro ao carregar perfil");
      setLoading(false);
      return;
    }

    setProfile(data);
    setFirstName(data.first_name || "");
    setLastName(data.last_name || "");
    setPhone(data.phone || "");
    setDefaultGenre(data.default_genre || "todos");
    setInstagramUrl(data.instagram_url || "");
    setFacebookUrl(data.facebook_url || "");
    setLoading(false);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        default_genre: defaultGenre,
        instagram_url: instagramUrl.trim() || null,
        facebook_url: facebookUrl.trim() || null,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao salvar perfil");
    } else {
      toast("Perfil atualizado!", {
        description: "As suas configurações foram salvas. Por favor, atualize a página ou faça um novo acesso para aplicar a sua nova aba padrão na página inicial.",
        duration: 5000,
      });
      await loadProfile();
    }
    setSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um ficheiro de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar imagem");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao atualizar avatar");
    } else {
      toast.success("Avatar atualizado!");
      await loadProfile();
    }
    setUploading(false);
  }

  const initials = [firstName, lastName]
    .filter(Boolean)
    .map((n) => n[0]?.toUpperCase())
    .join("") || "U";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="items-center pb-2">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Avatar className="h-24 w-24 border-2 border-primary/30">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <Camera className="h-6 w-6 text-primary" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <CardTitle className="text-lg text-foreground mt-2">
            {firstName || lastName ? `${firstName} ${lastName}`.trim() : user?.email}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Seu nome"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Seu sobrenome"
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user?.email || ""} disabled className="opacity-60" />
           </div>

          {/* Redes Sociais */}
          <div className="space-y-2">
            <Label htmlFor="instagramUrl" className="flex items-center gap-1.5">
              <Instagram className="h-4 w-4 text-primary" />
              Link do Instagram
            </Label>
            <Input
              id="instagramUrl"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/seu_perfil"
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="facebookUrl" className="flex items-center gap-1.5">
              <Facebook className="h-4 w-4 text-primary" />
              Link do Facebook
            </Label>
            <Input
              id="facebookUrl"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              placeholder="https://facebook.com/seu_perfil"
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultGenre" className="flex items-center gap-1.5">
              <Music className="h-4 w-4 text-primary" />
              Estilo favorito na tela inicial
            </Label>
            <Select value={defaultGenre} onValueChange={setDefaultGenre}>
              <SelectTrigger id="defaultGenre">
                <SelectValue placeholder="Selecione um estilo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">🎵 Todos</SelectItem>
                <SelectItem value="pop">🎤 Pop</SelectItem>
                <SelectItem value="rock">🎸 Rock</SelectItem>
                <SelectItem value="sertanejo">🤠 Sertanejo</SelectItem>
                <SelectItem value="worship">🙏 Worship</SelectItem>
                <SelectItem value="samba">🥁 Samba</SelectItem>
                <SelectItem value="pagode">🪘 Pagode</SelectItem>
                <SelectItem value="mpb">🇧🇷 MPB</SelectItem>
                <SelectItem value="forro">🪗 Forró</SelectItem>
                <SelectItem value="gospel">✝️ Gospel</SelectItem>
                <SelectItem value="eletronica">🎧 Eletrônica</SelectItem>
                <SelectItem value="reggae">🟢 Reggae</SelectItem>
                <SelectItem value="funk">🔊 Funk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </CardContent>
      </Card>

      {/* Subscription Card */}
      <Card className="border-border bg-card">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className={`h-5 w-5 ${isPro ? "text-amber-500" : "text-muted-foreground"}`} />
              <span className="font-semibold text-foreground">
                Plano {isPro ? "Pro" : "Free"}
              </span>
            </div>
            <Badge variant={isPro ? "default" : "secondary"} className={isPro ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : ""}>
              {isPro ? "Ativo" : "Gratuito"}
            </Badge>
          </div>

          {isPro && profile?.pro_expires_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              <span>
                Expira em{" "}
                <span className="font-medium text-foreground">
                  {new Date(profile.pro_expires_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </span>
            </div>
          )}

          <Button
            variant={isPro ? "outline" : "default"}
            className={`w-full gap-2 ${!isPro ? "bg-gradient-to-r from-amber-500 to-primary text-primary-foreground" : ""}`}
            onClick={() => navigate("/planos")}
          >
            {isPro ? (
              <>
                <RefreshCw className="h-4 w-4" /> Renovar Plano
              </>
            ) : (
              <>
                <Crown className="h-4 w-4" /> Assinar Pro
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Instalar App */}
      {!isInstalled && (
        <button
          onClick={async () => {
            if (canInstall) {
              const accepted = await promptInstall();
              if (accepted) toast.success("App instalado com sucesso!");
            } else {
              toast.info("Use o menu do navegador para adicionar à tela inicial.");
            }
          }}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary/50 transition-colors group w-full"
        >
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-primary group-hover:text-primary/80 transition-colors" />
            <span className="text-sm font-medium text-foreground">Adicionar app à Tela Inicial</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Termos de Uso */}
      <Link
        to="/terms"
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-sm font-medium text-foreground">Termos de Uso e Privacidade</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      {/* Danger Zone */}
      <DangerZone />
    </div>
  );
}
