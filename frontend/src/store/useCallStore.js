import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

const MAX_GROUP_CALL_PARTICIPANTS = 4;

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const getMediaStream = (type) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("MEDIA_DEVICES_UNAVAILABLE");
  }

  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === "video",
  });
};

const stopStream = (stream) => {
  stream?.getTracks().forEach((track) => track.stop());
};

const getCallerProfile = (authUser) => ({
  _id: authUser._id,
  fullName: authUser.fullName,
  profilePic: authUser.profilePic,
});

const uniqueParticipants = (participants) => {
  const seen = new Set();
  return participants.filter((participant) => {
    if (!participant?._id || seen.has(participant._id)) return false;
    seen.add(participant._id);
    return true;
  });
};

export const useCallStore = create((set, get) => ({
  callStatus: "idle",
  callType: null,
  roomId: null,
  peerUser: null,
  participants: [],
  localStream: null,
  remoteStreams: {},
  incomingRoom: null,
  peerConnections: {},
  pendingIceCandidates: {},
  isMuted: false,
  isCameraOff: false,

  cleanupCall: () => {
    const { peerConnections, localStream, remoteStreams } = get();

    Object.values(peerConnections).forEach((peerConnection) => peerConnection?.close());
    stopStream(localStream);
    Object.values(remoteStreams).forEach(stopStream);

    set({
      callStatus: "idle",
      callType: null,
      roomId: null,
      peerUser: null,
      participants: [],
      localStream: null,
      remoteStreams: {},
      incomingRoom: null,
      peerConnections: {},
      pendingIceCandidates: {},
      isMuted: false,
      isCameraOff: false,
    });
  },

  removePeer: (participantId) => {
    const { peerConnections, remoteStreams, participants, pendingIceCandidates } = get();
    peerConnections[participantId]?.close();
    stopStream(remoteStreams[participantId]);

    const nextPeerConnections = { ...peerConnections };
    const nextRemoteStreams = { ...remoteStreams };
    const nextPendingIceCandidates = { ...pendingIceCandidates };
    delete nextPeerConnections[participantId];
    delete nextRemoteStreams[participantId];
    delete nextPendingIceCandidates[participantId];

    set({
      peerConnections: nextPeerConnections,
      remoteStreams: nextRemoteStreams,
      pendingIceCandidates: nextPendingIceCandidates,
      participants: participants.filter((participant) => participant._id !== participantId),
    });
  },

  createPeerConnection: (participantId) => {
    const existingConnection = get().peerConnections[participantId];
    if (existingConnection) return existingConnection;

    const peerConnection = new RTCPeerConnection({ iceServers });
    const { socket, authUser } = useAuthStore.getState();

    peerConnection.onicecandidate = (event) => {
      const { roomId } = get();
      if (!event.candidate || !roomId) return;

      socket?.emit("group-call:ice-candidate", {
        roomId,
        to: participantId,
        from: authUser?._id,
        candidate: event.candidate,
      });
    };

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;

      set({
        remoteStreams: {
          ...get().remoteStreams,
          [participantId]: remoteStream,
        },
      });
    };

    peerConnection.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(peerConnection.connectionState)) {
        get().removePeer(participantId);
      }
    };

    set({
      peerConnections: {
        ...get().peerConnections,
        [participantId]: peerConnection,
      },
    });

    return peerConnection;
  },

  addLocalTracks: (peerConnection, localStream) => {
    const existingTrackIds = new Set(
      peerConnection.getSenders().map((sender) => sender.track?.id).filter(Boolean)
    );

    localStream.getTracks().forEach((track) => {
      if (!existingTrackIds.has(track.id)) {
        peerConnection.addTrack(track, localStream);
      }
    });
  },

  flushIceCandidates: async (participantId) => {
    const { peerConnections, pendingIceCandidates } = get();
    const peerConnection = peerConnections[participantId];
    if (!peerConnection?.remoteDescription) return;

    const candidates = pendingIceCandidates[participantId] || [];
    for (const candidate of candidates) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }

    set({
      pendingIceCandidates: {
        ...get().pendingIceCandidates,
        [participantId]: [],
      },
    });
  },

  createOfferForParticipant: async (participant) => {
    const { authUser, socket } = useAuthStore.getState();
    const { localStream, roomId } = get();
    if (!authUser || !socket || !localStream || !roomId || participant._id === authUser._id) return;

    const peerConnection = get().createPeerConnection(participant._id);
    get().addLocalTracks(peerConnection, localStream);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("group-call:offer", {
      roomId,
      to: participant._id,
      from: authUser._id,
      offer,
    });
  },

  startCall: async (receiver, type) => {
    const { authUser, onlineUsers, socket } = useAuthStore.getState();
    const { callStatus } = get();

    if (!authUser || !socket || callStatus !== "idle") return;
    if (!onlineUsers.includes(receiver._id)) {
      toast.error(`${receiver.fullName} is offline`);
      return;
    }

    const roomId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${authUser._id}-${Date.now()}`;
    const caller = getCallerProfile(authUser);

    set({
      callStatus: "calling",
      callType: type,
      roomId,
      peerUser: receiver,
      participants: [caller],
    });

    try {
      const localStream = await getMediaStream(type);
      set({ localStream });

      socket.emit("group-call:create", {
        roomId,
        from: authUser._id,
        caller,
        type,
        inviteeIds: [receiver._id],
      });
    } catch (error) {
      console.error("Error starting call:", error);
      toast.error(
        error.message === "MEDIA_DEVICES_UNAVAILABLE"
          ? "This browser does not support voice/video calls."
          : "Unable to start call. Please allow microphone/camera access."
      );
      get().cleanupCall();
    }
  },

  acceptCall: async () => {
    const { socket, authUser } = useAuthStore.getState();
    const { incomingRoom } = get();

    if (!socket || !authUser || !incomingRoom) return;

    try {
      set({
        callStatus: "connecting",
        roomId: incomingRoom.roomId,
        callType: incomingRoom.type,
        peerUser: incomingRoom.caller,
        participants: uniqueParticipants([
          ...(incomingRoom.participants || []),
          getCallerProfile(authUser),
        ]),
      });

      const localStream = await getMediaStream(incomingRoom.type);
      set({ localStream, incomingRoom: null });

      socket.emit("group-call:accept", {
        roomId: incomingRoom.roomId,
        from: authUser._id,
        participant: getCallerProfile(authUser),
      });
    } catch (error) {
      console.error("Error accepting call:", error);
      toast.error(
        error.message === "MEDIA_DEVICES_UNAVAILABLE"
          ? "This browser does not support voice/video calls."
          : "Unable to answer call. Please allow microphone/camera access."
      );
      get().endCall();
    }
  },

  rejectCall: () => {
    const { socket, authUser } = useAuthStore.getState();
    const { incomingRoom, peerUser } = get();

    if (incomingRoom) {
      socket?.emit("group-call:reject", {
        roomId: incomingRoom.roomId,
        from: authUser?._id,
        to: incomingRoom.from,
      });
    } else if (peerUser) {
      socket?.emit("group-call:leave", {
        roomId: get().roomId,
        from: authUser?._id,
      });
    }

    get().cleanupCall();
  },

  endCall: () => {
    const { socket, authUser } = useAuthStore.getState();
    const { roomId } = get();

    if (roomId) {
      socket?.emit("group-call:end", {
        roomId,
        from: authUser?._id,
      });
    }

    get().cleanupCall();
  },

  switchCallToFriend: (receiver) => {
    const { authUser, onlineUsers, socket } = useAuthStore.getState();
    const { roomId, participants, callStatus } = get();

    if (!authUser || !socket || !receiver?._id || !roomId) return;
    if (!["calling", "connecting", "in-call"].includes(callStatus)) return;
    if (participants.some((participant) => participant._id === receiver._id)) {
      toast(`${receiver.fullName} is already in this call`);
      return;
    }
    if (participants.length >= MAX_GROUP_CALL_PARTICIPANTS) {
      toast.error("Group calls are limited to 4 people");
      return;
    }
    if (!onlineUsers.includes(receiver._id)) {
      toast.error(`${receiver.fullName} is offline`);
      return;
    }

    socket.emit("group-call:invite", {
      roomId,
      from: authUser._id,
      invitee: receiver,
      participants,
    });
    toast.success(`Invited ${receiver.fullName}`);
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = isMuted;
    });
    set({ isMuted: !isMuted });
  },

  toggleCamera: () => {
    const { localStream, isCameraOff } = get();
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = isCameraOff;
    });
    set({ isCameraOff: !isCameraOff });
  },

  subscribeToCallEvents: () => {
    const { socket, authUser } = useAuthStore.getState();
    if (!socket || !authUser) return;

    [
      "group-call:created",
      "group-call:invite",
      "group-call:accepted",
      "group-call:participant-joined",
      "group-call:participant-left",
      "group-call:offer",
      "group-call:answer",
      "group-call:ice-candidate",
      "group-call:rejected",
      "group-call:room-full",
      "group-call:ended",
      "call:unavailable",
    ].forEach((event) => socket.off(event));

    socket.on("group-call:created", ({ participants }) => {
      set({ participants: uniqueParticipants(participants || get().participants) });
    });

    socket.on("group-call:invite", ({ roomId, from, caller, type, participants }) => {
      const { callStatus } = get();

      if (callStatus !== "idle") {
        socket.emit("group-call:reject", { roomId, from: authUser._id, to: from });
        return;
      }

      set({
        callStatus: "ringing",
        callType: type,
        roomId,
        peerUser: caller,
        incomingRoom: { roomId, from, caller, type, participants },
        participants: uniqueParticipants(participants || [caller]),
      });
    });

    socket.on("group-call:accepted", ({ participants }) => {
      set({
        callStatus: "in-call",
        participants: uniqueParticipants(participants || get().participants),
      });
    });

    socket.on("group-call:participant-joined", async ({ participant, participants }) => {
      set({
        callStatus: "in-call",
        participants: uniqueParticipants(participants || [...get().participants, participant]),
      });

      try {
        await get().createOfferForParticipant(participant);
      } catch (error) {
        console.error("Failed to create group call offer:", error);
      }
    });

    socket.on("group-call:participant-left", ({ participantId }) => {
      get().removePeer(participantId);
    });

    socket.on("group-call:offer", async ({ roomId, from, offer }) => {
      const { localStream } = get();
      if (roomId !== get().roomId || !localStream) return;

      try {
        const peerConnection = get().createPeerConnection(from);
        get().addLocalTracks(peerConnection, localStream);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        await get().flushIceCandidates(from);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit("group-call:answer", {
          roomId,
          to: from,
          from: authUser._id,
          answer,
        });

        set({ callStatus: "in-call" });
      } catch (error) {
        console.error("Failed to answer group call offer:", error);
      }
    });

    socket.on("group-call:answer", async ({ roomId, from, answer }) => {
      const peerConnection = get().peerConnections[from];
      if (roomId !== get().roomId || !peerConnection) return;

      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      await get().flushIceCandidates(from);
      set({ callStatus: "in-call" });
    });

    socket.on("group-call:ice-candidate", async ({ roomId, from, candidate }) => {
      if (roomId !== get().roomId || !candidate) return;

      const peerConnection = get().peerConnections[from];
      if (!peerConnection?.remoteDescription) {
        const pendingIceCandidates = get().pendingIceCandidates;
        set({
          pendingIceCandidates: {
            ...pendingIceCandidates,
            [from]: [...(pendingIceCandidates[from] || []), candidate],
          },
        });
        return;
      }

      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("group-call:rejected", ({ from }) => {
      toast.error(`${from ? "A user" : "User"} rejected the call`);
    });

    socket.on("group-call:room-full", () => {
      toast.error("This group call is already full");
    });

    socket.on("group-call:ended", () => {
      toast("Call ended");
      get().cleanupCall();
    });

    socket.on("call:unavailable", () => {
      toast.error("User is not available for a call");
    });
  },

  unsubscribeFromCallEvents: () => {
    const { socket } = useAuthStore.getState();
    [
      "group-call:created",
      "group-call:invite",
      "group-call:accepted",
      "group-call:participant-joined",
      "group-call:participant-left",
      "group-call:offer",
      "group-call:answer",
      "group-call:ice-candidate",
      "group-call:rejected",
      "group-call:room-full",
      "group-call:ended",
      "call:unavailable",
    ].forEach((event) => socket?.off(event));
  },
}));
