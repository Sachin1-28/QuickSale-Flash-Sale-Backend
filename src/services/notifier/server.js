require("dotenv").config()
const express = require("express")
const http = require("http")
const WebSocket = require("ws")
const connectDB = require("../../config/database")
const WebSocketManager = require("./websocket-manager")
const { startOrderStatusConsumer } = require("./kafka-consumer")
const notificationRoutes = require("./routes")
const errorHandler = require("../../middleware/errorHandler")

const app = express()
const server = http.createServer(app)

// Middleware
app.use(express.json())

// Connect to database
connectDB()

// Initialize WebSocket manager
const wsManager = new WebSocketManager()

// WebSocket server
const wss = new WebSocket.Server({ server })

wss.on("connection", (ws, req) => {
  try {
    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`)
    const token = url.searchParams.get("token")

    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Token required" }))
      ws.close()
      return
    }

    // Authenticate and handle connection
    wsManager.handleConnection(ws, token)

    // Handle incoming messages
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data)
        console.log("Received message:", message)

        // Handle ping/pong for keep-alive
        if (message.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }))
        }
      } catch (error) {
        console.error("Error processing message:", error)
      }
    })

    // Handle disconnection
    ws.on("close", () => {
      wsManager.handleDisconnection(ws)
    })

    // Handle errors
    ws.on("error", (error) => {
      console.error("WebSocket error:", error)
    })
  } catch (error) {
    console.error("Connection error:", error)
    ws.close()
  }
})

// REST API Routes
app.use("/api/notifications", notificationRoutes)

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "notifier",
    stats: wsManager.getStats(),
  })
})

// Error handling
app.use(errorHandler)

// Start Kafka consumer
startOrderStatusConsumer(wsManager)

const PORT = process.env.NOTIFIER_SERVICE_PORT || 3004
server.listen(PORT, () => {
  console.log(`Notifier Service running on port ${PORT}`)
  console.log(`WebSocket endpoint: ws://localhost:${PORT}?token=<JWT_TOKEN>`)
})
