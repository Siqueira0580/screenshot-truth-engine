import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StageSyncPayload {
  type: "song_change" | "scroll" | "play" | "pause" | "transpose";
  songIndex?: number;
  scrollTop?: number;
  speed?: number;
  transpose?: number;
  masterName?: string;
}

interface StageSyncInvite {
  masterName: string;
  masterId: string;
}

interface UseStageSyncOptions {
  setlistId: string | undefined;
  inviteToken?: string | null;
  onSongChange?: (index: number) => void;
  onScroll?: (scrollTop: number) => void;
  onPlay?: (speed?: number) => void;
  onPause?: () => void;
  onTranspose?: (transpose: number) => void;
}

export function useStageSync(options: UseStageSyncOptions) {
  const { setlistId, inviteToken, onSongChange, onScroll, onPlay, onPause, onTranspose } = options;
  const { user } = useAuth();
  const [isMaster, setIsMaster] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [invite, setInvite] = useState<StageSyncInvite | null>(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [masterName, setMasterName] = useState<string | null>(null);
  const autoConnectHandled = useRef(false);

  // Get user display name
  const getUserName = useCallback(async () => {
    if (!user) return "Anónimo";
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();
    if (data?.first_name) return `${data.first_name}${data.last_name ? ` ${data.last_name}` : ""}`;
    return user.email?.split("@")[0] || "Anónimo";
  }, [user]);

  // Join channel
  useEffect(() => {
    if (!setlistId || !user) return;

    const channelName = `stage-sync-${setlistId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("broadcast", { event: "stage-command" }, ({ payload }: { payload: StageSyncPayload }) => {
        if (isMaster) return; // Master doesn't follow its own commands
        if (!isFollowing && payload.type !== "song_change") return;

        switch (payload.type) {
          case "song_change":
            if (isFollowing) onSongChange?.(payload.songIndex ?? 0);
            break;
          case "scroll":
            if (isFollowing) onScroll?.(payload.scrollTop ?? 0);
            break;
          case "play":
            if (isFollowing) onPlay?.(payload.speed);
            break;
          case "pause":
            if (isFollowing) onPause?.();
            break;
          case "transpose":
            if (isFollowing) onTranspose?.(payload.transpose ?? 0);
            break;
        }
      })
      .on("broadcast", { event: "master-start" }, async ({ payload }) => {
        if (payload.masterId === user.id) return;
        setInvite({ masterName: payload.masterName, masterId: payload.masterId });
      })
      .on("broadcast", { event: "master-stop" }, () => {
        setIsFollowing(false);
        setMasterName(null);
        setInvite(null);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setConnectedCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, joined_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [setlistId, user, isMaster, isFollowing, onSongChange, onScroll, onPlay, onPause, onTranspose]);

  // Auto-connect via invite token
  useEffect(() => {
    if (!inviteToken || !user || !setlistId || autoConnectHandled.current) return;
    autoConnectHandled.current = true;

    (async () => {
      const { data: inviteData, error } = await supabase
        .from("sync_invites")
        .select("master_id, status")
        .eq("token", inviteToken)
        .eq("setlist_id", setlistId)
        .single();

      if (error || !inviteData) return;

      // Update invite status to accepted
      await supabase
        .from("sync_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("token", inviteToken);

      // Get master name
      const { data: masterProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", inviteData.master_id)
        .single();

      const mName = masterProfile?.first_name
        ? `${masterProfile.first_name}${masterProfile.last_name ? ` ${masterProfile.last_name}` : ""}`
        : "Mestre";

      setIsFollowing(true);
      setMasterName(mName);
    })();
  }, [inviteToken, user, setlistId]);

  // Start master broadcast
  const startMaster = useCallback(async () => {
    if (!channelRef.current || !user) return;
    const name = await getUserName();
    setIsMaster(true);
    setIsFollowing(false);
    setMasterName(name);
    channelRef.current.send({
      type: "broadcast",
      event: "master-start",
      payload: { masterName: name, masterId: user.id },
    });
  }, [user, getUserName]);

  // Stop master broadcast
  const stopMaster = useCallback(() => {
    if (!channelRef.current) return;
    setIsMaster(false);
    setMasterName(null);
    channelRef.current.send({
      type: "broadcast",
      event: "master-stop",
      payload: {},
    });
  }, []);

  // Send command as master
  const sendCommand = useCallback(
    (payload: StageSyncPayload) => {
      if (!channelRef.current || !isMaster) return;
      channelRef.current.send({
        type: "broadcast",
        event: "stage-command",
        payload,
      });
    },
    [isMaster]
  );

  // Accept invite
  const acceptInvite = useCallback(() => {
    if (!invite) return;
    setIsFollowing(true);
    setMasterName(invite.masterName);
    setInvite(null);
  }, [invite]);

  // Decline invite
  const declineInvite = useCallback(() => {
    setInvite(null);
  }, []);

  // Disconnect follower
  const stopFollowing = useCallback(() => {
    setIsFollowing(false);
    setMasterName(null);
  }, []);

  return {
    isMaster,
    isFollowing,
    invite,
    connectedCount,
    masterName,
    startMaster,
    stopMaster,
    sendCommand,
    acceptInvite,
    declineInvite,
    stopFollowing,
  };
}
