import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

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

export const useCallStore = create((set, get) => ({
  callStatus: "idle",
  callType: null,
  peerUser: null,
  localStream: null,
  remoteStream: null,
  incomingOffer: null,
  peerConnection: null,
  pendingIceCandidates: [],
  isMuted: false,
  isCameraOff: false,

  cleanupCall: () => {
    const { peerConnection, localStream, remoteStream } = get();

    peerConnection?.close();
    stopStream(localStream);
    stopStream(remoteStream);

    set({
      callStatus: "idle",
      callType: null,
      peerUser: null,
      localStream: null,
      remoteStream: null,
      incomingOffer: null,
      peerConnection: null,
      pendingIceCandidates: [],
      isMuted: false,
      isCameraOff: false,
    });
  },

  createPeerConnection: (peerId) => {
    const peerConnection = new RTCPeerConnection({ iceServers });
    const { socket, authUser } = useAuthStore.getState();

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;

      socket?.emit("call:ice-candidate", {
        to: peerId,
        from: authUser?._id,
        candidate: event.candidate,
      });
    };

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) set({ remoteStream });
    };

    peerConnection.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(peerConnection.connectionState)) {
        get().cleanupCall();
      }
    };

    set({ peerConnection });
    return peerConnection;
  },

  flushIceCandidates: async () => {
    const { peerConnection, pendingIceCandidates } = get();
    if (!peerConnection?.remoteDescription) return;

    for (const candidate of pendingIceCandidates) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }

    set({ pendingIceCandidates: [] });
  },

  startCall: async (receiver, type) => {
    const { authUser, onlineUsers, socket } = useAuthStore.getState();
    const { callStatus } = get();

    if (!authUser || !socket || callStatus !== "idle") return;
    if (!onlineUsers.includes(receiver._id)) {
      toast.error(`${receiver.fullName} is offline`);
      return;
    }

    set({
      callStatus: "calling",
      callType: type,
      peerUser: receiver,
    });

    try {
      const localStream = await getMediaStream(type);
      const peerConnection = get().createPeerConnection(receiver._id);

      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      set({ localStream });

      socket.emit("call:offer", {
        to: receiver._id,
        from: authUser._id,
        caller: {
          _id: authUser._id,
          fullName: authUser.fullName,
          profilePic: authUser.profilePic,
        },
        type,
        offer,
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
    const { incomingOffer, callType, peerUser } = get();

    if (!socket || !authUser || !incomingOffer || !peerUser) return;

    try {
      set({ callStatus: "connecting" });
      const localStream = await getMediaStream(callType);
      const peerConnection = get().createPeerConnection(peerUser._id);

      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
      await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      await get().flushIceCandidates();

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      set({
        callStatus: "in-call",
        localStream,
        incomingOffer: null,
      });

      socket.emit("call:answer", {
        to: peerUser._id,
        from: authUser._id,
        answer,
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
    const { peerUser } = get();

    if (peerUser) {
      socket?.emit("call:reject", {
        to: peerUser._id,
        from: authUser?._id,
      });
    }

    get().cleanupCall();
  },

  endCall: () => {
    const { socket, authUser } = useAuthStore.getState();
    const { peerUser } = get();

    if (peerUser) {
      socket?.emit("call:end", {
        to: peerUser._id,
        from: authUser?._id,
      });
    }

    get().cleanupCall();
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

    socket.off("call:offer");
    socket.off("call:answer");
    socket.off("call:ice-candidate");
    socket.off("call:reject");
    socket.off("call:busy");
    socket.off("call:end");
    socket.off("call:unavailable");

    socket.on("call:offer", ({ from, caller, type, offer }) => {
      const { callStatus } = get();

      if (callStatus !== "idle") {
        socket.emit("call:busy", { to: from, from: authUser._id });
        return;
      }

      set({
        callStatus: "ringing",
        callType: type,
        peerUser: caller,
        incomingOffer: offer,
      });
    });

    socket.on("call:answer", async ({ answer }) => {
      const { peerConnection } = get();
      if (!peerConnection) return;

      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      await get().flushIceCandidates();
      set({ callStatus: "in-call" });
    });

    socket.on("call:ice-candidate", async ({ candidate }) => {
      const { peerConnection, pendingIceCandidates } = get();
      if (!candidate) return;

      if (!peerConnection?.remoteDescription) {
        set({ pendingIceCandidates: [...pendingIceCandidates, candidate] });
        return;
      }

      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("call:reject", () => {
      toast.error("Call rejected");
      get().cleanupCall();
    });

    socket.on("call:busy", () => {
      toast.error("User is busy on another call");
      get().cleanupCall();
    });

    socket.on("call:end", () => {
      toast("Call ended");
      get().cleanupCall();
    });

    socket.on("call:unavailable", () => {
      toast.error("User is not available for a call");
      get().cleanupCall();
    });
  },

  unsubscribeFromCallEvents: () => {
    const { socket } = useAuthStore.getState();
    socket?.off("call:offer");
    socket?.off("call:answer");
    socket?.off("call:ice-candidate");
    socket?.off("call:reject");
    socket?.off("call:busy");
    socket?.off("call:end");
    socket?.off("call:unavailable");
  },
}));
