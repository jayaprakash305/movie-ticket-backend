import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  deleteNotification,
  clearAllNotifications,
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.get("/unread-count", authMiddleware, getUnreadCount);
router.patch("/mark-all-read", authMiddleware, markAllRead);
router.patch("/:id/read", authMiddleware, markAsRead);
router.delete("/clear-all", authMiddleware, clearAllNotifications);
router.delete("/:id", authMiddleware, deleteNotification);

export default router;