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
const callRooms = new Map(); // roomId -> { type, createdBy, participants, profiles }
const MAX_GROUP_CALL_PARTICIPANTS = 4;

const getRoomParticipants = (room) => Array.from(room.profiles.values());

const leaveCallRoom = (roomId, participantId) => {
  const room = callRooms.get(roomId);
  if (!room || !participantId || !room.participants.has(participantId)) return;

  room.participants.delete(participantId);
  room.profiles.delete(participantId);

  io.to(roomId).emit("group-call:participant-left", { roomId, participantId });

  if (room.participants.size === 0) {
    callRooms.delete(roomId);
  }
};

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

  socket.on("group-call:create", ({ roomId, from, caller, type, inviteeIds = [] }) => {
    if (!roomId || !from || !caller) return;

    const uniqueInviteeIds = [...new Set(inviteeIds.map((id) => id?.toString()).filter(Boolean))]
      .filter((id) => id !== from)
      .slice(0, MAX_GROUP_CALL_PARTICIPANTS - 1);

    const room = {
      type,
      createdBy: from,
      participants: new Set([from]),
      profiles: new Map([[from, caller]]),
    };

    callRooms.set(roomId, room);
    socket.join(roomId);
    socket.emit("group-call:created", {
      roomId,
      type,
      participants: getRoomParticipants(room),
    });

    uniqueInviteeIds.forEach((inviteeId) => {
      const delivered = emitToUser(inviteeId, "group-call:invite", {
        roomId,
        from,
        caller,
        type,
        participants: getRoomParticipants(room),
      });

      if (!delivered) {
        socket.emit("call:unavailable", { to: inviteeId });
      }
    });
  });

  socket.on("group-call:invite", ({ roomId, from, invitee, participants }) => {
    const room = callRooms.get(roomId);
    if (!room || !from || !invitee?._id) return;

    if (room.participants.size >= MAX_GROUP_CALL_PARTICIPANTS) {
      socket.emit("group-call:room-full", { roomId });
      return;
    }

    const delivered = emitToUser(invitee._id, "group-call:invite", {
      roomId,
      from,
      caller: room.profiles.get(from),
      type: room.type,
      participants: participants || getRoomParticipants(room),
    });

    if (!delivered) {
      socket.emit("call:unavailable", { to: invitee._id });
    }
  });

  socket.on("group-call:accept", ({ roomId, from, participant }) => {
    const room = callRooms.get(roomId);
    if (!room || !from || !participant?._id) return;

    if (room.participants.size >= MAX_GROUP_CALL_PARTICIPANTS && !room.participants.has(from)) {
      socket.emit("group-call:room-full", { roomId });
      return;
    }

    socket.join(roomId);
    room.participants.add(from);
    room.profiles.set(from, participant);

    socket.emit("group-call:accepted", {
      roomId,
      type: room.type,
      participants: getRoomParticipants(room),
    });

    socket.to(roomId).emit("group-call:participant-joined", {
      roomId,
      participant,
      participants: getRoomParticipants(room),
    });
  });

  socket.on("group-call:reject", ({ roomId, from, to }) => {
    if (to) emitToUser(to, "group-call:rejected", { roomId, from });
  });

  socket.on("group-call:offer", ({ roomId, to, from, offer }) => {
    emitToUser(to, "group-call:offer", { roomId, from, offer });
  });

  socket.on("group-call:answer", ({ roomId, to, from, answer }) => {
    emitToUser(to, "group-call:answer", { roomId, from, answer });
  });

  socket.on("group-call:ice-candidate", ({ roomId, to, from, candidate }) => {
    emitToUser(to, "group-call:ice-candidate", { roomId, from, candidate });
  });

  socket.on("group-call:leave", ({ roomId, from }) => {
    socket.leave(roomId);
    leaveCallRoom(roomId, from);
  });

  socket.on("group-call:end", ({ roomId, from }) => {
    const room = callRooms.get(roomId);
    if (!room) return;

    io.to(roomId).emit("group-call:ended", { roomId, from });
    callRooms.delete(roomId);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId && userSocketMap[userId]) {
      userSocketMap[userId].delete(socket.id);

      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
      }
    }

    if (userId) {
      Array.from(callRooms.keys()).forEach((roomId) => {
        leaveCallRoom(roomId, userId);
      });
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
