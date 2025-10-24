const kafka = require("../../config/kafka")
const Notification = require("../../models/Notification")

// Consumer for order.status events
const startOrderStatusConsumer = async () => {
  const consumer = kafka.consumer({ groupId: "notifier-service-group" })
  await consumer.connect()

  await consumer.subscribe({ topic: "order.status", fromBeginning: false })

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString())
        const { orderId, userId, status, inventoryStatus } = payload

        console.log(`[order.status] Processing order ${orderId} with status ${status}`)

        // Create notification for user
        let notificationType = "ORDER_CREATED"
        let title = "Order Status Updated"
        let messageText = `Your order status is now: ${status}`

        if (status === "CONFIRMED") {
          notificationType = "ORDER_CONFIRMED"
          title = "Order Confirmed"
          messageText = "Your order has been confirmed and is being prepared"
        } else if (status === "FAILED") {
          notificationType = "ORDER_FAILED"
          title = "Order Failed"
          messageText = "Unfortunately, your order could not be completed"
        } else if (inventoryStatus === "RESERVED") {
          notificationType = "STOCK_RESERVED"
          title = "Stock Reserved"
          messageText = "Your items have been reserved"
        }

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

        console.log(`Notification created for user ${userId}`)

        // In a real system, this would trigger WebSocket push to connected clients
        // For now, notifications are stored in DB and fetched by clients
      } catch (error) {
        console.error("Error processing order.status event:", error)
      }
    },
  })
}

module.exports = {
  startOrderStatusConsumer,
}
