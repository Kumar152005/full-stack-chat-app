import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketIds, io } from "../lib/socket.js";

const getBrowserSafeImageUrl = (uploadResponse) =>
    cloudinary.url(uploadResponse.public_id, {
        secure: true,
        resource_type: "image",
        format: "jpg",
        transformation: [{ quality: "auto" }],
    });

export const getUserForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const friendIds = req.user.friends || [];
        const pinnedChatIds = (req.user.pinnedChats || []).map((id) => id.toString());
        const filteredUsers = await User.find({
            _id: { $in: friendIds, $ne: loggedInUserId },
        }).select("-password");

        filteredUsers.sort((a, b) => {
            const aIndex = pinnedChatIds.indexOf(a._id.toString());
            const bIndex = pinnedChatIds.indexOf(b._id.toString());
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });
        
        res.status(200).json(filteredUsers.map((user) => ({
            ...user.toObject(),
            isPinned: pinnedChatIds.includes(user._id.toString()),
        })));
    } catch (error) {
        console.error("Error in getUserForSidebar: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const searchUserByEmail = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const email = req.query.email?.trim();

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const user = await User.findOne({
            email: { $regex: `^${escapedEmail}$`, $options: "i" },
            _id: { $ne: loggedInUserId },
        }).select("-password");

        if (!user) {
            return res.status(404).json({ message: "No account found with this email" });
        }

        res.status(200).json({
            ...user.toObject(),
            isFriend: (req.user.friends || []).some((friendId) => friendId.toString() === user._id.toString()),
        });
    } catch (error) {
        console.error("Error in searchUserByEmail: ", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const addFriend = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const { id: friendId } = req.params;

        if (loggedInUserId.toString() === friendId) {
            return res.status(400).json({ message: "You cannot add yourself" });
        }

        const friend = await User.findById(friendId).select("-password");
        if (!friend) {
            return res.status(404).json({ message: "User not found" });
        }

        await User.findByIdAndUpdate(loggedInUserId, {
            $addToSet: { friends: friendId },
        });
        await User.findByIdAndUpdate(friendId, {
            $addToSet: { friends: loggedInUserId },
        });

        res.status(200).json(friend);
    } catch (error) {
        console.error("Error in addFriend: ", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getMessages = async(req,res) => {
    try {
        const { id: userToChatId } = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId },
            ],
        }).sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessages controller: ", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { text, image, attachment, voice } = req.body;
        const { id: receiverId } =  req.params;
        const senderId =req.user._id;

        let imageUrl;
        let attachmentData;
        if (image) {
            //upload base64 image to cloudinary
            const uploadResponse = await cloudinary.uploader.upload(image, { resource_type: "image" });
            imageUrl = getBrowserSafeImageUrl(uploadResponse);
        }
        if (attachment?.data) {
            const uploadResponse = await cloudinary.uploader.upload(attachment.data, {
                resource_type: "auto",
            });

            attachmentData = {
                url: uploadResponse.secure_url,
                name: attachment.name,
                type: attachment.type,
                size: attachment.size,
            };

            if (attachment.type?.startsWith("image/")) {
                imageUrl = getBrowserSafeImageUrl(uploadResponse);
            }
        }
        if (voice?.data) {
            const uploadResponse = await cloudinary.uploader.upload(voice.data, {
                resource_type: "video",
            });

            attachmentData = {
                url: uploadResponse.secure_url,
                name: voice.name || "Voice note",
                type: voice.type || "audio/webm",
                size: voice.size,
            };
        }

        const receiverSocketIds = getReceiverSocketIds(receiverId);

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            attachment: attachmentData,
            status: receiverSocketIds.length > 0 ? "delivered" : "sent",
        });

        await newMessage.save();

        if (receiverSocketIds.length > 0) {
            io.to(receiverSocketIds).emit("newMessage", newMessage);
        }
    
        res.status(201).json(newMessage);
    } catch (error) {
      console.log("Error in sendMessage controller: ", error.message);
      res.status(500).json({ message: "Internal server error" });
    }
};

export const markMessagesSeen = async (req, res) => {
    try {
        const { id: friendId } = req.params;
        const myId = req.user._id;

        const result = await Message.updateMany(
            { senderId: friendId, receiverId: myId, status: { $ne: "seen" } },
            { $set: { status: "seen" } }
        );

        const senderSocketIds = getReceiverSocketIds(friendId);
        if (senderSocketIds.length > 0) {
            io.to(senderSocketIds).emit("messagesSeen", { by: myId, conversationWith: friendId });
        }

        res.status(200).json({ updatedCount: result.modifiedCount });
    } catch (error) {
        console.log("Error in markMessagesSeen controller: ", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const reactToMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user._id;

        if (!emoji) {
            return res.status(400).json({ message: "Emoji is required" });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        const canReact =
            message.senderId.toString() === userId.toString() ||
            message.receiverId.toString() === userId.toString();
        if (!canReact) {
            return res.status(403).json({ message: "Not allowed" });
        }

        message.reactions = (message.reactions || []).filter(
            (reaction) => reaction.userId.toString() !== userId.toString()
        );
        message.reactions.push({ userId, emoji });
        await message.save();

        const payload = { messageId: message._id, reactions: message.reactions };
        io.to(getReceiverSocketIds(message.senderId)).emit("messageReaction", payload);
        io.to(getReceiverSocketIds(message.receiverId)).emit("messageReaction", payload);

        res.status(200).json(message);
    } catch (error) {
        console.log("Error in reactToMessage controller: ", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteMessageForEveryone = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Only sender can delete this message" });
        }

        message.deletedForEveryone = true;
        message.text = "";
        message.image = "";
        message.attachment = undefined;
        await message.save();

        const payload = { messageId: message._id };
        io.to(getReceiverSocketIds(message.senderId)).emit("messageDeleted", payload);
        io.to(getReceiverSocketIds(message.receiverId)).emit("messageDeleted", payload);

        res.status(200).json(message);
    } catch (error) {
        console.log("Error in deleteMessageForEveryone controller: ", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const togglePinChat = async (req, res) => {
    try {
        const { id: friendId } = req.params;
        const userId = req.user._id;
        const pinnedChatIds = (req.user.pinnedChats || []).map((id) => id.toString());
        const isPinned = pinnedChatIds.includes(friendId);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            isPinned
                ? { $pull: { pinnedChats: friendId } }
                : { $addToSet: { pinnedChats: friendId } },
            { new: true }
        ).select("-password");

        res.status(200).json({
            pinnedChats: updatedUser.pinnedChats,
            isPinned: !isPinned,
        });
    } catch (error) {
        console.log("Error in togglePinChat controller: ", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};
