import express from "express";
import {
  getNotifications,
  markRead,
  markAllRead,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Get all notifications for logged-in user
router.get("/", getNotifications);

// Mark a single notification as read
router.patch("/:id/read", markRead);

// Mark all notifications as read
router.patch("/read-all", markAllRead);

export default router;