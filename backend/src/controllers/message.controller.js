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
        const filteredUsers = await User.find({
            _id: { $in: friendIds, $ne: loggedInUserId },
        }).select("-password");
        
        res.status(200).json(filteredUsers);
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
        const { text, image, attachment } = req.body;
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

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            attachment: attachmentData,
        });

        await newMessage.save();

         const receiverSocketIds = getReceiverSocketIds(receiverId);
    if (receiverSocketIds.length > 0) {
      io.to(receiverSocketIds).emit("newMessage", newMessage);
    }
    
        res.status(201).json(newMessage);
    } catch (error) {
      console.log("Error in sendMessage controller: ", error.message);
      res.status(500).json({ message: "Internal server error" });
    }
};
