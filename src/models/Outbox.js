const mongoose = require("mongoose")

const outboxSchema = new mongoose.Schema(
  {
    aggregateId: {
      type: String,
      required: true,
    },
    aggregateType: {
      type: String,
      required: true,
      enum: ["Order", "Inventory"],
    },
    eventType: {
      type: String,
      required: true,
      enum: ["order.created", "order.status", "inventory.result"],
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    published: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: Date,
    topic: {
      type: String,
      required: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastError: String,
  },
  { timestamps: true },
)

// Index for unpublished events
outboxSchema.index({ published: 1, createdAt: 1 })

module.exports = mongoose.model("Outbox", outboxSchema)
