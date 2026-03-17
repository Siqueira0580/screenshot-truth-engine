import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StageSyncState {
  songIndex: number;
  scrollTop: number;
  transpose: number;
  isPlaying: boolean;
  speed?: number;
  masterName?: string;
}

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

const DEBOUNCE_MS = 200;

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

  // Master state ref for instant access without re-renders
  const masterStateRef = useRef<StageSyncState>({
    songIndex: 0,
    scrollTop: 0,
    transpose: 0,
    isPlaying: false,
  });
  const upsertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

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

  // ── Master: upsert state to broadcast_sessions (debounced) ──
  const upsertBroadcastState = useCallback(
    (state: Partial<StageSyncState>) => {
      if (!user || !setlistId || !sessionIdRef.current) return;

      // Merge into ref
      masterStateRef.current = { ...masterStateRef.current, ...state };

      // Debounce DB writes
      if (upsertTimerRef.current) clearTimeout(upsertTimerRef.current);
      upsertTimerRef.current = setTimeout(async () => {
        const s = masterStateRef.current;
        await supabase.from("broadcast_sessions" as any).upsert(
          {
            id: sessionIdRef.current!,
            master_id: user.id,
            setlist_id: setlistId,
            current_song_index: s.songIndex,
            scroll_top: s.scrollTop,
            transpose: s.transpose,
            is_playing: s.isPlaying,
            speed: s.speed ?? null,
            master_name: s.masterName ?? null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "id" } as any
        );
      }, DEBOUNCE_MS);
    },
    [user, setlistId]
  );

  // ── Master: broadcast sync_state to all viewers via channel ──
  const broadcastSyncState = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.send({
      type: "broadcast",
      event: "sync_state",
      payload: masterStateRef.current,
    });
  }, []);

  // Join channel
  useEffect(() => {
    if (!setlistId || !user) return;

    const channelName = `stage-sync-${setlistId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("broadcast", { event: "stage-command" }, ({ payload }: { payload: StageSyncPayload }) => {
        if (isMaster) return;
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
      // ── Master listens for viewer_joined to push current state ──
      .on("broadcast", { event: "viewer_joined" }, () => {
        if (isMaster) {
          broadcastSyncState();
        }
      })
      // ── Viewer listens for sync_state from master ──
      .on("broadcast", { event: "sync_state" }, ({ payload }: { payload: StageSyncState }) => {
        if (isMaster) return;
        if (!isFollowing) return;
        // Apply the full state
        if (payload.songIndex !== undefined) onSongChange?.(payload.songIndex);
        if (payload.scrollTop !== undefined) onScroll?.(payload.scrollTop);
        if (payload.transpose !== undefined) onTranspose?.(payload.transpose);
        if (payload.isPlaying) {
          onPlay?.(payload.speed);
        } else {
          onPause?.();
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

          // If viewer is following, announce arrival and fetch initial state from DB
          if (isFollowing && sessionIdRef.current) {
            channel.send({
              type: "broadcast",
              event: "viewer_joined",
              payload: { viewerId: user.id },
            });
          }
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [setlistId, user, isMaster, isFollowing, onSongChange, onScroll, onPlay, onPause, onTranspose, broadcastSyncState]);

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

      await supabase
        .from("sync_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("token", inviteToken);

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

  // ── Viewer: fetch initial state from broadcast_sessions on follow start ──
  useEffect(() => {
    if (!isFollowing || !setlistId || isMaster) return;

    (async () => {
      // Try to find an active broadcast session for this setlist
      const { data } = await supabase
        .from("broadcast_sessions" as any)
        .select("*")
        .eq("setlist_id", setlistId)
        .order("updated_at", { ascending: false })
        .limit(1) as any;

      if (data && data.length > 0) {
        const session = data[0];
        sessionIdRef.current = session.id;
        // Apply initial state
        if (session.current_song_index !== undefined) onSongChange?.(session.current_song_index);
        if (session.scroll_top !== undefined) onScroll?.(Number(session.scroll_top));
        if (session.transpose !== undefined) onTranspose?.(session.transpose);
        if (session.is_playing) {
          onPlay?.(session.speed ? Number(session.speed) : undefined);
        }

        // Announce arrival to get live state from master
        channelRef.current?.send({
          type: "broadcast",
          event: "viewer_joined",
          payload: { viewerId: user?.id },
        });
      }
    })();
  }, [isFollowing, setlistId, isMaster]);

  // Start master broadcast
  const startMaster = useCallback(async () => {
    if (!channelRef.current || !user || !setlistId) return;
    const name = await getUserName();
    const sid = `${setlistId}-${user.id}`;
    sessionIdRef.current = sid;
    setIsMaster(true);
    setIsFollowing(false);
    setMasterName(name);

    // Set initial master state
    masterStateRef.current = {
      songIndex: 0,
      scrollTop: 0,
      transpose: 0,
      isPlaying: false,
      masterName: name,
    };

    // Upsert initial state to DB
    upsertBroadcastState({ masterName: name });

    channelRef.current.send({
      type: "broadcast",
      event: "master-start",
      payload: { masterName: name, masterId: user.id },
    });
  }, [user, getUserName, setlistId, upsertBroadcastState]);

  // Stop master broadcast
  const stopMaster = useCallback(async () => {
    if (!channelRef.current) return;
    setIsMaster(false);
    setMasterName(null);
    channelRef.current.send({
      type: "broadcast",
      event: "master-stop",
      payload: {},
    });

    // Clean up DB session
    if (sessionIdRef.current) {
      await supabase
        .from("broadcast_sessions" as any)
        .delete()
        .eq("id", sessionIdRef.current);
      sessionIdRef.current = null;
    }
  }, []);

  // Send command as master (also persists state + broadcasts sync)
  const sendCommand = useCallback(
    (payload: StageSyncPayload) => {
      if (!channelRef.current || !isMaster) return;

      // Send the granular command
      channelRef.current.send({
        type: "broadcast",
        event: "stage-command",
        payload,
      });

      // Update master state ref + persist to DB
      const stateUpdate: Partial<StageSyncState> = {};
      switch (payload.type) {
        case "song_change":
          stateUpdate.songIndex = payload.songIndex ?? 0;
          break;
        case "scroll":
          stateUpdate.scrollTop = payload.scrollTop ?? 0;
          break;
        case "play":
          stateUpdate.isPlaying = true;
          stateUpdate.speed = payload.speed;
          break;
        case "pause":
          stateUpdate.isPlaying = false;
          break;
        case "transpose":
          stateUpdate.transpose = payload.transpose ?? 0;
          break;
      }
      upsertBroadcastState(stateUpdate);
      // Also broadcast full sync_state for any viewer that joined mid-stream
      broadcastSyncState();
    },
    [isMaster, upsertBroadcastState, broadcastSyncState]
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

  // Cleanup upsert timer on unmount
  useEffect(() => {
    return () => {
      if (upsertTimerRef.current) clearTimeout(upsertTimerRef.current);
    };
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
