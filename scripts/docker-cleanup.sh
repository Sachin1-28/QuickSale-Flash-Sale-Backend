#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}QuickSale - Docker Cleanup${NC}"
echo "============================"

echo -e "${YELLOW}Stopping all services...${NC}"
docker-compose down

echo -e "${YELLOW}Removing volumes...${NC}"
docker-compose down -v

echo -e "${GREEN}Cleanup completed!${NC}"
