import { useEffect, useRef, useState } from "react";
import { Bell, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { normalizeImageUrl, useImageFallback } from "../lib/image";

const StatusTray = () => {
  const {
    createStatus,
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
    await createStatus({ text, image });
    setText("");
    setImage(null);
    setIsComposerOpen(false);
  };

  return (
    <div className="border-b border-base-300 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Status</span>
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
            aria-label="Create status"
          >
            {isComposerOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          </button>
        </div>
      </div>

      {isComposerOpen && (
        <form className="mb-3 rounded-xl bg-base-200 p-3" onSubmit={handleCreateStatus}>
          <textarea
            className="textarea textarea-sm mb-2 w-full"
            placeholder="Share a status..."
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
          <div className="flex justify-between gap-2">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
            </button>
            <button className="btn btn-primary btn-sm" type="submit" disabled={!text.trim() && !image}>
              Post
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
              alt="Your status"
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
            </button>
          );
        })}
      </div>

      {activeStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-base-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-medium">{activeStatus.userId.fullName}</div>
              <button className="btn btn-ghost btn-circle btn-sm" onClick={() => setActiveStatus(null)}>
                <X className="size-5" />
              </button>
            </div>
            {activeStatus.image && (
              <img src={activeStatus.image} alt="Status" className="mb-3 max-h-[70dvh] w-full rounded-xl object-contain" />
            )}
            {activeStatus.text && <p className="whitespace-pre-wrap">{activeStatus.text}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusTray;
