#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}QuickSale Flash Sale Backend - Docker Setup${NC}"
echo "================================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}Docker and Docker Compose are installed${NC}"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}.env file created${NC}"
fi

# Build images
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Docker images built successfully${NC}"
else
    echo -e "${RED}Failed to build Docker images${NC}"
    exit 1
fi

# Start services
echo -e "${YELLOW}Starting services...${NC}"
docker-compose up -d

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Services started successfully${NC}"
    echo ""
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
    sleep 10
    
    # Check service health
    echo ""
    echo -e "${YELLOW}Service Status:${NC}"
    docker-compose ps
    
    echo ""
    echo -e "${GREEN}QuickSale Backend is ready!${NC}"
    echo ""
    echo -e "${YELLOW}Available Services:${NC}"
    echo "  API Gateway:        http://localhost:3000"
    echo "  Auth Service:       http://localhost:3001"
    echo "  Inventory Service:  http://localhost:3002"
    echo "  Order Service:      http://localhost:3003"
    echo "  Notifier Service:   http://localhost:3004 (WebSocket)"
    echo ""
    echo -e "${YELLOW}Databases:${NC}"
    echo "  MongoDB:  mongodb://admin:admin123@localhost:27017/quicksale"
    echo "  Redis:    redis://localhost:6379"
    echo "  Kafka:    localhost:9092"
    echo ""
    echo -e "${YELLOW}Useful Commands:${NC}"
    echo "  View logs:          docker-compose logs -f [service-name]"
    echo "  Stop services:      docker-compose down"
    echo "  Remove volumes:     docker-compose down -v"
    echo "  Rebuild services:   docker-compose build --no-cache"
else
    echo -e "${RED}Failed to start services${NC}"
    exit 1
fi
