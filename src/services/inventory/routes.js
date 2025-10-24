const express = require("express")
const Product = require("../../models/Product")
const authMiddleware = require("../../middleware/auth")
const kafka = require("../../config/kafka")
const { v4: uuidv4 } = require("uuid")
const Joi = require("joi")

const router = express.Router()

// Validation schemas
const createProductSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().min(0).required(),
  originalPrice: Joi.number().min(0).required(),
  stock: Joi.number().min(0).required(),
  sku: Joi.string().required(),
  category: Joi.string().required(),
})

const updateStockSchema = Joi.object({
  quantity: Joi.number().integer().required(),
})

const reserveStockSchema = Joi.object({
  productId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  orderId: Joi.string().required(),
})

// Get all products
router.get("/products", async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true })
    res.json(products)
  } catch (error) {
    next(error)
  }
})

// Get product by ID
router.get("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }
    res.json(product)
  } catch (error) {
    next(error)
  }
})

// Create product (admin only)
router.post("/products", authMiddleware, async (req, res, next) => {
  try {
    const { error, value } = createProductSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ error: error.details[0].message })
    }

    const existingProduct = await Product.findOne({ sku: value.sku })
    if (existingProduct) {
      return res.status(409).json({ error: "Product with this SKU already exists" })
    }

    const product = new Product(value)
    await product.save()

    res.status(201).json({
      message: "Product created successfully",
      product,
    })
  } catch (error) {
    next(error)
  }
})

// Update stock
router.patch("/products/:id/stock", authMiddleware, async (req, res, next) => {
  try {
    const { error, value } = updateStockSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ error: error.details[0].message })
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { stock: value.quantity, version: 1 } },
      { new: true },
    )

    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }

    res.json({
      message: "Stock updated successfully",
      product,
    })
  } catch (error) {
    next(error)
  }
})

// Reserve stock (with Kafka event emission)
router.post("/reserve", authMiddleware, async (req, res, next) => {
  const session = await Product.startSession()
  session.startTransaction()

  try {
    const { error, value } = reserveStockSchema.validate(req.body)
    if (error) {
      await session.abortTransaction()
      return res.status(400).json({ error: error.details[0].message })
    }

    const { productId, quantity, orderId } = value

    // Fetch product with lock
    const product = await Product.findById(productId).session(session)
    if (!product) {
      await session.abortTransaction()
      return res.status(404).json({ error: "Product not found" })
    }

    const availableStock = product.getAvailableStock()
    if (availableStock < quantity) {
      await session.abortTransaction()

      // Emit failure event to Kafka
      const producer = kafka.producer()
      await producer.connect()
      await producer.send({
        topic: "inventory.result",
        messages: [
          {
            key: orderId,
            value: JSON.stringify({
              orderId,
              productId,
              quantity,
              status: "FAILED",
              reason: "Insufficient stock",
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      })
      await producer.disconnect()

      return res.status(400).json({
        error: "Insufficient stock",
        available: availableStock,
        requested: quantity,
      })
    }

    // Reserve stock
    product.reserved += quantity
    product.version += 1
    await product.save({ session })

    await session.commitTransaction()

    // Emit success event to Kafka
    const producer = kafka.producer()
    await producer.connect()
    await producer.send({
      topic: "inventory.result",
      messages: [
        {
          key: orderId,
          value: JSON.stringify({
            orderId,
            productId,
            quantity,
            status: "SUCCESS",
            reservationId: uuidv4(),
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    })
    await producer.disconnect()

    res.json({
      message: "Stock reserved successfully",
      product,
    })
  } catch (error) {
    await session.abortTransaction()
    next(error)
  } finally {
    await session.endSession()
  }
})

// Release reserved stock
router.post("/release", authMiddleware, async (req, res, next) => {
  try {
    const { productId, quantity } = req.body

    if (!productId || !quantity) {
      return res.status(400).json({ error: "productId and quantity required" })
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }

    if (product.reserved < quantity) {
      return res.status(400).json({ error: "Cannot release more than reserved" })
    }

    product.reserved -= quantity
    product.version += 1
    await product.save()

    res.json({
      message: "Stock released successfully",
      product,
    })
  } catch (error) {
    next(error)
  }
})

// Confirm stock (move from reserved to sold)
router.post("/confirm", authMiddleware, async (req, res, next) => {
  try {
    const { productId, quantity } = req.body

    if (!productId || !quantity) {
      return res.status(400).json({ error: "productId and quantity required" })
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }

    if (product.reserved < quantity || product.stock < quantity) {
      return res.status(400).json({ error: "Invalid stock state" })
    }

    product.stock -= quantity
    product.reserved -= quantity
    product.version += 1
    await product.save()

    res.json({
      message: "Stock confirmed successfully",
      product,
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
