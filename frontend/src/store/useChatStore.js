import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

const getErrorMessage = (error) =>
  error.response?.data?.message || "Unable to connect to the server";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  searchedUser: null,
  unreadCounts: {},
  typingUserIds: [],
  statuses: [],
  isStatusesLoading: false,
  notificationPermission:
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSearchingUser: false,
  isAddingFriend: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
      await get().markMessagesSeen(userId);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  getStatuses: async () => {
    set({ isStatusesLoading: true });
    try {
      const res = await axiosInstance.get("/statuses");
      set({ statuses: res.data });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isStatusesLoading: false });
    }
  },

  createStatus: async (statusData) => {
    try {
      const res = await axiosInstance.post("/statuses", statusData);
      set({ statuses: [res.data, ...get().statuses] });
      toast.success("Status posted");
    } catch (error) {
      toast.error(getErrorMessage(error));
      throw error;
    }
  },

  searchUserByEmail: async (email) => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("Enter an email address");
      return;
    }

    set({ isSearchingUser: true, searchedUser: null });
    try {
      const res = await axiosInstance.get("/messages/users/search", {
        params: { email: normalizedEmail },
      });
      set({ searchedUser: res.data });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isSearchingUser: false });
    }
  },

  addFriend: async (user) => {
    set({ isAddingFriend: true });
    try {
      const res = await axiosInstance.post(`/messages/users/${user._id}/add`);
      const addedFriend = res.data;
      const users = get().users;
      const alreadyAdded = users.some((existingUser) => existingUser._id === addedFriend._id);

      set({
        users: alreadyAdded ? users : [addedFriend, ...users],
        searchedUser: { ...user, isFriend: true },
        selectedUser: addedFriend,
      });
      toast.success(`${addedFriend.fullName} added`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isAddingFriend: false });
    }
  },

  clearSearchedUser: () => set({ searchedUser: null }),

  clearUnreadCount: (userId) => {
    const unreadCounts = { ...get().unreadCounts };
    delete unreadCounts[userId];
    set({ unreadCounts });
  },

  requestNotificationPermission: async () => {
    if (typeof Notification === "undefined") {
      toast.error("This browser does not support notifications");
      set({ notificationPermission: "unsupported" });
      return;
    }

    const permission = await Notification.requestPermission();
    set({ notificationPermission: permission });
    if (permission === "granted") toast.success("Notifications enabled");
  },

  notifyIncomingMessage: (message) => {
    const { notificationPermission, users } = get();
    if (notificationPermission !== "granted" || document.visibilityState === "visible") return;

    const sender = users.find((user) => String(user._id) === String(message.senderId));
    if (!sender) return;

    new Notification(sender.fullName, {
      body: message.deletedForEveryone
        ? "Message deleted"
        : message.text || message.attachment?.name || "New message",
      icon: sender.profilePic || "/vite.svg",
    });
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(getErrorMessage(error));
      throw error;
    }
  },

  markMessagesSeen: async (userId) => {
    try {
      await axiosInstance.put(`/messages/${userId}/seen`);
      set({
        messages: get().messages.map((message) =>
          String(message.senderId) === String(userId)
            ? { ...message, status: "seen" }
            : message
        ),
      });
    } catch (error) {
      console.error("Failed to mark messages seen:", error);
    }
  },

  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.put(`/messages/${messageId}/react`, { emoji });
      set({
        messages: get().messages.map((message) =>
          message._id === messageId ? res.data : message
        ),
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  },

  deleteMessageForEveryone: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/${messageId}`);
      set({
        messages: get().messages.map((message) =>
          message._id === messageId ? res.data : message
        ),
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  },

  togglePinChat: async (userId) => {
    try {
      const res = await axiosInstance.post(`/messages/users/${userId}/pin`);
      const isPinned = res.data.isPinned;
      set({
        users: get()
          .users.map((user) => (user._id === userId ? { ...user, isPinned } : user))
          .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned))),
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  },

  startTyping: () => {
    const { selectedUser } = get();
    const { authUser, socket } = useAuthStore.getState();
    if (!selectedUser || !authUser || !socket) return;
    socket.emit("typing:start", { to: selectedUser._id, from: authUser._id });
  },

  stopTyping: () => {
    const { selectedUser } = get();
    const { authUser, socket } = useAuthStore.getState();
    if (!selectedUser || !authUser || !socket) return;
    socket.emit("typing:stop", { to: selectedUser._id, from: authUser._id });
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    socket.on("newMessage", (newMessage) => {
      const { messages, selectedUser, unreadCounts, users } = get();
      const isMessageSentFromSelectedUser =
        selectedUser && String(newMessage.senderId) === String(selectedUser._id);

      if (isMessageSentFromSelectedUser) {
        set({
          messages: messages.some((message) => message._id === newMessage._id)
            ? messages
            : [...messages, newMessage],
        });
        get().markMessagesSeen(newMessage.senderId);
        return;
      }

      const senderId = String(newMessage.senderId);
      const isKnownFriend = users.some((user) => String(user._id) === senderId);
      if (!isKnownFriend) return;

      set({
        unreadCounts: {
          ...unreadCounts,
          [senderId]: (unreadCounts[senderId] || 0) + 1,
        },
      });
      get().notifyIncomingMessage(newMessage);
    });

    socket.off("messagesSeen");
    socket.on("messagesSeen", ({ by }) => {
      set({
        messages: get().messages.map((message) =>
          String(message.receiverId) === String(by) ? { ...message, status: "seen" } : message
        ),
      });
    });

    socket.off("messageStatus");
    socket.on("messageStatus", ({ messageId, status }) => {
      set({
        messages: get().messages.map((message) =>
          message._id === messageId ? { ...message, status } : message
        ),
      });
    });

    socket.off("messageReaction");
    socket.on("messageReaction", ({ messageId, reactions }) => {
      set({
        messages: get().messages.map((message) =>
          message._id === messageId ? { ...message, reactions } : message
        ),
      });
    });

    socket.off("messageDeleted");
    socket.on("messageDeleted", ({ messageId }) => {
      set({
        messages: get().messages.map((message) =>
          message._id === messageId
            ? { ...message, deletedForEveryone: true, text: "", image: "", attachment: null }
            : message
        ),
      });
    });

    socket.off("typing:start");
    socket.on("typing:start", ({ from }) => {
      const typingUserIds = get().typingUserIds;
      if (!typingUserIds.includes(from)) set({ typingUserIds: [...typingUserIds, from] });
    });

    socket.off("typing:stop");
    socket.on("typing:stop", ({ from }) => {
      set({ typingUserIds: get().typingUserIds.filter((userId) => userId !== from) });
    });

    socket.off("newStatus");
    socket.on("newStatus", (status) => {
      set({ statuses: [status, ...get().statuses] });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off("newMessage");
    socket?.off("messagesSeen");
    socket?.off("messageStatus");
    socket?.off("messageReaction");
    socket?.off("messageDeleted");
    socket?.off("typing:start");
    socket?.off("typing:stop");
    socket?.off("newStatus");
  },

  setSelectedUser: (selectedUser) => {
    if (selectedUser?._id) {
      get().clearUnreadCount(selectedUser._id);
    }
    set({ selectedUser });
  },
}));
