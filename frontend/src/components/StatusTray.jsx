import { useEffect, useRef, useState } from "react";
import { Bell, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { normalizeImageUrl, useImageFallback } from "../lib/image";

const StatusTray = () => {
  const {
    createStatus,
    deleteStatus,
    getStatuses,
    isStatusesLoading,
    notificationPermission,
    requestNotificationPermission,
    statuses,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [activeStatus, setActiveStatus] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getStatuses();
  }, [getStatuses]);

  const groupedStatuses = statuses.reduce((groups, status) => {
    const userId = status.userId?._id || status.userId;
    if (!groups[userId]) groups[userId] = [];
    groups[userId].push(status);
    return groups;
  }, {});
  const statusGroups = Object.values(groupedStatuses);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreateStatus = async (e) => {
    e.preventDefault();
    await createStatus({ text, image, expiresInHours });
    setText("");
    setImage(null);
    setExpiresInHours(24);
    setIsComposerOpen(false);
  };

  const handleDeleteStatus = async () => {
    if (!activeStatus?._id) return;
    await deleteStatus(activeStatus._id);
    setActiveStatus(null);
  };

  const formatExpiry = (expiresAt) => {
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return "ending soon";
    const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
    if (diffHours < 24) return `${diffHours}h left`;
    return `${Math.ceil(diffHours / 24)}d left`;
  };

  return (
    <div className="border-b border-base-300 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Aura Drops</span>
        <div className="flex gap-1">
          {notificationPermission !== "granted" && (
            <button
              type="button"
              className="btn btn-xs btn-circle"
              onClick={requestNotificationPermission}
              title="Enable notifications"
              aria-label="Enable notifications"
            >
              <Bell className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            className="btn btn-xs btn-circle"
            onClick={() => setIsComposerOpen((isOpen) => !isOpen)}
            aria-label="Create Aura Drop"
          >
            {isComposerOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          </button>
        </div>
      </div>

      {isComposerOpen && (
        <form className="mb-3 rounded-xl bg-base-200 p-3" onSubmit={handleCreateStatus}>
          <textarea
            className="textarea textarea-sm mb-2 w-full"
            placeholder="Share an Aura Drop..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {image && (
            <img src={image} alt="Status preview" className="mb-2 max-h-32 rounded-lg object-cover" />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          <select
            className="select select-sm mb-2 w-full"
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(Number(e.target.value))}
            aria-label="Aura Drop duration"
          >
            <option value={1}>Disappear after 1 hour</option>
            <option value={6}>Disappear after 6 hours</option>
            <option value={12}>Disappear after 12 hours</option>
            <option value={24}>Disappear after 24 hours</option>
            <option value={48}>Disappear after 2 days</option>
            <option value={168}>Disappear after 7 days</option>
          </select>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
            </button>
            <button className="btn btn-primary btn-sm" type="submit" disabled={!text.trim() && !image}>
              Drop
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-3 overflow-x-auto pb-1">
        <button
          type="button"
          className="flex w-14 shrink-0 flex-col items-center gap-1 text-xs"
          onClick={() => setIsComposerOpen(true)}
        >
          <div className="relative">
            <img
              src={normalizeImageUrl(authUser?.profilePic)}
              alt="Your Aura Drop"
              className="size-11 rounded-full object-cover ring-2 ring-primary"
              onError={useImageFallback}
            />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-primary p-0.5 text-primary-content">
              <Plus className="size-3" />
            </span>
          </div>
          <span className="truncate">You</span>
        </button>

        {isStatusesLoading && <Loader2 className="mt-3 size-5 animate-spin" />}
        {statusGroups.map((group) => {
          const status = group[0];
          const user = status.userId;

          return (
            <button
              key={user._id}
              type="button"
              className="flex w-14 shrink-0 flex-col items-center gap-1 text-xs"
              onClick={() => setActiveStatus(status)}
            >
              <img
                src={normalizeImageUrl(user.profilePic)}
                alt={user.fullName}
                className="size-11 rounded-full object-cover ring-2 ring-primary"
                onError={useImageFallback}
              />
              <span className="w-full truncate">{user._id === authUser?._id ? "You" : user.fullName}</span>
              <span className="w-full truncate text-[10px] opacity-60">{formatExpiry(status.expiresAt)}</span>
            </button>
          );
        })}
      </div>

      {activeStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-base-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{activeStatus.userId.fullName}</div>
                <div className="text-xs text-base-content/60">{formatExpiry(activeStatus.expiresAt)}</div>
              </div>
              <div className="flex gap-1">
                {activeStatus.userId._id === authUser?._id && (
                  <button
                    className="btn btn-ghost btn-circle btn-sm text-error"
                    onClick={handleDeleteStatus}
                    aria-label="Delete Aura Drop"
                    title="Delete Aura Drop"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                <button className="btn btn-ghost btn-circle btn-sm" onClick={() => setActiveStatus(null)}>
                  <X className="size-5" />
                </button>
              </div>
            </div>
            {activeStatus.image && (
              <img src={activeStatus.image} alt="Aura Drop" className="mb-3 max-h-[70dvh] w-full rounded-xl object-contain" />
            )}
            {activeStatus.text && <p className="whitespace-pre-wrap">{activeStatus.text}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusTray;
