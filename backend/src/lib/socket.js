import "dotenv/config";
import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

export function getReceiverSocketId(userId) {
  return Array.from(userSocketMap[userId] || [])[0];
}

export function getReceiverSocketIds(userId) {
  return Array.from(userSocketMap[userId] || []);
}

const emitToUser = (userId, event, payload) => {
  const socketIds = getReceiverSocketIds(userId);

  if (socketIds.length === 0) return false;

  io.to(socketIds).emit(event, payload);
  return true;
};

// used to store online users
const userSocketMap = {}; // {userId: Set<socketId>}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    if (!userSocketMap[userId]) userSocketMap[userId] = new Set();
    userSocketMap[userId].add(socket.id);

    Message.find({ receiverId: userId, status: "sent" })
      .then(async (messages) => {
        if (messages.length === 0) return;

        await Message.updateMany(
          { receiverId: userId, status: "sent" },
          { $set: { status: "delivered" } }
        );

        messages.forEach((message) => {
          emitToUser(message.senderId.toString(), "messageStatus", {
            messageId: message._id,
            status: "delivered",
          });
        });
      })
      .catch((error) => {
        console.log("Error updating delivered messages:", error.message);
      });
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("typing:start", ({ to, from }) => {
    emitToUser(to, "typing:start", { from });
  });

  socket.on("typing:stop", ({ to, from }) => {
    emitToUser(to, "typing:stop", { from });
  });

  socket.on("call:offer", ({ to, from, caller, type, offer }) => {
    const delivered = emitToUser(to, "call:offer", {
      from,
      caller,
      type,
      offer,
    });

    if (!delivered) {
      socket.emit("call:unavailable", { to });
    }
  });

  socket.on("call:answer", ({ to, from, answer }) => {
    emitToUser(to, "call:answer", { from, answer });
  });

  socket.on("call:ice-candidate", ({ to, from, candidate }) => {
    emitToUser(to, "call:ice-candidate", { from, candidate });
  });

  socket.on("call:reject", ({ to, from }) => {
    emitToUser(to, "call:reject", { from });
  });

  socket.on("call:busy", ({ to, from }) => {
    emitToUser(to, "call:busy", { from });
  });

  socket.on("call:end", ({ to, from }) => {
    emitToUser(to, "call:end", { from });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId && userSocketMap[userId]) {
      userSocketMap[userId].delete(socket.id);

      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
      }
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
