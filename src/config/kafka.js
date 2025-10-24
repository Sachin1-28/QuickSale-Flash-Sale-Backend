const { Kafka } = require("kafkajs")

const kafka = new Kafka({
  clientId: "quicksale-app",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
})

module.exports = kafka
