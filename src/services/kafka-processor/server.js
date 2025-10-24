require("dotenv").config()
const connectDB = require("../../config/database")
const { startOrderCreatedConsumer } = require("./order-created-consumer")
const { startOrderStatusConsumer } = require("./order-status-consumer")

// Connect to database
connectDB()

// Start all consumers
const startConsumers = async () => {
  try {
    console.log("Starting Kafka consumers...")

    // Start order.created consumer (for inventory service)
    startOrderCreatedConsumer().catch((error) => {
      console.error("Error starting order.created consumer:", error)
      process.exit(1)
    })

    // Start order.status consumer (for notifier service)
    startOrderStatusConsumer().catch((error) => {
      console.error("Error starting order.status consumer:", error)
      process.exit(1)
    })

    console.log("All Kafka consumers started successfully")
  } catch (error) {
    console.error("Error starting consumers:", error)
    process.exit(1)
  }
}

startConsumers()

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down Kafka consumers...")
  process.exit(0)
})
