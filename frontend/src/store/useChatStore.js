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
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isMessagesLoading: false });
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
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off("newMessage");
  },

  setSelectedUser: (selectedUser) => {
    if (selectedUser?._id) {
      get().clearUnreadCount(selectedUser._id);
    }
    set({ selectedUser });
  },
}));
