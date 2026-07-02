import { Phone, Video, X } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import { normalizeImageUrl, useImageFallback } from "../lib/image";
import FriendProfileModal from "./FriendProfileModal";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall, callStatus } = useCallStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isUserOnline = onlineUsers.includes(selectedUser._id);
  const isCallDisabled = !isUserOnline || callStatus !== "idle";

  return (
    <>
      <div className="p-2.5 border-b border-base-300">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex min-w-0 items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-base-200"
            onClick={() => setIsProfileOpen(true)}
          >
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
            <div className="min-w-0">
              <h3 className="truncate font-medium">{selectedUser.fullName}</h3>
              <p className="text-sm text-base-content/70">
                {isUserOnline ? "Online" : "Offline"}
              </p>
            </div>
          </button>

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

      <FriendProfileModal
        user={isProfileOpen ? selectedUser : null}
        isOnline={isUserOnline}
        onClose={() => setIsProfileOpen(false)}
        onMessage={() => setIsProfileOpen(false)}
      />
    </>
  );
};
export default ChatHeader;
