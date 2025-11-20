# ScoreSnap Server Setup Guide

This guide will help you deploy ScoreSnap to your nginx server at 192.168.1.80.

## Prerequisites on Server

Your server (192.168.1.80) needs:
- Node.js 18+ and npm
- nginx
- PM2 (process manager)
- Git

## Step 1: Initial Server Setup

SSH into your server:

```bash
ssh YOUR_USERNAME@192.168.1.80
```

### Install Node.js (if not already installed)

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Or use your package manager
# Ubuntu/Debian:
# curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
# sudo apt-get install -y nodejs
```

### Install PM2

```bash
npm install -g pm2
pm2 startup  # Follow the instructions to enable PM2 on system boot
```

### Create directory structure

```bash
sudo mkdir -p /var/www/scoresnap
sudo mkdir -p /var/www/scoresnap/logs
sudo chown -R $USER:$USER /var/www/scoresnap
```

### Clone the repository

```bash
cd /var/www
git clone YOUR_REPO_URL scoresnap
cd scoresnap
```

## Step 2: Configure Environment Variables

Create the production environment file on the server:

```bash
cd /var/www/scoresnap/web
cp .env.production .env.local
nano .env.local  # Or use vim, vi, etc.
```

Edit `.env.local` with your production values:

```bash
# Supabase Configuration (Production)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Google Places API Configuration
GOOGLE_PLACES_API_KEY=your-google-places-api-key

# Production
NODE_ENV=production
PORT=3000
```

## Step 3: Initial Build and Start

```bash
cd /var/www/scoresnap/web
npm install
npm run build
pm2 start ecosystem.config.js
pm2 save
```

Verify it's running:

```bash
pm2 status
pm2 logs scoresnap  # Check logs
curl http://localhost:3000  # Test locally
```

## Step 4: Configure Nginx

### Copy nginx configuration

```bash
sudo cp /var/www/scoresnap/nginx/scoresnap.conf /etc/nginx/sites-available/scoresnap.conf
```

### Edit the configuration if needed

```bash
sudo nano /etc/nginx/sites-available/scoresnap.conf
```

### Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/scoresnap.conf /etc/nginx/sites-enabled/
```

### Test nginx configuration

```bash
sudo nginx -t
```

### Reload nginx

```bash
sudo systemctl reload nginx
```

## Step 5: DNS Configuration

Set up your CNAME record:

**DNS Settings:**
- Type: CNAME or A Record
- Name: scoresnap.wu.ly
- Value: 192.168.1.80 (or your router's public IP if external)
- TTL: 3600 (or default)

**If using local DNS/hosts file for testing:**

On your local machine (Mac), edit `/etc/hosts`:

```bash
sudo nano /etc/hosts
```

Add:

```
192.168.1.80    scoresnap.wu.ly
```

## Step 6: SSL/HTTPS Setup (Optional but Recommended)

If you want HTTPS (after DNS is working):

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d scoresnap.wu.ly

# Certbot will automatically configure nginx for HTTPS
# Follow the prompts and select option to redirect HTTP to HTTPS
```

**Note:** Let's Encrypt requires your domain to be publicly accessible. If this is only local, you can:
1. Use a self-signed certificate
2. Skip HTTPS for local deployment
3. Use a service like ngrok for temporary public access

### Self-signed certificate (for local testing):

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/scoresnap.key \
    -out /etc/nginx/ssl/scoresnap.crt

# Then update the nginx config to use these certificates
```

## Step 7: Verify Deployment

1. Check PM2 status:
```bash
pm2 status
```

2. Check nginx status:
```bash
sudo systemctl status nginx
```

3. View application logs:
```bash
pm2 logs scoresnap
```

4. Test the application:
```bash
curl http://scoresnap.wu.ly
```

5. Open in browser:
```
http://scoresnap.wu.ly
```

## Deployment from Local Machine

Now that the server is set up, you can deploy from your local machine.

### Option 1: Git-based Deployment (Recommended for production)

1. Edit `deploy.sh` and set your username:
```bash
SERVER_USER="your_username"  # Change this
```

2. Make it executable:
```bash
chmod +x deploy.sh
```

3. Run deployment:
```bash
./deploy.sh
```

This will:
- Pull latest changes from git
- Install dependencies on server
- Build on server
- Restart the application

### Option 2: Local Build + Rsync (Faster for development)

1. Edit `deploy-local.sh` and set your username:
```bash
SERVER_USER="your_username"  # Change this
```

2. Make it executable:
```bash
chmod +x deploy-local.sh
```

3. Run deployment:
```bash
./deploy-local.sh
```

This will:
- Build locally
- Sync files to server
- Restart the application

This is faster because building happens on your local machine.

## Useful PM2 Commands

```bash
# On the server:
pm2 status              # View all processes
pm2 logs scoresnap      # View logs (follow mode)
pm2 logs scoresnap --lines 100  # View last 100 lines
pm2 restart scoresnap   # Restart the app
pm2 stop scoresnap      # Stop the app
pm2 start scoresnap     # Start the app
pm2 delete scoresnap    # Remove from PM2
pm2 monit              # Monitor in real-time
```

## Troubleshooting

### Application won't start

Check logs:
```bash
pm2 logs scoresnap
cat /var/www/scoresnap/logs/err.log
```

Common issues:
- Missing environment variables in `.env.local`
- Port 3000 already in use
- Node modules not installed

### Nginx 502 Bad Gateway

- Check if Next.js is running: `pm2 status`
- Check if port 3000 is listening: `netstat -tlnp | grep 3000`
- Check nginx error logs: `sudo tail -f /var/log/nginx/scoresnap_error.log`

### Cannot connect to site

- Verify nginx is running: `sudo systemctl status nginx`
- Check firewall: `sudo ufw status` (allow port 80 and 443 if enabled)
- Verify DNS: `ping scoresnap.wu.ly`
- Check nginx config: `sudo nginx -t`

### Permission issues

```bash
# Fix ownership
sudo chown -R $USER:$USER /var/www/scoresnap

# Fix log directory
sudo mkdir -p /var/www/scoresnap/logs
sudo chown -R $USER:$USER /var/www/scoresnap/logs
```

## Updating Next.js Configuration for Production

You may need to update `next.config.js` to allow your domain for images:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'scoresnap.wu.ly'],
  },
}

module.exports = nextConfig
```

## Security Considerations

1. **Environment Variables:** Never commit `.env.local` to git
2. **Firewall:** Consider enabling UFW and only allowing necessary ports
3. **HTTPS:** Use SSL/TLS in production
4. **Updates:** Keep Node.js, nginx, and dependencies updated
5. **Monitoring:** Set up PM2 monitoring and alerts

## Backup Strategy

Consider setting up automated backups for:
- Supabase database (Supabase handles this)
- Uploaded images (if stored locally)
- Environment variables (`.env.local`)

## Resources

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)

