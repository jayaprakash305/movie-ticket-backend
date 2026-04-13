// controllers/notificationController.js
import Notification from "../models/Notification.js"

// ── Helper: build the query filter that matches the existing schema
// The model uses receiverId (ObjectId) + receiverRole (string), NOT userId.
const userFilter = (user) => ({
  $or: [
    { receiverId: user._id },
    { receiverRole: user.role },
  ],
})

// ── GET /notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find(userFilter(req.user))
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    res.status(200).json(notifications)
  } catch (err) {
    console.error("getNotifications error:", err)
    res.status(500).json({ message: "Failed to fetch notifications" })
  }
}

// ── GET /notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      ...userFilter(req.user),
      isRead: false,
    })
    res.status(200).json({ count })
  } catch (err) {
    console.error("getUnreadCount error:", err)
    res.status(500).json({ message: "Failed to fetch unread count" })
  }
}

// ── PATCH /notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { returnDocument: 'after' }
    )

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" })
    }

    res.status(200).json(notification)
  } catch (err) {
    console.error("markAsRead error:", err)
    res.status(500).json({ message: "Failed to mark notification as read" })
  }
}

// ── PATCH /notifications/mark-all-read
export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { ...userFilter(req.user), isRead: false },
      { isRead: true }
    )

    res.status(200).json({ message: "All notifications marked as read" })
  } catch (err) {
    console.error("markAllRead error:", err)
    res.status(500).json({ message: "Failed to mark all as read" })
  }
}

// ── DELETE /notifications/:id
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id)

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" })
    }

    res.status(200).json({ message: "Notification deleted" })
  } catch (err) {
    console.error("deleteNotification error:", err)
    res.status(500).json({ message: "Failed to delete notification" })
  }
}

// ── DELETE /notifications/clear-all
export const clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany(userFilter(req.user))
    res.status(200).json({ message: "All notifications cleared" })
  } catch (err) {
    console.error("clearAllNotifications error:", err)
    res.status(500).json({ message: "Failed to clear notifications" })
  }
}