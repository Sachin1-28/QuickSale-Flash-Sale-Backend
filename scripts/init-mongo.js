// Initialize MongoDB collections and indexes
// Get reference to quicksale database
const db = require("mongodb").MongoClient.connect("mongodb://localhost:27017/admin") // Declare the db variable
var quicksaleDb = db.getSiblingDB("quicksale")

// Create users collection
quicksaleDb.createCollection("users")
quicksaleDb.users.createIndex({ email: 1 }, { unique: true })
quicksaleDb.users.createIndex({ createdAt: 1 })

// Create products collection
quicksaleDb.createCollection("products")
quicksaleDb.products.createIndex({ sku: 1 }, { unique: true })
quicksaleDb.products.createIndex({ name: 1 })
quicksaleDb.products.createIndex({ createdAt: 1 })

// Create orders collection
quicksaleDb.createCollection("orders")
quicksaleDb.orders.createIndex({ userId: 1 })
quicksaleDb.orders.createIndex({ idempotencyKey: 1 }, { unique: true })
quicksaleDb.orders.createIndex({ status: 1 })
quicksaleDb.orders.createIndex({ createdAt: 1 })

// Create outbox collection
quicksaleDb.createCollection("outbox")
quicksaleDb.outbox.createIndex({ published: 1, createdAt: 1 })
quicksaleDb.outbox.createIndex({ eventType: 1 })
quicksaleDb.outbox.createIndex({ createdAt: 1 })

// Create notifications collection
quicksaleDb.createCollection("notifications")
quicksaleDb.notifications.createIndex({ userId: 1 })
quicksaleDb.notifications.createIndex({ read: 1 })
quicksaleDb.notifications.createIndex({ createdAt: 1 })

// Create refresh tokens collection
quicksaleDb.createCollection("refreshTokens")
quicksaleDb.refreshTokens.createIndex({ userId: 1 })
quicksaleDb.refreshTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })

print("MongoDB initialization completed successfully!")
