import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Loader2, Pin, PinOff, Search, UserPlus, Users, X } from "lucide-react";
import { normalizeImageUrl, useImageFallback } from "../lib/image";
import FriendProfileModal from "./FriendProfileModal";
import StatusTray from "./StatusTray";

const Sidebar = () => {
  const {
    addFriend,
    clearSearchedUser,
    getUsers,
    isAddingFriend,
    isSearchingUser,
    isUsersLoading,
    searchUserByEmail,
    searchedUser,
    selectedUser,
    setSelectedUser,
    togglePinChat,
    unreadCounts,
    users,
  } = useChatStore();

  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [searchEmail, setSearchEmail] = useState("");

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    if (!isSearchOpen) {
      setSearchEmail("");
      clearSearchedUser();
    }
  }, [clearSearchedUser, isSearchOpen]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;
  const onlineFriendsCount = users.filter((user) => onlineUsers.includes(user._id)).length;
  const totalUnreadCount = Object.values(unreadCounts).reduce((total, count) => total + count, 0);

  const handleSearchFriend = (e) => {
    e.preventDefault();
    searchUserByEmail(searchEmail);
  };

  const handleAddFriend = async (user) => {
    await addFriend(user);
    setIsSearchOpen(false);
  };

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-full lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="size-6" />
            <span className="font-medium">Contacts</span>
            {totalUnreadCount > 0 && (
              <span className="badge badge-error badge-sm text-white">
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-circle btn-sm"
            onClick={() => setIsSearchOpen((isOpen) => !isOpen)}
            aria-label={isSearchOpen ? "Close friend search" : "Search friend by email"}
            title="Search friend by email"
          >
            {isSearchOpen ? <X className="size-4" /> : <UserPlus className="size-4" />}
          </button>
        </div>

        {isSearchOpen && (
          <div className="mt-4 rounded-xl border border-base-300 bg-base-200 p-3">
            <form className="flex gap-2" onSubmit={handleSearchFriend}>
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Search by email"
                className="input input-sm flex-1"
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm btn-square"
                disabled={isSearchingUser}
                aria-label="Search"
              >
                {isSearchingUser ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
              </button>
            </form>

            {searchedUser && (
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-base-100 p-2">
                <img
                  src={normalizeImageUrl(searchedUser.profilePic)}
                  alt={searchedUser.fullName}
                  className="size-10 rounded-full object-cover"
                  onError={useImageFallback}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{searchedUser.fullName}</div>
                  <div className="truncate text-xs text-base-content/60">{searchedUser.email}</div>
                </div>
                {searchedUser.isFriend ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setSelectedUser(searchedUser);
                      setIsSearchOpen(false);
                    }}
                  >
                    Chat
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleAddFriend(searchedUser)}
                    disabled={isAddingFriend}
                  >
                    {isAddingFriend ? "Adding" : "Add"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineFriendsCount} online)</span>
        </div>
      </div>

      <StatusTray />

      <div className="overflow-y-auto w-full py-3">
        {filteredUsers.map((user) => {
          const unreadCount = unreadCounts[user._id] || 0;
          const isOnline = onlineUsers.includes(user._id);

          return (
          <div
            key={user._id}
            className={`
              w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-colors
              ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <button
              type="button"
              className="relative shrink-0"
              onClick={() => setProfileUser(user)}
              aria-label={`View ${user.fullName} profile`}
            >
              <img
                src={normalizeImageUrl(user.profilePic)}
                alt={user.fullName}
                className="size-12 object-cover rounded-full"
                onError={useImageFallback}
              />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-base-100">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              {isOnline && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
            </button>

            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setSelectedUser(user)}
            >
              <div className="flex items-center gap-1">
                {user.isPinned && <Pin className="size-3 shrink-0 text-primary" />}
                <div className="font-medium truncate">{user.fullName}</div>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm text-zinc-400">
                <span>{isOnline ? "Online" : "Offline"}</span>
                {unreadCount > 0 && (
                  <span className="font-medium text-red-500">
                    {unreadCount} new
                  </span>
                )}
              </div>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-circle btn-xs"
              onClick={() => togglePinChat(user._id)}
              aria-label={user.isPinned ? "Unpin chat" : "Pin chat"}
              title={user.isPinned ? "Unpin chat" : "Pin chat"}
            >
              {user.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </button>
          </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-zinc-500">
            {showOnlineOnly ? "No friends online" : "No friends yet. Tap + and search by email."}
          </div>
        )}
      </div>

      <FriendProfileModal
        user={profileUser}
        isOnline={profileUser ? onlineUsers.includes(profileUser._id) : false}
        onClose={() => setProfileUser(null)}
        onMessage={() => {
          setSelectedUser(profileUser);
          setProfileUser(null);
        }}
      />
    </aside>
  );
};
export default Sidebar;
