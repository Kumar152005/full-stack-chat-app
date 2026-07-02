import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";  
import {
  addFriend,
  getMessages,
  getUserForSidebar,
  searchUserByEmail,
  sendMessage,
} from "../controllers/message.controller.js"; 

const router = express.Router();

router.get("/users", protectRoute, getUserForSidebar );
router.get("/users/search", protectRoute, searchUserByEmail);
router.post("/users/:id/add", protectRoute, addFriend);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage);

export default router;
