const WebSocket = require("ws")
const jwt = require("jsonwebtoken")
const kafka = require("../../config/kafka")
const Notification = require("../../models/Notification")

class WebSocketManager {
  constructor() {
    this.userConnections = new Map() // userId -> Set of WebSocket connections
    this.connectionMetadata = new Map() // ws -> { userId, connectedAt }
  }

  // Authenticate WebSocket connection
  authenticateConnection(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      return decoded
    } catch (error) {
      throw new Error("Invalid token")
    }
  }

  // Handle new WebSocket connection
  handleConnection(ws, token) {
    try {
      const user = this.authenticateConnection(token)
      const userId = user.userId

      // Store connection
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set())
      }
      this.userConnections.get(userId).add(ws)

      // Store metadata
      this.connectionMetadata.set(ws, {
        userId,
        connectedAt: new Date(),
      })

      console.log(`User ${userId} connected via WebSocket`)

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: "connection",
          message: "Connected to notification service",
          timestamp: new Date().toISOString(),
        }),
      )

      // Send pending notifications
      this.sendPendingNotifications(userId, ws)

      return userId
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: error.message,
        }),
      )
      ws.close()
      throw error
    }
  }

  // Send pending notifications to user
  async sendPendingNotifications(userId, ws) {
    try {
      const notifications = await Notification.find({ userId, read: false }).limit(50)

      for (const notification of notifications) {
        ws.send(
          JSON.stringify({
            type: "notification",
            data: {
              id: notification._id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              data: notification.data,
              createdAt: notification.createdAt,
            },
          }),
        )
      }
    } catch (error) {
      console.error("Error sending pending notifications:", error)
    }
  }

  // Handle disconnection
  handleDisconnection(ws) {
    const metadata = this.connectionMetadata.get(ws)
    if (metadata) {
      const userId = metadata.userId
      const userConnections = this.userConnections.get(userId)

      if (userConnections) {
        userConnections.delete(ws)
        if (userConnections.size === 0) {
          this.userConnections.delete(userId)
        }
      }

      this.connectionMetadata.delete(ws)
      console.log(`User ${userId} disconnected`)
    }
  }

  // Send notification to user
  sendNotificationToUser(userId, notification) {
    const userConnections = this.userConnections.get(userId)

    if (userConnections && userConnections.size > 0) {
      const message = JSON.stringify({
        type: "order.update",
        data: notification,
        timestamp: new Date().toISOString(),
      })

      userConnections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message)
        }
      })

      console.log(`Notification sent to user ${userId}`)
    }
  }

  // Broadcast to all connected users
  broadcast(message) {
    const broadcastMessage = JSON.stringify({
      type: "broadcast",
      data: message,
      timestamp: new Date().toISOString(),
    })

    this.userConnections.forEach((connections) => {
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(broadcastMessage)
        }
      })
    })
  }

  // Get connection stats
  getStats() {
    let totalConnections = 0
    this.userConnections.forEach((connections) => {
      totalConnections += connections.size
    })

    return {
      connectedUsers: this.userConnections.size,
      totalConnections,
      timestamp: new Date().toISOString(),
    }
  }
}

module.exports = WebSocketManager
