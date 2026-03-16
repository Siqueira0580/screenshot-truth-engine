import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { Megaphone, Power, Globe, Trash2 } from "lucide-react";

interface PublicSetlist {
  id: string;
  name: string;
  public_share_token: string;
  user_id: string | null;
}

export default function AdminSystemTab() {
  const [bannerText, setBannerText] = useState("");
  const [savedBanner, setSavedBanner] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [vipMaintenanceMode, setVipMaintenanceMode] = useState(false);
  const [publicSetlists, setPublicSetlists] = useState<PublicSetlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [bannerRes, modeRes, vipModeRes, setlistsRes] = await Promise.all([
        supabase.from("global_settings").select("setting_value").eq("setting_key", "maintenance_banner").maybeSingle(),
        supabase.from("global_settings").select("setting_value").eq("setting_key", "maintenance_mode").maybeSingle(),
        supabase.from("global_settings").select("setting_value").eq("setting_key", "vip_maintenance_mode").maybeSingle(),
        supabase.from("setlists").select("id, name, public_share_token, user_id").not("public_share_token", "is", null),
      ]);
      setSavedBanner(bannerRes.data?.setting_value ?? "");
      setBannerText(bannerRes.data?.setting_value ?? "");
      setMaintenanceMode(modeRes.data?.setting_value === "true");
      setVipMaintenanceMode(vipModeRes.data?.setting_value === "true");
      setPublicSetlists(setlistsRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const upsertSetting = async (key: string, value: string) => {
    // Try update first, if no rows affected, insert
    const { data } = await supabase
      .from("global_settings")
      .update({ setting_value: value })
      .eq("setting_key", key)
      .select("id");
    if (!data || data.length === 0) {
      await supabase.from("global_settings").insert({ setting_key: key, setting_value: value });
    }
  };

  const publishBanner = async () => {
    await upsertSetting("maintenance_banner", bannerText.trim());
    setSavedBanner(bannerText.trim());
    toast.success(bannerText.trim() ? "Aviso publicado!" : "Aviso removido.");
  };

  const toggleMaintenance = async (checked: boolean) => {
    setMaintenanceMode(checked);
    await upsertSetting("maintenance_mode", checked ? "true" : "false");
    toast.success(checked ? "Modo manutenção ativado." : "Modo manutenção desativado.");
  };

  const toggleVipMaintenance = async (checked: boolean) => {
    setVipMaintenanceMode(checked);
    await upsertSetting("vip_maintenance_mode", checked ? "true" : "false");
    toast.success(checked ? "Modo Atualização VIP ativado." : "Modo Atualização VIP desativado.");
  };

  const revokePublicLink = async (setlist: PublicSetlist) => {
    const { error } = await supabase
      .from("setlists")
      .update({ public_share_token: null })
      .eq("id", setlist.id);
    if (error) toast.error("Erro ao revogar link.");
    else {
      toast.success(`Link público de "${setlist.name}" revogado.`);
      setPublicSetlists((prev) => prev.filter((s) => s.id !== setlist.id));
    }
  };

  if (loading) return <p className="text-muted-foreground text-sm">A carregar...</p>;

  return (
    <div className="space-y-6">
      {/* Broadcast Banner */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center gap-2 pb-2 space-y-0">
          <Megaphone className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-lg">Aviso Global (Broadcast)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="banner-text" className="text-xs">Mensagem do aviso</Label>
            <Input
              id="banner-text"
              placeholder="Ex: Manutenção programada para hoje às 22h."
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={publishBanner} className="gap-2">
              <Megaphone className="h-4 w-4" /> Publicar Aviso
            </Button>
            {savedBanner && (
              <Button variant="outline" onClick={() => { setBannerText(""); publishBanner(); }}>
                Remover Aviso
              </Button>
            )}
          </div>
          {savedBanner && (
            <p className="text-xs text-muted-foreground">Aviso ativo: "{savedBanner}"</p>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Mode */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center gap-2 pb-2 space-y-0">
          <Power className="h-5 w-5 text-red-500" />
          <CardTitle className="text-lg">Modo Manutenção (Kill Switch)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">
                {maintenanceMode ? "Manutenção ATIVA" : "Sistema operacional"}
              </p>
              <p className="text-xs text-muted-foreground">
                Quando ativo, os utilizadores vêem uma mensagem de manutenção.
              </p>
            </div>
            <Switch checked={maintenanceMode} onCheckedChange={toggleMaintenance} />
          </div>
        </CardContent>
      </Card>

      {/* Public Setlists Moderation */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center gap-2 pb-2 space-y-0">
          <Globe className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-lg">Repertórios Públicos ({publicSetlists.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {publicSetlists.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">Nenhum repertório público ativo.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publicSetlists.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                        {s.public_share_token}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive gap-1"
                          onClick={() => revokePublicLink(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Revogar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
