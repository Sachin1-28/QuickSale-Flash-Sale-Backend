const express = require("express")
const Order = require("../../models/Order")
const Outbox = require("../../models/Outbox")
const Product = require("../../models/Product")
const authMiddleware = require("../../middleware/auth")
const kafka = require("../../config/kafka")
const { v4: uuidv4 } = require("uuid")
const Joi = require("joi")

const router = express.Router()

// Validation schema
const createOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .required(),
})

// Helper function to create outbox event
const createOutboxEvent = async (aggregateId, eventType, payload, topic) => {
  const outbox = new Outbox({
    aggregateId,
    aggregateType: eventType.includes("order") ? "Order" : "Inventory",
    eventType,
    payload,
    topic,
  })
  return await outbox.save()
}

// Create order with idempotency
router.post("/", authMiddleware, async (req, res, next) => {
  const session = await Order.startSession()
  session.startTransaction()

  try {
    const idempotencyKey = req.headers["idempotency-key"]
    if (!idempotencyKey) {
      await session.abortTransaction()
      return res.status(400).json({ error: "Idempotency-Key header required" })
    }

    // Check if order with same idempotency key exists
    const existingOrder = await Order.findOne({ idempotencyKey }).session(session)
    if (existingOrder) {
      await session.commitTransaction()
      return res.status(200).json({
        message: "Order already exists (idempotent)",
        order: existingOrder,
      })
    }

    const { error, value } = createOrderSchema.validate(req.body)
    if (error) {
      await session.abortTransaction()
      return res.status(400).json({ error: error.details[0].message })
    }

    const { items } = value
    let totalAmount = 0
    const orderItems = []

    // Fetch all products and calculate total
    for (const item of items) {
      const product = await Product.findById(item.productId).session(session)
      if (!product) {
        await session.abortTransaction()
        return res.status(404).json({ error: `Product ${item.productId} not found` })
      }

      if (!product.isActive) {
        await session.abortTransaction()
        return res.status(400).json({ error: `Product ${product.name} is not active` })
      }

      const itemTotal = product.price * item.quantity
      totalAmount += itemTotal

      orderItems.push({
        productId: product._id,
        quantity: item.quantity,
        price: product.price,
      })
    }

    // Create order
    const order = new Order({
      userId: req.user.userId,
      items: orderItems,
      totalAmount,
      idempotencyKey,
      status: "PENDING",
      inventoryStatus: "PENDING",
    })

    await order.save({ session })

    // Create outbox event for order.created
    const outboxEvent = new Outbox({
      aggregateId: order._id.toString(),
      aggregateType: "Order",
      eventType: "order.created",
      payload: {
        orderId: order._id,
        userId: order.userId,
        items: order.items,
        totalAmount: order.totalAmount,
        timestamp: new Date().toISOString(),
      },
      topic: "order.created",
    })

    await outboxEvent.save({ session })

    await session.commitTransaction()

    // Emit order.created event to Kafka
    const producer = kafka.producer()
    await producer.connect()
    await producer.send({
      topic: "order.created",
      messages: [
        {
          key: order._id.toString(),
          value: JSON.stringify({
            orderId: order._id,
            userId: order.userId,
            items: order.items,
            totalAmount: order.totalAmount,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    })
    await producer.disconnect()

    res.status(201).json({
      message: "Order created successfully",
      order,
    })
  } catch (error) {
    await session.abortTransaction()
    next(error)
  } finally {
    await session.endSession()
  }
})

// Get user orders
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user.userId }).sort({ createdAt: -1 })
    res.json(orders)
  } catch (error) {
    next(error)
  }
})

// Get order by ID
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) {
      return res.status(404).json({ error: "Order not found" })
    }

    // Check authorization
    if (order.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: "Unauthorized" })
    }

    res.json(order)
  } catch (error) {
    next(error)
  }
})

// Update order status (internal use)
router.patch("/:id/status", async (req, res, next) => {
  const session = await Order.startSession()
  session.startTransaction()

  try {
    const { status, inventoryStatus, failureReason } = req.body

    const order = await Order.findById(req.params.id).session(session)
    if (!order) {
      await session.abortTransaction()
      return res.status(404).json({ error: "Order not found" })
    }

    // Update order status
    if (status) order.status = status
    if (inventoryStatus) order.inventoryStatus = inventoryStatus
    if (failureReason) order.failureReason = failureReason
    order.version += 1

    await order.save({ session })

    // Create outbox event for status change
    const outboxEvent = new Outbox({
      aggregateId: order._id.toString(),
      aggregateType: "Order",
      eventType: "order.status",
      payload: {
        orderId: order._id,
        userId: order.userId,
        status: order.status,
        inventoryStatus: order.inventoryStatus,
        timestamp: new Date().toISOString(),
      },
      topic: "order.status",
    })

    await outboxEvent.save({ session })

    await session.commitTransaction()

    // Emit order.status event to Kafka
    const producer = kafka.producer()
    await producer.connect()
    await producer.send({
      topic: "order.status",
      messages: [
        {
          key: order._id.toString(),
          value: JSON.stringify({
            orderId: order._id,
            userId: order.userId,
            status: order.status,
            inventoryStatus: order.inventoryStatus,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    })
    await producer.disconnect()

    res.json({
      message: "Order status updated",
      order,
    })
  } catch (error) {
    await session.abortTransaction()
    next(error)
  } finally {
    await session.endSession()
  }
})

// Outbox event publisher (runs periodically)
router.post("/outbox/publish", async (req, res, next) => {
  try {
    const unpublishedEvents = await Outbox.find({ published: false }).limit(100)

    if (unpublishedEvents.length === 0) {
      return res.json({ message: "No events to publish" })
    }

    const producer = kafka.producer()
    await producer.connect()

    for (const event of unpublishedEvents) {
      try {
        await producer.send({
          topic: event.topic,
          messages: [
            {
              key: event.aggregateId,
              value: JSON.stringify(event.payload),
            },
          ],
        })

        // Mark as published
        event.published = true
        event.publishedAt = new Date()
        await event.save()
      } catch (error) {
        event.retryCount += 1
        event.lastError = error.message
        await event.save()
      }
    }

    await producer.disconnect()

    res.json({
      message: "Events published",
      count: unpublishedEvents.length,
    })
  } catch (error) {
    next(error)
  }
})

// Get outbox events (for monitoring)
router.get("/outbox/events", async (req, res, next) => {
  try {
    const events = await Outbox.find().sort({ createdAt: -1 }).limit(50)
    res.json(events)
  } catch (error) {
    next(error)
  }
})

module.exports = router
