const express = require("express")
const jwt = require("jsonwebtoken")
const User = require("../../models/User")
const authMiddleware = require("../../middleware/auth")
const Joi = require("joi")

const router = express.Router()

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
})

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
})

// Helper function to generate tokens
const generateTokens = (userId, email) => {
  const accessToken = jwt.sign({ userId, email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || "15m",
  })

  const refreshToken = jwt.sign({ userId, email }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d",
  })

  return { accessToken, refreshToken }
}

// Register endpoint
router.post("/register", async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ error: error.details[0].message })
    }

    const { email, password, firstName, lastName } = value

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" })
    }

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
    })

    await user.save()

    const { accessToken, refreshToken } = generateTokens(user._id, user.email)
    await user.addRefreshToken(refreshToken)

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    next(error)
  }
})

// Login endpoint
router.post("/login", async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ error: error.details[0].message })
    }

    const { email, password } = value

    // Find user
    const user = await User.findOne({ email })
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const { accessToken, refreshToken } = generateTokens(user._id, user.email)
    await user.addRefreshToken(refreshToken)

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      accessToken,
      refreshToken,
    })
  } catch (error) {
    next(error)
  }
})

// Refresh token endpoint
router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" })
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
    const user = await User.findById(decoded.userId)

    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }

    // Check if refresh token exists
    const tokenExists = user.refreshTokens.some((rt) => rt.token === refreshToken)
    if (!tokenExists) {
      return res.status(401).json({ error: "Invalid refresh token" })
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, user.email)
    await user.removeRefreshToken(refreshToken)
    await user.addRefreshToken(newRefreshToken)

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    })
  } catch (error) {
    next(error)
  }
})

// Logout endpoint
router.post("/logout", authMiddleware, async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" })
    }

    const user = await User.findById(req.user.userId)
    await user.removeRefreshToken(refreshToken)

    res.json({ message: "Logout successful" })
  } catch (error) {
    next(error)
  }
})

// Get current user endpoint
router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("-password -refreshTokens")
    res.json(user)
  } catch (error) {
    next(error)
  }
})

module.exports = router
