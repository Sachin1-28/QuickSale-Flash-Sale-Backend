const kafka = require("../../config/kafka")
const Order = require("../../models/Order")
const Notification = require("../../models/Notification")

// Consumer for inventory.result events
const startInventoryResultConsumer = async () => {
  const consumer = kafka.consumer({ groupId: "order-service-group" })
  await consumer.connect()

  await consumer.subscribe({ topic: "inventory.result", fromBeginning: false })

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString())
        const { orderId, status, quantity, reason } = payload

        const order = await Order.findById(orderId)
        if (!order) {
          console.log(`Order ${orderId} not found`)
          return
        }

        if (status === "SUCCESS") {
          // Update order inventory status
          order.inventoryStatus = "RESERVED"
          order.items.forEach((item) => {
            item.reservationId = payload.reservationId
          })
        } else if (status === "FAILED") {
          // Mark order as failed
          order.status = "FAILED"
          order.inventoryStatus = "FAILED"
          order.failureReason = reason || "Inventory reservation failed"

          // Create notification
          const notification = new Notification({
            userId: order.userId,
            orderId: order._id,
            type: "ORDER_FAILED",
            title: "Order Failed",
            message: `Your order could not be completed: ${reason}`,
            data: { orderId: order._id },
          })
          await notification.save()
        }

        order.version += 1
        await order.save()

        console.log(`Order ${orderId} inventory status updated to ${status}`)
      } catch (error) {
        console.error("Error processing inventory.result event:", error)
      }
    },
  })
}

module.exports = {
  startInventoryResultConsumer,
}
