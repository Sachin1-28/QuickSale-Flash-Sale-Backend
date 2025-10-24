const kafka = require("../../config/kafka")
const Notification = require("../../models/Notification")

// Start Kafka consumer for order.status events
const startOrderStatusConsumer = (wsManager) => {
  const consumer = kafka.consumer({ groupId: "notifier-service-group" })

  consumer.connect().then(() => {
    consumer.subscribe({ topic: "order.status", fromBeginning: false })

    consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const payload = JSON.parse(message.value.toString())
          const { orderId, userId, status, inventoryStatus } = payload

          console.log(`[Notifier] Received order.status event for order ${orderId}`)

          // Determine notification type and message
          let notificationType = "ORDER_CREATED"
          let title = "Order Status Updated"
          let messageText = `Your order status is now: ${status}`

          if (status === "CONFIRMED") {
            notificationType = "ORDER_CONFIRMED"
            title = "Order Confirmed"
            messageText = "Your order has been confirmed and is being prepared for shipment"
          } else if (status === "FAILED") {
            notificationType = "ORDER_FAILED"
            title = "Order Failed"
            messageText = "Unfortunately, your order could not be completed. Please try again."
          }

          if (inventoryStatus === "RESERVED") {
            notificationType = "STOCK_RESERVED"
            title = "Stock Reserved"
            messageText = "Your items have been reserved. Proceeding to payment."
          }

          // Create notification in database
          const notification = new Notification({
            userId,
            orderId,
            type: notificationType,
            title,
            message: messageText,
            data: {
              orderId,
              status,
              inventoryStatus,
            },
          })

          await notification.save()

          // Send real-time notification via WebSocket
          wsManager.sendNotificationToUser(userId, {
            id: notification._id,
            type: notificationType,
            title,
            message: messageText,
            orderId,
            status,
            inventoryStatus,
            createdAt: notification.createdAt,
          })
        } catch (error) {
          console.error("Error processing order.status event:", error)
        }
      },
    })
  })

  return consumer
}

module.exports = {
  startOrderStatusConsumer,
}
