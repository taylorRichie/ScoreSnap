#!/bin/bash

# ScoreSnap Deployment Script
# This script deploys the latest version of ScoreSnap to your nginx server

set -e  # Exit on error

# Configuration
SERVER_USER="root"
SERVER_HOST="192.168.1.80"
SERVER_PATH="/var/www/scoresnap"
APP_NAME="scoresnap"

echo "🚀 Starting ScoreSnap deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build locally
echo -e "${BLUE}📦 Building Next.js application...${NC}"
cd web
npm install
npm run build
cd ..

# Step 2: SSH into server and update
echo -e "${BLUE}🔄 Deploying to server...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
    set -e
    
    echo "📥 Pulling latest changes..."
    cd /var/www/scoresnap
    git pull origin main
    
    echo "📦 Installing dependencies..."
    cd web
    npm install --production
    
    echo "🔨 Building application..."
    npm run build
    
    echo "♻️  Restarting application..."
    pm2 restart scoresnap || pm2 start ecosystem.config.js
    pm2 save
    
    echo "✅ Deployment complete!"
    pm2 status scoresnap
ENDSSH

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${YELLOW}🌐 Your app should be available at: http://scoresnap.wu.ly${NC}"

