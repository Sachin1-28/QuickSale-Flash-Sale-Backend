require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { verifyJWT, rateLimitMiddleware, requestLogger, errorHandler } = require("./middleware")
const { createProxyRoutes } = require("./proxy")

const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(requestLogger)

// Health check endpoint (no auth required)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
  })
})

// API version endpoint
app.get("/api/version", (req, res) => {
  res.json({
    version: "1.0.0",
    services: {
      auth: "1.0.0",
      inventory: "1.0.0",
      orders: "1.0.0",
      notifications: "1.0.0",
    },
  })
})

// Apply JWT verification
app.use(verifyJWT)

// Apply rate limiting
app.use(rateLimitMiddleware)

// Create proxy routes
createProxyRoutes(app)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" })
})

// Error handling
app.use(errorHandler)

const PORT = process.env.API_GATEWAY_PORT || 3000
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`)
  console.log(`Services:`)
  console.log(`  - Auth: http://localhost:3001`)
  console.log(`  - Inventory: http://localhost:3002`)
  console.log(`  - Orders: http://localhost:3003`)
  console.log(`  - Notifications: http://localhost:3004`)
})
