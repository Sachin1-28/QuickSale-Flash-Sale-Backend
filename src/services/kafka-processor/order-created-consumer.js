const kafka = require("../../config/kafka")
const Product = require("../../models/Product")
const Order = require("../../models/Order")

// Consumer for order.created events
const startOrderCreatedConsumer = async () => {
  const consumer = kafka.consumer({ groupId: "inventory-service-group" })
  await consumer.connect()

  await consumer.subscribe({ topic: "order.created", fromBeginning: false })

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString())
        const { orderId, userId, items, totalAmount } = payload

        console.log(`[order.created] Processing order ${orderId}`)

        // For each item in the order, attempt to reserve stock
        for (const item of items) {
          try {
            const product = await Product.findById(item.productId)
            if (!product) {
              console.error(`Product ${item.productId} not found`)
              continue
            }

            const availableStock = product.getAvailableStock()
            if (availableStock < item.quantity) {
              console.log(
                `Insufficient stock for product ${product.sku}: available=${availableStock}, requested=${item.quantity}`,
              )

              // Publish inventory.result FAILED event
              const producer = kafka.producer()
              await producer.connect()
              await producer.send({
                topic: "inventory.result",
                messages: [
                  {
                    key: orderId,
                    value: JSON.stringify({
                      orderId,
                      productId: item.productId,
                      quantity: item.quantity,
                      status: "FAILED",
                      reason: "Insufficient stock",
                      timestamp: new Date().toISOString(),
                    }),
                  },
                ],
              })
              await producer.disconnect()
              continue
            }

            // Reserve stock
            product.reserved += item.quantity
            product.version += 1
            await product.save()

            console.log(`Stock reserved for product ${product.sku}: quantity=${item.quantity}`)

            // Publish inventory.result SUCCESS event
            const producer = kafka.producer()
            await producer.connect()
            await producer.send({
              topic: "inventory.result",
              messages: [
                {
                  key: orderId,
                  value: JSON.stringify({
                    orderId,
                    productId: item.productId,
                    quantity: item.quantity,
                    status: "SUCCESS",
                    reservationId: `res-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                  }),
                },
              ],
            })
            await producer.disconnect()
          } catch (error) {
            console.error(`Error processing item ${item.productId}:`, error)
          }
        }
      } catch (error) {
        console.error("Error processing order.created event:", error)
      }
    },
  })
}

module.exports = {
  startOrderCreatedConsumer,
}
