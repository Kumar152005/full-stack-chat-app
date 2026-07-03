import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
const getErrorMessage = (error) =>
  error.response?.data?.message || "Unable to connect to the server";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,
  socketStatus: "disconnected",

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
      return res.data;
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(getErrorMessage(error));
      throw error;
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(SOCKET_URL, {
      query: {
        userId: authUser._id,
      },
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
    });

    set({ socket, socketStatus: "connecting" });

    socket.on("connect", () => {
      set({ socketStatus: "connected" });
    });

    socket.on("disconnect", () => {
      set({ socketStatus: "disconnected", onlineUsers: [] });
    });

    socket.io.on("reconnect_attempt", () => {
      set({ socketStatus: "reconnecting" });
    });

    socket.io.on("reconnect", () => {
      set({ socketStatus: "connected" });
      toast.success("Reconnected");
    });

    socket.io.on("reconnect_failed", () => {
      set({ socketStatus: "disconnected" });
      toast.error("Connection lost. Please refresh if it does not recover.");
    });

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },
  disconnectSocket: () => {
    get().socket?.disconnect();
    set({ socket: null, onlineUsers: [], socketStatus: "disconnected" });
  },
}));
