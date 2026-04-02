import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Users, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<any>(null);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase
        .from("group_invites")
        .select("id, group_id, status, created_by, community_groups(name)")
        .eq("id", token)
        .maybeSingle();

      if (error || !data) {
        setExpired(true);
        setLoading(false);
        return;
      }

      if (data.status !== "pending") {
        setExpired(true);
        setLoading(false);
        return;
      }

      // Check if invite has expired
      const expiresAt = (data as any).expires_at;
      if (expiresAt && new Date(expiresAt) < new Date()) {
        setExpired(true);
        setLoading(false);
        return;
      }

      setInvite(data);
      const group = data.community_groups as any;
      setGroupName(group?.name || "Grupo");
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!user || !invite) return;
    setProcessing(true);
    try {
      // Check if already member
      const { data: existing } = await supabase
        .from("community_group_members")
        .select("id")
        .eq("group_id", invite.group_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        const { error: memberErr } = await supabase
          .from("community_group_members")
          .insert({ group_id: invite.group_id, user_id: user.id });
        if (memberErr) throw memberErr;
      }

      await supabase
        .from("group_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      toast.success("Você entrou no grupo com sucesso!");
      navigate("/community");
    } catch {
      toast.error("Erro ao aceitar convite");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!invite) return;
    setProcessing(true);
    try {
      await supabase
        .from("group_invites")
        .update({ status: "rejected" })
        .eq("id", invite.id);

      toast("Convite recusado");
      navigate("/community");
    } catch {
      toast.error("Erro ao recusar convite");
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Users className="h-12 w-12 mx-auto text-primary mb-2" />
            <CardTitle>Convite para Grupo</CardTitle>
            <CardDescription>
              Você precisa estar logado para aceitar este convite.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate(`/login?redirect=/invite/${token}`)}>
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription>
              Este convite já foi utilizado ou não existe.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate("/community")}>
              Ir para a Comunidade
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Users className="h-14 w-14 mx-auto text-primary mb-3" />
          <CardTitle className="text-xl">Convite para Grupo</CardTitle>
          <CardDescription className="text-base mt-1">
            Você foi convidado para o grupo
          </CardDescription>
          <p className="text-lg font-semibold text-foreground mt-2">"{groupName}"</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            className="w-full gap-2"
            disabled={processing}
            onClick={handleAccept}
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aceitar Convite
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive hover:text-destructive"
            disabled={processing}
            onClick={handleReject}
          >
            <XCircle className="h-4 w-4" />
            Recusar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
