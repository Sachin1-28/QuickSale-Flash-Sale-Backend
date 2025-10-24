const httpProxy = require("express-http-proxy")

// Service URLs
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  inventory: process.env.INVENTORY_SERVICE_URL || "http://localhost:3002",
  orders: process.env.ORDER_SERVICE_URL || "http://localhost:3003",
  notifications: process.env.NOTIFIER_SERVICE_URL || "http://localhost:3004",
}

// Create proxy routes
const createProxyRoutes = (app) => {
  // Auth Service
  app.use(
    "/api/auth",
    httpProxy(SERVICES.auth, {
      proxyReqPathResolver: (req) => `/api/auth${req.url.split("/api/auth")[1]}`,
    }),
  )

  // Inventory Service
  app.use(
    "/api/inventory",
    httpProxy(SERVICES.inventory, {
      proxyReqPathResolver: (req) => `/api/inventory${req.url.split("/api/inventory")[1]}`,
    }),
  )

  // Orders Service
  app.use(
    "/api/orders",
    httpProxy(SERVICES.orders, {
      proxyReqPathResolver: (req) => `/api/orders${req.url.split("/api/orders")[1]}`,
    }),
  )

  // Notifications Service
  app.use(
    "/api/notifications",
    httpProxy(SERVICES.notifications, {
      proxyReqPathResolver: (req) => `/api/notifications${req.url.split("/api/notifications")[1]}`,
    }),
  )
}

module.exports = {
  createProxyRoutes,
  SERVICES,
}
