import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createStatus, deleteStatus, getStatuses } from "../controllers/status.controller.js";

const router = express.Router();

router.get("/", protectRoute, getStatuses);
router.post("/", protectRoute, createStatus);
router.delete("/:id", protectRoute, deleteStatus);

export default router;
