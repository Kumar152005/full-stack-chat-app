import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import { normalizeImageUrl, useImageFallback } from "../lib/image";

const CallModal = () => {
  const { socket } = useAuthStore();
  const {
    callStatus,
    callType,
    peerUser,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    subscribeToCallEvents,
    unsubscribeFromCallEvents,
  } = useCallStore();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    subscribeToCallEvents();
    return () => unsubscribeFromCallEvents();
  }, [socket, subscribeToCallEvents, unsubscribeFromCallEvents]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  if (callStatus === "idle") return null;

  const isRinging = callStatus === "ringing";
  const isCalling = callStatus === "calling";
  const isInCall = callStatus === "in-call";
  const title = isRinging
    ? `Incoming ${callType} call`
    : isCalling
      ? `Calling ${peerUser?.fullName || "user"}...`
      : `${callType === "video" ? "Video" : "Voice"} call`;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border border-base-300 bg-base-100 shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <div className="shrink-0 border-b border-base-300 p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-base-content/70">{peerUser?.fullName}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {callType === "video" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative h-[30dvh] min-h-40 overflow-hidden rounded-xl bg-base-300 sm:h-80">
                {remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3">
                    <img
                      src={normalizeImageUrl(peerUser?.profilePic)}
                      alt={peerUser?.fullName || "Caller"}
                      className="size-20 rounded-full object-cover"
                      onError={useImageFallback}
                    />
                    <span className="text-sm text-base-content/70">
                      {isRinging ? "Waiting for you to answer" : "Connecting..."}
                    </span>
                  </div>
                )}
                <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
                  {peerUser?.fullName || "Remote"}
                </span>
              </div>

              <div className="relative h-[30dvh] min-h-40 overflow-hidden rounded-xl bg-base-300 sm:h-80">
                {localStream ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-base-content/70">
                    Your camera preview will appear here
                  </div>
                )}
                <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
                  You
                </span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-full flex-col items-center justify-center gap-4 rounded-xl bg-base-200 p-6">
              <audio ref={remoteAudioRef} autoPlay />
              <img
                src={normalizeImageUrl(peerUser?.profilePic)}
                alt={peerUser?.fullName || "Caller"}
                className="size-24 rounded-full object-cover"
                onError={useImageFallback}
              />
              <div className="text-center">
                <h3 className="text-xl font-semibold">{peerUser?.fullName}</h3>
                <p className="text-sm text-base-content/70">
                  {isInCall ? "Connected" : isRinging ? "Incoming call" : "Calling..."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-base-300 bg-base-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-center gap-3">
          {isRinging ? (
            <>
              <button className="btn btn-error btn-circle" onClick={rejectCall} aria-label="Reject call">
                <PhoneOff className="size-5" />
              </button>
              <button className="btn btn-success btn-circle" onClick={acceptCall} aria-label="Accept call">
                <Phone className="size-5" />
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-circle" onClick={toggleMute} aria-label="Toggle microphone">
                {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>
              {callType === "video" && (
                <button className="btn btn-circle" onClick={toggleCamera} aria-label="Toggle camera">
                  {isCameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                </button>
              )}
              <button className="btn btn-error btn-circle" onClick={endCall} aria-label="End call">
                <PhoneOff className="size-5" />
              </button>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallModal;
