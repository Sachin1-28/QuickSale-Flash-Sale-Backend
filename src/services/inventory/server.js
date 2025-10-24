require("dotenv").config()
const express = require("express")
const connectDB = require("../../config/database")
const inventoryRoutes = require("./routes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()

// Middleware
app.use(express.json())

// Connect to database
connectDB()

// Routes
app.use("/api/inventory", inventoryRoutes)

// Error handling
app.use(errorHandler)

const PORT = process.env.INVENTORY_SERVICE_PORT || 3002
app.listen(PORT, () => {
  console.log(`Inventory Service running on port ${PORT}`)
})
