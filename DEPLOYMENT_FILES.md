# 📦 ScoreSnap Deployment Files

This document provides an overview of all the deployment-related files created for your nginx server deployment.

## 📁 Files Created

### 🔧 Configuration Files

#### `web/ecosystem.config.js`
PM2 process manager configuration for the Next.js application.
- Runs Next.js in production mode
- Manages process restarts
- Configures logging
- Sets port to 3000

#### `nginx/scoresnap.conf`
Nginx reverse proxy configuration for scoresnap.wu.ly.
- HTTP configuration (port 80)
- HTTPS configuration (commented out, ready for SSL)
- Proxy settings for Next.js
- Static asset caching
- Image optimization support
- 20MB upload limit for bowling images

#### `web/env.production.example`
Template for production environment variables.
Copy this to `.env.local` on the server and fill in:
- Supabase URL and keys
- OpenAI API key
- Google Places API key

#### `web/next.config.js` (Updated)
Added production domains for Next.js image optimization:
- localhost
- scoresnap.wu.ly
- 192.168.1.80

### 🚀 Deployment Scripts

#### `deploy.sh`
Git-based deployment script for production deployments.
**Process:**
1. Builds locally to verify
2. SSHs into server
3. Pulls latest from git
4. Installs dependencies on server
5. Builds on server
6. Restarts with PM2

**When to use:** For final deployments and when you want to ensure git is the source of truth.

#### `deploy-local.sh`
Rsync-based deployment for faster development deployments.
**Process:**
1. Builds locally
2. Syncs files to server via rsync
3. Syncs .next build folder
4. Restarts with PM2

**When to use:** During active development for faster iteration.

#### `server-setup.sh`
One-time server setup automation script.
**What it does:**
- Installs Node.js and PM2
- Creates directory structure
- Clones repository
- Sets up environment variables
- Builds and starts application
- Configures nginx

**When to use:** First time setup on a new server.

### 📖 Documentation

#### `SERVER_SETUP.md`
Complete detailed guide for server setup and deployment.
**Covers:**
- Prerequisites and installation
- Step-by-step setup instructions
- Environment configuration
- Nginx configuration
- DNS and SSL setup
- Troubleshooting guide
- Security considerations

**Read this:** For comprehensive understanding of the deployment process.

#### `DEPLOYMENT_QUICKSTART.md`
Quick reference guide for common deployment tasks.
**Covers:**
- Quick start commands
- Common PM2 and nginx commands
- Troubleshooting quick fixes
- Monitoring commands

**Use this:** For day-to-day deployment operations.

#### `DEPLOYMENT_CHECKLIST.md`
Interactive checklist for deployment verification.
**Covers:**
- Pre-deployment checklist
- Server setup checklist
- Verification steps
- Post-deployment security
- Regular deployment steps
- Rollback procedures

**Use this:** To ensure nothing is missed during deployment.

## 🎯 Quick Start Guide

### First Time Setup

1. **On Server:**
   ```bash
   scp server-setup.sh YOUR_USERNAME@192.168.1.80:~/
   ssh YOUR_USERNAME@192.168.1.80
   chmod +x ~/server-setup.sh
   ./server-setup.sh
   ```

2. **Configure DNS:**
   Add CNAME/A record: `scoresnap.wu.ly` → `192.168.1.80`

3. **Test:**
   Open http://scoresnap.wu.ly in your browser

### Regular Deployments

**Option 1: Git-based (Recommended)**
```bash
# Edit deploy.sh first time to set SERVER_USER
./deploy.sh
```

**Option 2: Local build (Faster)**
```bash
# Edit deploy-local.sh first time to set SERVER_USER
./deploy-local.sh
```

## 🔑 Key Configuration Points

### You Need to Update These:

1. **`deploy.sh`**
   - Line 7: `SERVER_USER="YOUR_SERVER_USERNAME"`

2. **`deploy-local.sh`**
   - Line 7: `SERVER_USER="YOUR_SERVER_USERNAME"`

3. **On Server: `/var/www/scoresnap/web/.env.local`**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-actual-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-key
   OPENAI_API_KEY=your-actual-key
   GOOGLE_PLACES_API_KEY=your-actual-key
   ```

4. **DNS**
   - Point `scoresnap.wu.ly` to `192.168.1.80`

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    scoresnap.wu.ly                       │
│                    (192.168.1.80)                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   nginx     │
                    │   Port 80   │
                    └─────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Reverse Proxy Config  │
              │  (scoresnap.conf)      │
              └────────────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │      PM2       │
                  │ Process Manager│
                  └────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   Next.js App        │
                │   localhost:3000     │
                │   (scoresnap)        │
                └──────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    External Services   │
              │  - Supabase            │
              │  - OpenAI              │
              │  - Google Places       │
              └────────────────────────┘
```

## 🔄 Deployment Workflow

### Development → Production

1. **Develop locally**
   ```bash
   cd web
   npm run dev
   # Test at http://localhost:3000
   ```

2. **Commit changes**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

3. **Deploy**
   ```bash
   ./deploy.sh
   # or for faster iteration:
   ./deploy-local.sh
   ```

4. **Verify**
   - Check PM2: `ssh user@192.168.1.80 'pm2 status'`
   - Check logs: `ssh user@192.168.1.80 'pm2 logs scoresnap'`
   - Test site: http://scoresnap.wu.ly

## 🛠️ Common Tasks

### View Logs
```bash
ssh YOUR_USERNAME@192.168.1.80 'pm2 logs scoresnap'
```

### Restart App
```bash
ssh YOUR_USERNAME@192.168.1.80 'pm2 restart scoresnap'
```

### Update Environment Variables
```bash
ssh YOUR_USERNAME@192.168.1.80
nano /var/www/scoresnap/web/.env.local
# Make changes, then:
pm2 restart scoresnap
```

### Reload Nginx Config
```bash
ssh YOUR_USERNAME@192.168.1.80
sudo systemctl reload nginx
```

## 📚 Documentation Hierarchy

1. **Start here:** `DEPLOYMENT_QUICKSTART.md` - Quick reference
2. **Setup guide:** `SERVER_SETUP.md` - Detailed instructions
3. **Verification:** `DEPLOYMENT_CHECKLIST.md` - Don't miss steps
4. **Overview:** `DEPLOYMENT_FILES.md` (this file) - Understand structure

## 🆘 Getting Help

If something goes wrong:

1. Check `DEPLOYMENT_QUICKSTART.md` troubleshooting section
2. Review `SERVER_SETUP.md` troubleshooting section
3. Check logs:
   - Application: `pm2 logs scoresnap`
   - Nginx: `sudo tail -f /var/log/nginx/scoresnap_error.log`

## 🔒 Security Reminders

- ✅ Never commit `.env.local` to git
- ✅ Set up HTTPS with Let's Encrypt for production
- ✅ Keep Node.js and nginx updated
- ✅ Configure firewall (UFW) if needed
- ✅ Regular backups of Supabase data
- ✅ Use strong passwords for server access

## 📝 Notes

- The application runs on port 3000 internally
- Nginx proxies external requests (port 80/443) to port 3000
- PM2 keeps the application running and restarts on crashes
- Logs are stored in `/var/www/scoresnap/logs/`
- Next.js build artifacts are in `/var/www/scoresnap/web/.next/`

---

**Created:** November 2024
**Last Updated:** November 2024
**For:** ScoreSnap deployment on nginx server (192.168.1.80)

