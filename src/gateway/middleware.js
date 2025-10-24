const jwt = require("jsonwebtoken")
const RateLimiter = require("./rate-limiter")

const rateLimiter = new RateLimiter(process.env.REDIS_URL || "redis://localhost:6379")

// JWT verification middleware
const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]

  // Public endpoints that don't require auth
  const publicEndpoints = ["/api/auth/register", "/api/auth/login", "/api/inventory/products"]

  if (publicEndpoints.includes(req.path)) {
    return next()
  }

  if (!token) {
    return res.status(401).json({ error: "No token provided" })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" })
  }
}

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
  try {
    // Use user ID if authenticated, otherwise use IP
    const identifier = req.user?.userId || req.ip

    // Different limits for different endpoints
    let limit = 100 // default
    let windowSeconds = 60 // 1 minute

    if (req.path.includes("/orders")) {
      limit = 10 // 10 orders per minute
      windowSeconds = 60
    } else if (req.path.includes("/auth/login")) {
      limit = 5 // 5 login attempts per minute
      windowSeconds = 60
    } else if (req.path.includes("/auth/register")) {
      limit = 3 // 3 registrations per minute
      windowSeconds = 60
    } else if (req.path.includes("/inventory/reserve")) {
      limit = 50 // 50 reservations per minute
      windowSeconds = 60
    }

    const result = await rateLimiter.checkLimit(identifier, req.path, limit, windowSeconds)

    // Set rate limit headers
    res.set("X-RateLimit-Limit", result.limit)
    res.set("X-RateLimit-Current", result.current)
    res.set("X-RateLimit-Reset", result.resetIn)

    if (!result.allowed) {
      return res.status(429).json({
        error: "Too many requests",
        retryAfter: result.resetIn,
      })
    }

    next()
  } catch (error) {
    console.error("Rate limit middleware error:", error)
    next() // Allow request on error
  }
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now()

  res.on("finish", () => {
    const duration = Date.now() - start
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`)
  })

  next()
}

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error("Gateway error:", err)

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  })
}

module.exports = {
  verifyJWT,
  rateLimitMiddleware,
  requestLogger,
  errorHandler,
}
