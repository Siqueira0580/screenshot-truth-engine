import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseScreenShareOptions {
  sessionId: string | null;
  isMaster: boolean;
}

interface SignalPayload {
  type: "offer" | "answer" | "ice-candidate";
  data: any;
  senderId: string;
}

export function useScreenShare({ sessionId, isMaster }: UseScreenShareOptions) {
  const [isSharing, setIsSharing] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myIdRef = useRef(crypto.randomUUID());

  const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const createPeerConnection = useCallback(
    (peerId: string, channel: ReturnType<typeof supabase.channel>) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "ice-candidate",
              data: event.candidate.toJSON(),
              senderId: myIdRef.current,
              targetId: peerId,
            },
          });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0] || null);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          peerConnectionsRef.current.delete(peerId);
          pc.close();
          setViewerCount(peerConnectionsRef.current.size);
        }
      };

      peerConnectionsRef.current.set(peerId, pc);
      setViewerCount(peerConnectionsRef.current.size);
      return pc;
    },
    []
  );

  // Master: start screen share
  const startScreenShare = useCallback(async () => {
    if (!sessionId) return;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      });

      localStreamRef.current = stream;
      setIsSharing(true);

      // Handle user stopping share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // Join channel
      const channelName = `screen-share-${sessionId}`;
      const channel = supabase.channel(channelName);

      channel
        .on("broadcast", { event: "signal" }, async ({ payload }: { payload: any }) => {
          if (payload.targetId && payload.targetId !== myIdRef.current) return;

          if (payload.type === "viewer-join") {
            // New viewer joined, create offer
            const pc = createPeerConnection(payload.senderId, channel);
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            channel.send({
              type: "broadcast",
              event: "signal",
              payload: {
                type: "offer",
                data: offer,
                senderId: myIdRef.current,
                targetId: payload.senderId,
              },
            });
          } else if (payload.type === "answer") {
            const pc = peerConnectionsRef.current.get(payload.senderId);
            if (pc && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
            }
          } else if (payload.type === "ice-candidate") {
            const pc = peerConnectionsRef.current.get(payload.senderId);
            if (pc) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.data));
              } catch (e) {
                console.warn("ICE candidate error:", e);
              }
            }
          }
        })
        .subscribe();

      channelRef.current = channel;
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Partilha de ecrã cancelada pelo utilizador.");
      } else {
        setError("Erro ao iniciar partilha de ecrã.");
        console.error("Screen share error:", err);
      }
      setIsSharing(false);
    }
  }, [sessionId, createPeerConnection]);

  // Master: stop screen share
  const stopScreenShare = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    channelRef.current?.unsubscribe();
    channelRef.current = null;

    setIsSharing(false);
    setViewerCount(0);
  }, []);

  // Viewer: connect to master
  const connectAsViewer = useCallback(async () => {
    if (!sessionId) return;
    setError(null);

    const channelName = `screen-share-${sessionId}`;
    const channel = supabase.channel(channelName);

    channel
      .on("broadcast", { event: "signal" }, async ({ payload }: { payload: any }) => {
        if (payload.targetId && payload.targetId !== myIdRef.current) return;

        if (payload.type === "offer") {
          const pc = createPeerConnection(payload.senderId, channel);

          await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channel.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "answer",
              data: answer,
              senderId: myIdRef.current,
              targetId: payload.senderId,
            },
          });
        } else if (payload.type === "ice-candidate") {
          const pc = peerConnectionsRef.current.get(payload.senderId);
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.data));
            } catch (e) {
              console.warn("ICE candidate error:", e);
            }
          }
        }
      })
      .subscribe(() => {
        // Announce presence to master
        channel.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "viewer-join",
            senderId: myIdRef.current,
          },
        });
      });

    channelRef.current = channel;
  }, [sessionId, createPeerConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      channelRef.current?.unsubscribe();
    };
  }, []);

  return {
    isSharing,
    remoteStream,
    viewerCount,
    error,
    startScreenShare,
    stopScreenShare,
    connectAsViewer,
  };
}
