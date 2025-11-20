# ScoreSnap Deployment Quick Reference

## 🚀 Quick Start

### First Time Setup (One-time on server)

1. **SSH into your server:**
```bash
ssh YOUR_USERNAME@192.168.1.80
```

2. **Install prerequisites:**
```bash
# Install Node.js 18+
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Install PM2
npm install -g pm2
pm2 startup
```

3. **Create directories and clone repo:**
```bash
sudo mkdir -p /var/www/scoresnap
sudo chown -R $USER:$USER /var/www/scoresnap
cd /var/www
git clone YOUR_REPO_URL scoresnap
cd scoresnap
```

4. **Set up environment variables:**
```bash
cd /var/www/scoresnap/web
cp env.production.example .env.local
nano .env.local  # Fill in your actual API keys
```

5. **Build and start:**
```bash
npm install
npm run build
pm2 start ecosystem.config.js
pm2 save
```

6. **Configure nginx:**
```bash
sudo cp /var/www/scoresnap/nginx/scoresnap.conf /etc/nginx/sites-available/scoresnap.conf
sudo ln -s /etc/nginx/sites-available/scoresnap.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

7. **Set up DNS:**
   - Add CNAME or A record pointing `scoresnap.wu.ly` to `192.168.1.80`
   - Or for local testing, add to `/etc/hosts`:
   ```
   192.168.1.80    scoresnap.wu.ly
   ```

✅ Visit: http://scoresnap.wu.ly

---

## 📦 Regular Deployments

### Option 1: Git-based Deployment (Recommended)

Edit `deploy.sh` first time to set your username, then:

```bash
./deploy.sh
```

This pulls from git, builds on server, and restarts the app.

### Option 2: Local Build + Rsync (Faster)

Edit `deploy-local.sh` first time to set your username, then:

```bash
./deploy-local.sh
```

This builds locally, syncs to server, and restarts the app. Faster but uses your local machine's resources.

---

## 🔧 Common Commands

### On Your Local Machine

```bash
# Deploy using git
./deploy.sh

# Deploy using local build
./deploy-local.sh

# SSH into server
ssh YOUR_USERNAME@192.168.1.80
```

### On the Server

```bash
# PM2 commands
pm2 status              # Check status
pm2 logs scoresnap      # View logs
pm2 restart scoresnap   # Restart app
pm2 stop scoresnap      # Stop app
pm2 start scoresnap     # Start app

# Nginx commands
sudo systemctl status nginx
sudo systemctl reload nginx
sudo systemctl restart nginx
sudo nginx -t           # Test config

# View logs
tail -f /var/www/scoresnap/logs/combined.log
tail -f /var/log/nginx/scoresnap_error.log
```

---

## 🐛 Troubleshooting

### App won't start
```bash
pm2 logs scoresnap
cat /var/www/scoresnap/logs/err.log
```

### 502 Bad Gateway
```bash
pm2 status                          # Is app running?
netstat -tlnp | grep 3000          # Is port 3000 listening?
sudo tail -f /var/log/nginx/scoresnap_error.log
```

### Permission issues
```bash
sudo chown -R $USER:$USER /var/www/scoresnap
```

### After making changes to env variables
```bash
# On server
pm2 restart scoresnap
```

---

## 📁 Important Files

- `deploy.sh` - Git-based deployment script
- `deploy-local.sh` - Local build + rsync deployment script
- `nginx/scoresnap.conf` - Nginx configuration
- `web/ecosystem.config.js` - PM2 process configuration
- `SERVER_SETUP.md` - Full detailed setup guide
- `web/.env.local` (on server only) - Production environment variables

---

## 🔒 Security Notes

1. **Never commit** `.env.local` to git
2. Set up **HTTPS** with Let's Encrypt for production
3. Keep **Node.js and nginx updated**
4. Configure **firewall** if needed (UFW)
5. Regular **backups** of Supabase data

---

## 📊 Monitoring

View real-time app status:
```bash
ssh YOUR_USERNAME@192.168.1.80 'pm2 monit'
```

View recent logs:
```bash
ssh YOUR_USERNAME@192.168.1.80 'pm2 logs scoresnap --lines 50'
```

---

## 🆘 Need Help?

See `SERVER_SETUP.md` for the complete detailed guide with troubleshooting steps.

