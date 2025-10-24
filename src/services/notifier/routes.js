const express = require("express")
const authMiddleware = require("../../middleware/auth")
const Notification = require("../../models/Notification")

const router = express.Router()

// Get user notifications
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const { read } = req.query
    const filter = { userId: req.user.userId }

    if (read !== undefined) {
      filter.read = read === "true"
    }

    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50)

    res.json(notifications)
  } catch (error) {
    next(error)
  }
})

// Mark notification as read
router.patch("/:id/read", authMiddleware, async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id)

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" })
    }

    if (notification.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Unauthorized" })
    }

    notification.read = true
    await notification.save()

    res.json({
      message: "Notification marked as read",
      notification,
    })
  } catch (error) {
    next(error)
  }
})

// Mark all notifications as read
router.patch("/read/all", authMiddleware, async (req, res, next) => {
  try {
    const result = await Notification.updateMany({ userId: req.user.userId, read: false }, { read: true })

    res.json({
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    next(error)
  }
})

// Delete notification
router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id)

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" })
    }

    if (notification.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Unauthorized" })
    }

    await Notification.deleteOne({ _id: req.params.id })

    res.json({ message: "Notification deleted" })
  } catch (error) {
    next(error)
  }
})

// Get unread count
router.get("/unread/count", authMiddleware, async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.userId,
      read: false,
    })

    res.json({ unreadCount: count })
  } catch (error) {
    next(error)
  }
})

module.exports = router
