const mongoose = require("mongoose")

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        reservationId: String,
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "FAILED", "CANCELLED"],
      default: "PENDING",
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    inventoryStatus: {
      type: String,
      enum: ["PENDING", "RESERVED", "CONFIRMED", "FAILED"],
      default: "PENDING",
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    failureReason: String,
    version: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
)

// Index for user orders
orderSchema.index({ userId: 1, createdAt: -1 })
orderSchema.index({ status: 1 })

module.exports = mongoose.model("Order", orderSchema)
