import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, UserPlus, Users, Video, VideoOff, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import { normalizeImageUrl, useImageFallback } from "../lib/image";

const MAX_GROUP_CALL_PARTICIPANTS = 4;

const VideoTile = ({ label, profilePic, stream, muted = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div className="relative h-[28dvh] min-h-40 overflow-hidden rounded-xl bg-base-300 sm:h-72">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted={muted}
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <img
            src={normalizeImageUrl(profilePic)}
            alt={label}
            className="size-20 rounded-full object-cover"
            onError={useImageFallback}
          />
          <span className="text-sm text-base-content/70">Connecting...</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
        {label}
      </span>
    </div>
  );
};

const RemoteAudio = ({ stream }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = stream || null;
  }, [stream]);

  return <audio ref={audioRef} autoPlay />;
};

const CallModal = () => {
  const { authUser, onlineUsers, socket } = useAuthStore();
  const { users } = useChatStore();
  const {
    callStatus,
    callType,
    peerUser,
    participants,
    localStream,
    remoteStreams,
    isMuted,
    isCameraOff,
    acceptCall,
    rejectCall,
    endCall,
    switchCallToFriend,
    toggleMute,
    toggleCamera,
    subscribeToCallEvents,
    unsubscribeFromCallEvents,
  } = useCallStore();
  const [isAddCallOpen, setIsAddCallOpen] = useState(false);

  useEffect(() => {
    subscribeToCallEvents();
    return () => unsubscribeFromCallEvents();
  }, [socket, subscribeToCallEvents, unsubscribeFromCallEvents]);

  useEffect(() => {
    if (callStatus === "idle") setIsAddCallOpen(false);
  }, [callStatus]);

  const isRinging = callStatus === "ringing";
  const isCalling = callStatus === "calling";
  const isInCall = callStatus === "in-call";
  const participantIds = useMemo(
    () => new Set(participants.map((participant) => participant._id)),
    [participants]
  );
  const remoteParticipants = participants.filter((participant) => participant._id !== authUser?._id);
  const callableFriends = users.filter((user) => !participantIds.has(user._id));
  const canAddPeople =
    !isRinging && ["calling", "connecting", "in-call"].includes(callStatus) && participants.length < MAX_GROUP_CALL_PARTICIPANTS;

  if (callStatus === "idle") return null;

  const title = isRinging
    ? `Incoming ${callType} call`
    : isCalling
      ? `Calling ${peerUser?.fullName || "user"}...`
      : `${participants.length > 2 ? "Group " : ""}${callType === "video" ? "Video" : "Voice"} call`;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden border border-base-300 bg-base-100 shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <div className="shrink-0 border-b border-base-300 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-sm text-base-content/70">
                {participants.length} of {MAX_GROUP_CALL_PARTICIPANTS} people
              </p>
            </div>
            <div className="badge badge-primary gap-1">
              <Users className="size-3.5" />
              {participants.length}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {callType === "video" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <VideoTile
                label="You"
                profilePic={authUser?.profilePic}
                stream={localStream}
                muted
              />
              {remoteParticipants.map((participant) => (
                <VideoTile
                  key={participant._id}
                  label={participant.fullName}
                  profilePic={participant.profilePic}
                  stream={remoteStreams[participant._id]}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-full flex-col items-center justify-center gap-4 rounded-xl bg-base-200 p-6">
              {remoteParticipants.map((participant) => (
                <RemoteAudio key={participant._id} stream={remoteStreams[participant._id]} />
              ))}
              <div className="flex flex-wrap justify-center gap-4">
                {participants.map((participant) => (
                  <div key={participant._id} className="flex flex-col items-center gap-2">
                    <img
                      src={normalizeImageUrl(participant.profilePic)}
                      alt={participant.fullName}
                      className="size-20 rounded-full object-cover"
                      onError={useImageFallback}
                    />
                    <span className="max-w-28 truncate text-sm font-medium">
                      {participant._id === authUser?._id ? "You" : participant.fullName}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-base-content/70">
                {isInCall ? "Connected" : isRinging ? "Incoming call" : "Connecting..."}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-base-300 bg-base-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {isAddCallOpen && canAddPeople && (
            <div className="mx-auto mb-4 max-w-md rounded-2xl border border-base-300 bg-base-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">Add call</div>
                  <div className="text-xs text-base-content/60">
                    Invite added friends, up to {MAX_GROUP_CALL_PARTICIPANTS} people
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-circle btn-xs"
                  type="button"
                  onClick={() => setIsAddCallOpen(false)}
                  aria-label="Close add call"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="max-h-44 space-y-2 overflow-y-auto">
                {callableFriends.map((user) => {
                  const isOnline = onlineUsers.includes(user._id);

                  return (
                    <button
                      key={user._id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl bg-base-100 p-2 text-left disabled:opacity-50"
                      onClick={() => {
                        switchCallToFriend(user);
                        setIsAddCallOpen(false);
                      }}
                      disabled={!isOnline}
                    >
                      <img
                        src={normalizeImageUrl(user.profilePic)}
                        alt={user.fullName}
                        className="size-9 rounded-full object-cover"
                        onError={useImageFallback}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{user.fullName}</div>
                        <div className="text-xs text-base-content/60">
                          {isOnline ? "Online" : "Offline"}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {callableFriends.length === 0 && (
                  <div className="py-3 text-center text-sm text-base-content/60">
                    No more added friends available for this call.
                  </div>
                )}
              </div>
            </div>
          )}

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
                <button
                  className="btn btn-circle"
                  onClick={() => setIsAddCallOpen((isOpen) => !isOpen)}
                  disabled={!canAddPeople}
                  aria-label="Add call"
                  title="Add call"
                >
                  <UserPlus className="size-5" />
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
