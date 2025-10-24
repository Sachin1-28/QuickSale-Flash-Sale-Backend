const redis = require("redis")

class RateLimiter {
  constructor(redisUrl) {
    this.client = redis.createClient({ url: redisUrl })
    this.client.connect().catch(console.error)
  }

  // Generate rate limit key
  generateKey(identifier, endpoint) {
    return `rate-limit:${identifier}:${endpoint}`
  }

  // Check rate limit
  async checkLimit(identifier, endpoint, limit, windowSeconds) {
    const key = this.generateKey(identifier, endpoint)

    try {
      const current = await this.client.incr(key)

      if (current === 1) {
        // First request in window, set expiry
        await this.client.expire(key, windowSeconds)
      }

      return {
        allowed: current <= limit,
        current,
        limit,
        resetIn: await this.client.ttl(key),
      }
    } catch (error) {
      console.error("Rate limiter error:", error)
      // Allow request on error (fail open)
      return { allowed: true, current: 0, limit, resetIn: 0 }
    }
  }

  // Reset rate limit
  async reset(identifier, endpoint) {
    const key = this.generateKey(identifier, endpoint)
    await this.client.del(key)
  }

  // Get current usage
  async getUsage(identifier, endpoint) {
    const key = this.generateKey(identifier, endpoint)
    const current = await this.client.get(key)
    const ttl = await this.client.ttl(key)

    return {
      current: current ? Number.parseInt(current) : 0,
      resetIn: ttl,
    }
  }

  async disconnect() {
    await this.client.quit()
  }
}

module.exports = RateLimiter
