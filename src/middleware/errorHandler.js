const errorHandler = (err, req, res, next) => {
  console.error("Error:", err)

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation error",
      details: Object.values(err.errors).map((e) => e.message),
    })
  }

  if (err.name === "MongoError" && err.code === 11000) {
    return res.status(409).json({
      error: "Duplicate entry",
      field: Object.keys(err.keyPattern)[0],
    })
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  })
}

module.exports = errorHandler
