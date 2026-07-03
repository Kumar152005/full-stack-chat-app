import Status from "../models/status.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketIds, io } from "../lib/socket.js";

const getBrowserSafeImageUrl = (uploadResponse) =>
  cloudinary.url(uploadResponse.public_id, {
    secure: true,
    resource_type: "image",
    format: "jpg",
    transformation: [{ quality: "auto" }],
  });

export const getStatuses = async (req, res) => {
  try {
    const visibleUserIds = [req.user._id, ...(req.user.friends || [])];
    const statuses = await Status.find({
      userId: { $in: visibleUserIds },
      expiresAt: { $gt: new Date() },
    })
      .populate("userId", "fullName email profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json(statuses);
  } catch (error) {
    console.log("Error in getStatuses controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createStatus = async (req, res) => {
  try {
    const { text, image, expiresInHours = 24 } = req.body;

    if (!text?.trim() && !image) {
      return res.status(400).json({ message: "Add text or photo to post an Aura Drop" });
    }

    const allowedDurations = [1, 6, 12, 24, 48, 168];
    const duration = Number(expiresInHours);
    const safeDuration = allowedDurations.includes(duration) ? duration : 24;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image, { resource_type: "image" });
      imageUrl = getBrowserSafeImageUrl(uploadResponse);
    }

    const status = await Status.create({
      userId: req.user._id,
      text: text?.trim(),
      image: imageUrl,
      expiresAt: new Date(Date.now() + safeDuration * 60 * 60 * 1000),
    });
    await status.populate("userId", "fullName email profilePic");

    const friendIds = req.user.friends || [];
    friendIds.forEach((friendId) => {
      const socketIds = getReceiverSocketIds(friendId);
      if (socketIds.length > 0) io.to(socketIds).emit("newStatus", status);
    });

    res.status(201).json(status);
  } catch (error) {
    console.log("Error in createStatus controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteStatus = async (req, res) => {
  try {
    const status = await Status.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!status) {
      return res.status(404).json({ message: "Aura Drop not found" });
    }

    const friendIds = req.user.friends || [];
    friendIds.forEach((friendId) => {
      const socketIds = getReceiverSocketIds(friendId);
      if (socketIds.length > 0) io.to(socketIds).emit("statusDeleted", { statusId: req.params.id });
    });

    res.status(200).json({ message: "Aura Drop deleted" });
  } catch (error) {
    console.log("Error in deleteStatus controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
