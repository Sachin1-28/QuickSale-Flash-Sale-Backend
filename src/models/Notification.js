const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    type: {
      type: String,
      enum: ["ORDER_CREATED", "ORDER_CONFIRMED", "ORDER_FAILED", "STOCK_RESERVED"],
      required: true,
    },
    title: String,
    message: String,
    data: mongoose.Schema.Types.Mixed,
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
)

// Index for user notifications
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, read: 1 })

module.exports = mongoose.model("Notification", notificationSchema)
