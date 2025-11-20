#!/bin/bash

# ScoreSnap Local Deployment Script
# This script syncs your local changes to the server (faster than git)

set -e  # Exit on error

# Configuration
SERVER_USER="root"
SERVER_HOST="192.168.1.80"
SERVER_PATH="/var/www/scoresnap"
APP_NAME="scoresnap"

echo "🚀 Starting ScoreSnap local deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build locally
echo -e "${BLUE}📦 Building Next.js application locally...${NC}"
cd web
npm install
npm run build
cd ..

# Step 2: Sync files to server (excluding node_modules and .next)
echo -e "${BLUE}📤 Syncing files to server...${NC}"
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude 'uploads' \
    --exclude '.env.local' \
    --exclude 'logs' \
    ./ ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/

# Step 3: Copy .next build folder
echo -e "${BLUE}📤 Syncing build folder...${NC}"
rsync -avz --delete \
    web/.next/ ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/web/.next/

# Step 4: Copy node_modules (only if needed - first time setup)
# Uncomment this if you need to sync node_modules
# echo -e "${BLUE}📤 Syncing dependencies (this may take a while)...${NC}"
# rsync -avz --delete \
#     web/node_modules/ ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/web/node_modules/

# Step 5: Restart the application
echo -e "${BLUE}♻️  Restarting application on server...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
    set -e
    
    cd /var/www/scoresnap/web
    
    # Install dependencies if package.json changed
    npm install --production
    
    # Restart with PM2
    pm2 restart scoresnap || pm2 start ../web/ecosystem.config.js
    pm2 save
    
    echo "✅ Application restarted!"
    pm2 status scoresnap
ENDSSH

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${YELLOW}🌐 Your app should be available at: http://scoresnap.wu.ly${NC}"
echo ""
echo -e "${BLUE}📊 To view logs:${NC}"
echo "ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 logs scoresnap'"

