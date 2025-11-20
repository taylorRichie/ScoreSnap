#!/bin/bash

# ScoreSnap Server Setup Script
# Run this on your server (192.168.1.80) for initial setup

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 ScoreSnap Server Setup${NC}"
echo ""

# Detect if we're running as root
if [ "$EUID" -eq 0 ]; then 
    SUDO_CMD=""
    echo -e "${BLUE}ℹ️  Running as root${NC}"
else
    SUDO_CMD="sudo"
    echo -e "${BLUE}ℹ️  Running as non-root user (will use sudo)${NC}"
fi

# Check if running on server
if [ ! -f "/etc/nginx/nginx.conf" ]; then
    echo -e "${YELLOW}⚠️  Warning: nginx doesn't seem to be installed${NC}"
    echo "This script should be run on your server at 192.168.1.80"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 1: Check for Node.js
echo -e "${BLUE}1️⃣  Checking Node.js installation...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js is installed: ${NODE_VERSION}${NC}"
else
    echo -e "${YELLOW}📦 Node.js not found. Installing via nvm...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 18
    nvm use 18
    echo -e "${GREEN}✅ Node.js installed${NC}"
fi

# Step 2: Check for PM2
echo -e "${BLUE}2️⃣  Checking PM2 installation...${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 is installed${NC}"
else
    echo -e "${YELLOW}📦 Installing PM2...${NC}"
    npm install -g pm2
    echo -e "${GREEN}✅ PM2 installed${NC}"
fi

# Step 3: Set up PM2 startup
echo -e "${BLUE}3️⃣  Setting up PM2 startup...${NC}"
pm2 startup | grep -v "PM2" | grep "sudo" | bash || true
echo -e "${GREEN}✅ PM2 startup configured${NC}"

# Step 4: Create directory structure
echo -e "${BLUE}4️⃣  Creating directory structure...${NC}"
mkdir -p /var/www/scoresnap
mkdir -p /var/www/scoresnap/logs
if [ -n "$SUDO_CMD" ]; then
    $SUDO_CMD chown -R $USER:$USER /var/www/scoresnap
fi
echo -e "${GREEN}✅ Directories created${NC}"

# Step 5: Check if repo is cloned
echo -e "${BLUE}5️⃣  Checking repository...${NC}"
if [ -d "/var/www/scoresnap/.git" ]; then
    echo -e "${GREEN}✅ Repository already cloned${NC}"
    cd /var/www/scoresnap
    echo -e "${BLUE}📥 Pulling latest changes...${NC}"
    git pull origin main
else
    echo -e "${YELLOW}📥 Repository not found${NC}"
    
    # Check if directory exists but is not a git repo
    if [ -d "/var/www/scoresnap" ] && [ "$(ls -A /var/www/scoresnap)" ]; then
        echo -e "${RED}⚠️  Directory /var/www/scoresnap exists but is not a git repository${NC}"
        echo ""
        read -p "Do you want to remove it and clone fresh? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}🗑️  Removing existing directory...${NC}"
            rm -rf /var/www/scoresnap
        else
            echo -e "${RED}❌ Cannot proceed without a clean directory${NC}"
            exit 1
        fi
    fi
    
    echo ""
    read -p "Enter your git repository URL: " REPO_URL
    cd /var/www
    git clone $REPO_URL scoresnap
    cd scoresnap
    echo -e "${GREEN}✅ Repository cloned${NC}"
fi

# Step 6: Set up environment variables
echo -e "${BLUE}6️⃣  Setting up environment variables...${NC}"
if [ ! -f "/var/www/scoresnap/web/.env.local" ]; then
    echo -e "${YELLOW}📝 Creating .env.local file...${NC}"
    cp /var/www/scoresnap/web/env.production.example /var/www/scoresnap/web/.env.local
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: You need to edit .env.local with your actual API keys!${NC}"
    echo ""
    read -p "Open .env.local in nano now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        nano /var/www/scoresnap/web/.env.local
    fi
else
    echo -e "${GREEN}✅ .env.local already exists${NC}"
fi

# Step 7: Install dependencies and build
echo -e "${BLUE}7️⃣  Installing dependencies and building...${NC}"
cd /var/www/scoresnap/web
npm install
npm run build
echo -e "${GREEN}✅ Build completed${NC}"

# Step 8: Start with PM2
echo -e "${BLUE}8️⃣  Starting application with PM2...${NC}"
cd /var/www/scoresnap/web
pm2 start ecosystem.config.js
pm2 save
echo -e "${GREEN}✅ Application started${NC}"

# Step 9: Configure nginx
echo -e "${BLUE}9️⃣  Configuring nginx...${NC}"
if [ -f "/etc/nginx/sites-available/scoresnap.conf" ]; then
    echo -e "${GREEN}✅ nginx config already exists${NC}"
else
    $SUDO_CMD cp /var/www/scoresnap/nginx/scoresnap.conf /etc/nginx/sites-available/scoresnap.conf
    $SUDO_CMD ln -s /etc/nginx/sites-available/scoresnap.conf /etc/nginx/sites-enabled/scoresnap.conf
    echo -e "${GREEN}✅ nginx config created${NC}"
fi

# Test nginx config
echo -e "${BLUE}🧪 Testing nginx configuration...${NC}"
$SUDO_CMD nginx -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ nginx config is valid${NC}"
    echo -e "${BLUE}♻️  Reloading nginx...${NC}"
    $SUDO_CMD systemctl reload nginx
    echo -e "${GREEN}✅ nginx reloaded${NC}"
else
    echo -e "${RED}❌ nginx config has errors. Please fix manually.${NC}"
fi

# Final status
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}📊 Application Status:${NC}"
pm2 status

echo ""
echo -e "${BLUE}🌐 Your app should be available at:${NC}"
echo -e "   http://scoresnap.wu.ly"
echo -e "   http://192.168.1.80"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "1. Make sure DNS is configured for scoresnap.wu.ly"
echo "2. Consider setting up SSL/HTTPS (see SERVER_SETUP.md)"
echo "3. Test the application in your browser"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "   pm2 status              # Check app status"
echo "   pm2 logs scoresnap      # View logs"
echo "   pm2 restart scoresnap   # Restart app"
echo ""
echo -e "${BLUE}📖 For more info, see:${NC}"
echo "   /var/www/scoresnap/SERVER_SETUP.md"
echo "   /var/www/scoresnap/DEPLOYMENT_QUICKSTART.md"

