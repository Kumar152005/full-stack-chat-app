import { Phone, Video, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import { normalizeImageUrl, useImageFallback } from "../lib/image";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall, callStatus } = useCallStore();
  const isUserOnline = onlineUsers.includes(selectedUser._id);
  const isCallDisabled = !isUserOnline || callStatus !== "idle";

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img
                src={normalizeImageUrl(selectedUser.profilePic)}
                alt={selectedUser.fullName}
                onError={useImageFallback}
              />
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {isUserOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-circle btn-sm"
            onClick={() => startCall(selectedUser, "voice")}
            disabled={isCallDisabled}
            aria-label="Start voice call"
          >
            <Phone className="size-5" />
          </button>
          <button
            className="btn btn-ghost btn-circle btn-sm"
            onClick={() => startCall(selectedUser, "video")}
            disabled={isCallDisabled}
            aria-label="Start video call"
          >
            <Video className="size-5" />
          </button>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={() => setSelectedUser(null)}>
            <X className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default ChatHeader;
