import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";  
import {
  addFriend,
  deleteMessageForEveryone,
  getMessages,
  getUploadSignature,
  getUserForSidebar,
  markMessagesSeen,
  reactToMessage,
  searchUserByEmail,
  sendMessage,
  togglePinChat,
} from "../controllers/message.controller.js"; 

const router = express.Router();

router.get("/users", protectRoute, getUserForSidebar );
router.get("/users/search", protectRoute, searchUserByEmail);
router.post("/users/:id/add", protectRoute, addFriend);
router.post("/users/:id/pin", protectRoute, togglePinChat);
router.get("/upload/signature", protectRoute, getUploadSignature);
router.put("/:id/seen", protectRoute, markMessagesSeen);
router.put("/:id/react", protectRoute, reactToMessage);
router.delete("/:id", protectRoute, deleteMessageForEveryone);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage);

export default router;
