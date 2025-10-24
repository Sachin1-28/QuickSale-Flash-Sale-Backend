require("dotenv").config()
const express = require("express")
const connectDB = require("../../config/database")
const authRoutes = require("./routes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()

// Middleware
app.use(express.json())

// Connect to database
connectDB()

// Routes
app.use("/api/auth", authRoutes)

// Error handling
app.use(errorHandler)

const PORT = process.env.AUTH_SERVICE_PORT || 3001
app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`)
})
