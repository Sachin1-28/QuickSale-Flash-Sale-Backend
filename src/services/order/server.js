require("dotenv").config()
const express = require("express")
const connectDB = require("../../config/database")
const orderRoutes = require("./routes")
const { startInventoryResultConsumer } = require("./consumers")
const errorHandler = require("../../middleware/errorHandler")

const app = express()

// Middleware
app.use(express.json())

// Connect to database
connectDB()

// Routes
app.use("/api/orders", orderRoutes)

// Error handling
app.use(errorHandler)

// Start Kafka consumer
startInventoryResultConsumer().catch(console.error)

// Outbox publisher (runs every 5 seconds)
setInterval(async () => {
  try {
    const response = await fetch("http://localhost:3003/api/orders/outbox/publish", {
      method: "POST",
    })
    if (response.ok) {
      console.log("Outbox events published")
    }
  } catch (error) {
    console.error("Error publishing outbox events:", error)
  }
}, 5000)

const PORT = process.env.ORDER_SERVICE_PORT || 3003
app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`)
})
