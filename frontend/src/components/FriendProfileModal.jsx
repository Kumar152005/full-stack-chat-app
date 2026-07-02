import { Mail, MessageCircle, User, X } from "lucide-react";
import { normalizeImageUrl, useImageFallback } from "../lib/image";

const FriendProfileModal = ({ user, isOnline, onClose, onMessage }) => {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-base-300 p-4">
          <h2 className="font-semibold">Profile</h2>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose} aria-label="Close profile">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="relative">
            <img
              src={normalizeImageUrl(user.profilePic)}
              alt={user.fullName}
              className="size-28 rounded-full object-cover"
              onError={useImageFallback}
            />
            <span
              className={`absolute bottom-2 right-2 size-4 rounded-full ring-4 ring-base-100 ${
                isOnline ? "bg-green-500" : "bg-zinc-500"
              }`}
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold">{user.fullName}</h3>
            <p className="text-sm text-base-content/60">{isOnline ? "Online" : "Offline"}</p>
          </div>

          <div className="w-full space-y-3 rounded-xl bg-base-200 p-4 text-left">
            <div className="flex items-center gap-3">
              <User className="size-5 text-base-content/60" />
              <span className="min-w-0 truncate">{user.fullName}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="size-5 text-base-content/60" />
              <span className="min-w-0 truncate">{user.email}</span>
            </div>
          </div>

          <button className="btn btn-primary w-full gap-2" onClick={onMessage}>
            <MessageCircle className="size-5" />
            Message
          </button>
        </div>
      </div>
    </div>
  );
};

export default FriendProfileModal;
