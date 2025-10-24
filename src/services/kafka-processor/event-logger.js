const kafka = require("../../config/kafka")

// Event logger for monitoring all Kafka events
const startEventLogger = async () => {
  const consumer = kafka.consumer({ groupId: "event-logger-group" })
  await consumer.connect()

  await consumer.subscribe({
    topics: ["order.created", "order.status", "inventory.result"],
    fromBeginning: false,
  })

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString())
        console.log(`[EVENT LOG] Topic: ${topic}`)
        console.log(`[EVENT LOG] Partition: ${partition}`)
        console.log(`[EVENT LOG] Payload:`, JSON.stringify(payload, null, 2))
        console.log("---")
      } catch (error) {
        console.error("Error logging event:", error)
      }
    },
  })
}

module.exports = {
  startEventLogger,
}
