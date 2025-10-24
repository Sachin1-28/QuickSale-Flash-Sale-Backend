# QuickSale Flash Sale Backend - Complete Setup Guide

## Project Overview

QuickSale is a microservice-based backend system for flash-sale scenarios with:
- Secure JWT authentication
- Concurrent inventory management
- Event-driven order processing
- Real-time WebSocket notifications
- API Gateway with rate limiting

## Prerequisites

- Node.js 16+
- MongoDB 5.0+
- Kafka 3.0+
- Redis 6.0+
- Docker & Docker Compose (optional)

## Installation Steps

### 1. Clone Repository
\`\`\`bash
git clone <repo-url>
cd quicksale-backend
npm install
\`\`\`

### 2. Configure Environment
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

### 3. Start Infrastructure (Docker)
\`\`\`bash
docker-compose up -d
\`\`\`

This starts:
- MongoDB on port 27017
- Kafka on port 9092
- Zookeeper on port 2181
- Redis on port 6379
- Kafka UI on port 8080

### 4. Start Services

**Terminal 1 - Auth Service**
\`\`\`bash
npm run auth-service
# Listening on port 3001
\`\`\`

**Terminal 2 - Inventory Service**
\`\`\`bash
npm run inventory-service
# Listening on port 3002
\`\`\`

**Terminal 3 - Order Service**
\`\`\`bash
npm run order-service
# Listening on port 3003
\`\`\`

**Terminal 4 - Kafka Processor**
\`\`\`bash
npm run kafka-processor
# Consuming events from Kafka
\`\`\`

**Terminal 5 - Notifier Service**
\`\`\`bash
npm run notifier-service
# WebSocket on port 3004
\`\`\`

**Terminal 6 - API Gateway**
\`\`\`bash
npm run api-gateway
# Gateway on port 3000
\`\`\`

## Complete Example Flow

### Step 1: Register User
\`\`\`bash
curl -X POST http://localhost:3000/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'

Response:
{
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
\`\`\`

### Step 2: Create Product
\`\`\`bash
curl -X POST http://localhost:3000/api/inventory/products \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Flash Sale Laptop",
    "description": "Limited time offer",
    "price": 799.99,
    "originalPrice": 1299.99,
    "stock": 50,
    "sku": "FLASH-LAPTOP-001",
    "category": "Electronics"
  }'

Response:
{
  "message": "Product created successfully",
  "product": {
    "_id": "product_id",
    "name": "Flash Sale Laptop",
    ...
  }
}
\`\`\`

### Step 3: Create Order
\`\`\`bash
curl -X POST http://localhost:3000/api/orders \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Idempotency-Key: order-001" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      {
        "productId": "product_id",
        "quantity": 1
      }
    ]
  }'

Response:
{
  "message": "Order created successfully",
  "order": {
    "_id": "order_id",
    "userId": "user_id",
    "items": [...],
    "totalAmount": 799.99,
    "status": "PENDING",
    "inventoryStatus": "PENDING",
    "idempotencyKey": "order-001",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
\`\`\`

### Step 4: Monitor Events

**Check Kafka Events (Kafka UI)**
- Navigate to http://localhost:8080
- View topics: order.created, inventory.result, order.status

**Check Order Status**
\`\`\`bash
curl -X GET http://localhost:3000/api/orders/order_id \\
  -H "Authorization: Bearer <accessToken>"

Response:
{
  "_id": "order_id",
  "status": "CONFIRMED",
  "inventoryStatus": "RESERVED",
  ...
}
\`\`\`

### Step 5: Connect WebSocket for Notifications
\`\`\`javascript
const token = "your_access_token"
const ws = new WebSocket(\`ws://localhost:3004?token=\${token}\`)

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log("Notification:", message)
  // Output:
  // {
  //   "type": "order.update",
  //   "data": {
  //     "orderId": "order_id",
  //     "status": "CONFIRMED",
  //     "message": "Your order has been confirmed"
  //   }
  // }
}
\`\`\`

## Database Schema Summary

### Users
- Email (unique)
- Password (hashed)
- Refresh tokens with expiry

### Products
- Name, description, price
- Stock & reserved quantities
- SKU (unique)
- Version (for optimistic locking)

### Orders
- User reference
- Items with product & quantity
- Status tracking
- Idempotency key (unique)
- Inventory status

### Outbox
- Event type & payload
- Published flag
- Retry tracking

### Notifications
- User reference
- Order reference
- Type & message
- Read status

## Event Topics

| Topic | Publisher | Consumer | Purpose |
|-------|-----------|----------|---------|
| order.created | Order Service | Inventory Service | Trigger stock reservation |
| inventory.result | Inventory Service | Order Service | Update order status |
| order.status | Order Service | Notifier Service | Send notifications |

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/auth/login | 5 | 60s |
| /api/auth/register | 3 | 60s |
| /api/orders | 10 | 60s |
| /api/inventory/reserve | 50 | 60s |
| Default | 100 | 60s |

## Monitoring & Debugging

### Health Checks
\`\`\`bash
# API Gateway
curl http://localhost:3000/health

# Auth Service
curl http://localhost:3001/health

# Notifier Service
curl http://localhost:3004/health
\`\`\`

### View Logs
\`\`\`bash
# All services log to console
# Check terminal output for service logs
\`\`\`

### Kafka UI
- Access at http://localhost:8080
- View topics, partitions, and messages

### MongoDB
\`\`\`bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/quicksale

# View collections
show collections

# Query orders
db.orders.find()
\`\`\`

## Troubleshooting

### Services won't start
- Check MongoDB is running: \`mongosh\`
- Check Kafka is running: \`docker ps\`
- Check Redis is running: \`redis-cli ping\`

### Rate limit errors
- Check Redis connection
- Verify REDIS_URL in .env

### WebSocket connection fails
- Verify JWT token is valid
- Check notifier service is running
- Check firewall allows port 3004

### Events not processing
- Check Kafka is running
- Verify topics exist in Kafka
- Check consumer group status

## Production Deployment

### Docker Compose Production
\`\`\`bash
docker-compose -f docker-compose.prod.yml up -d
\`\`\`

### Kubernetes
- Create deployments for each service
- Use ConfigMaps for environment variables
- Use Secrets for sensitive data
- Set up ingress for API Gateway

### Monitoring
- Implement Prometheus metrics
- Setup ELK stack for logging
- Configure alerts for errors
- Monitor Kafka lag

## Performance Optimization

1. **Database Indexing** - Already configured on key fields
2. **Connection Pooling** - Implemented in services
3. **Caching** - Use Redis for frequently accessed data
4. **Load Balancing** - Run multiple instances behind load balancer
5. **Kafka Partitioning** - Use orderId as partition key

## Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Enable HTTPS/TLS
- [ ] Setup firewall rules
- [ ] Enable MongoDB authentication
- [ ] Rotate refresh tokens regularly
- [ ] Implement CORS restrictions
- [ ] Setup rate limiting
- [ ] Enable request logging
- [ ] Regular security audits
- [ ] Keep dependencies updated

## Next Steps

1. Add comprehensive test suite
2. Implement circuit breaker pattern
3. Add distributed tracing
4. Setup CI/CD pipeline
5. Implement caching layer
6. Add API documentation (Swagger)
7. Setup monitoring & alerting
8. Performance testing & optimization
