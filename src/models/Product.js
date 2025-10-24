const mongoose = require("mongoose")

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 0, // For optimistic locking
    },
  },
  { timestamps: true },
)

// Index for concurrent access
productSchema.index({ sku: 1 })
productSchema.index({ isActive: 1 })

// Method to get available stock
productSchema.methods.getAvailableStock = function () {
  return this.stock - this.reserved
}

// Method to reserve stock (with optimistic locking)
productSchema.methods.reserveStock = async function (quantity, expectedVersion) {
  const Product = mongoose.model("Product")

  // Fetch latest version
  const latestProduct = await Product.findById(this._id)

  // Check version for optimistic locking
  if (latestProduct.version !== expectedVersion) {
    throw new Error("Product version mismatch - concurrent modification detected")
  }

  // Check available stock
  if (latestProduct.getAvailableStock() < quantity) {
    throw new Error("Insufficient stock available")
  }

  // Update with version increment
  const result = await Product.findByIdAndUpdate(
    this._id,
    {
      $inc: { reserved: quantity, version: 1 },
    },
    { new: true },
  )

  return result
}

// Method to release reserved stock
productSchema.methods.releaseStock = async function (quantity) {
  const Product = mongoose.model("Product")
  const result = await Product.findByIdAndUpdate(
    this._id,
    {
      $inc: { reserved: -quantity, version: 1 },
    },
    { new: true },
  )
  return result
}

// Method to confirm stock (move from reserved to sold)
productSchema.methods.confirmStock = async function (quantity) {
  const Product = mongoose.model("Product")
  const result = await Product.findByIdAndUpdate(
    this._id,
    {
      $inc: { stock: -quantity, reserved: -quantity, version: 1 },
    },
    { new: true },
  )
  return result
}

module.exports = mongoose.model("Product", productSchema)
