# 🚀 ScoreSnap Deployment Checklist

Use this checklist to ensure your deployment is complete and working correctly.

## Pre-Deployment Checklist

### On Your Local Machine

- [ ] Git repository is up to date
  ```bash
  git status
  git add .
  git commit -m "Deployment setup"
  git push origin main
  ```

- [ ] Update deployment scripts with your server username
  - [ ] Edit `deploy.sh` - Set `SERVER_USER="your_username"`
  - [ ] Edit `deploy-local.sh` - Set `SERVER_USER="your_username"`

- [ ] Scripts are executable
  ```bash
  chmod +x deploy.sh deploy-local.sh server-setup.sh
  ```

### DNS Configuration

- [ ] Set up DNS for `scoresnap.wu.ly`
  - Option A: Add CNAME/A record at your DNS provider
  - Option B: Add to `/etc/hosts` for local testing:
    ```
    192.168.1.80    scoresnap.wu.ly
    ```

## Server Setup Checklist

### Initial Server Setup (One-time)

SSH into server: `ssh YOUR_USERNAME@192.168.1.80`

#### Option A: Automated Setup (Recommended)

- [ ] Copy setup script to server
  ```bash
  scp server-setup.sh YOUR_USERNAME@192.168.1.80:~/
  ```

- [ ] Run setup script on server
  ```bash
  ssh YOUR_USERNAME@192.168.1.80
  chmod +x ~/server-setup.sh
  ./server-setup.sh
  ```

#### Option B: Manual Setup

- [ ] Install Node.js 18+
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  source ~/.bashrc
  nvm install 18
  nvm use 18
  ```

- [ ] Install PM2
  ```bash
  npm install -g pm2
  pm2 startup
  ```

- [ ] Create directories
  ```bash
  sudo mkdir -p /var/www/scoresnap
  sudo chown -R $USER:$USER /var/www/scoresnap
  ```

- [ ] Clone repository
  ```bash
  cd /var/www
  git clone YOUR_REPO_URL scoresnap
  ```

- [ ] Configure environment variables
  ```bash
  cd /var/www/scoresnap/web
  cp env.production.example .env.local
  nano .env.local
  ```

- [ ] Fill in all environment variables:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `OPENAI_API_KEY`
  - [ ] `GOOGLE_PLACES_API_KEY`

- [ ] Build and start application
  ```bash
  cd /var/www/scoresnap/web
  npm install
  npm run build
  pm2 start ecosystem.config.js
  pm2 save
  ```

- [ ] Configure nginx
  ```bash
  sudo cp /var/www/scoresnap/nginx/scoresnap.conf /etc/nginx/sites-available/
  sudo ln -s /etc/nginx/sites-available/scoresnap.conf /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl reload nginx
  ```

## Verification Checklist

### On Server

- [ ] PM2 shows app running
  ```bash
  pm2 status
  # Should show "scoresnap" with status "online"
  ```

- [ ] App responds on localhost
  ```bash
  curl http://localhost:3000
  # Should return HTML
  ```

- [ ] Nginx is running
  ```bash
  sudo systemctl status nginx
  # Should be "active (running)"
  ```

- [ ] Nginx config is valid
  ```bash
  sudo nginx -t
  # Should show "test is successful"
  ```

- [ ] No errors in logs
  ```bash
  pm2 logs scoresnap --lines 20
  ```

### From Your Local Machine

- [ ] DNS resolves correctly
  ```bash
  ping scoresnap.wu.ly
  # Should show 192.168.1.80
  ```

- [ ] Site is accessible
  ```bash
  curl http://scoresnap.wu.ly
  # Should return HTML
  ```

- [ ] Open in browser: http://scoresnap.wu.ly
  - [ ] Homepage loads
  - [ ] Can sign up/log in
  - [ ] Can upload an image
  - [ ] Theme switcher works
  - [ ] All pages load correctly

## Post-Deployment Checklist

### Security

- [ ] SSL/HTTPS configured (optional but recommended)
  ```bash
  sudo certbot --nginx -d scoresnap.wu.ly
  ```

- [ ] Firewall configured (if using UFW)
  ```bash
  sudo ufw allow 22    # SSH
  sudo ufw allow 80    # HTTP
  sudo ufw allow 443   # HTTPS
  sudo ufw enable
  ```

- [ ] Verify `.env.local` is not committed to git
  ```bash
  git status  # Should not show .env.local
  ```

### Monitoring

- [ ] PM2 monitoring is set up
  ```bash
  pm2 monit
  ```

- [ ] Can view logs remotely
  ```bash
  ssh YOUR_USERNAME@192.168.1.80 'pm2 logs scoresnap'
  ```

### Documentation

- [ ] Team knows how to deploy updates
- [ ] Environment variables are documented (securely)
- [ ] Backup procedures are in place

## Regular Deployment Checklist

When deploying updates:

- [ ] Test locally first
  ```bash
  cd web
  npm install
  npm run build
  npm start
  ```

- [ ] Commit and push changes
  ```bash
  git add .
  git commit -m "Your change description"
  git push origin main
  ```

- [ ] Deploy to server
  ```bash
  ./deploy.sh
  # or
  ./deploy-local.sh
  ```

- [ ] Verify deployment
  - [ ] Check PM2 status: `ssh YOUR_USERNAME@192.168.1.80 'pm2 status'`
  - [ ] Check site loads: http://scoresnap.wu.ly
  - [ ] Test critical features

## Troubleshooting Checklist

If something goes wrong:

- [ ] Check PM2 status
  ```bash
  pm2 status
  ```

- [ ] Check application logs
  ```bash
  pm2 logs scoresnap
  ```

- [ ] Check nginx error logs
  ```bash
  sudo tail -f /var/log/nginx/scoresnap_error.log
  ```

- [ ] Verify environment variables
  ```bash
  cat /var/www/scoresnap/web/.env.local
  ```

- [ ] Check port 3000 is listening
  ```bash
  netstat -tlnp | grep 3000
  ```

- [ ] Restart services
  ```bash
  pm2 restart scoresnap
  sudo systemctl restart nginx
  ```

## Rollback Checklist

If you need to rollback:

- [ ] SSH into server
  ```bash
  ssh YOUR_USERNAME@192.168.1.80
  ```

- [ ] Go to app directory
  ```bash
  cd /var/www/scoresnap
  ```

- [ ] Checkout previous version
  ```bash
  git log --oneline -n 10  # Find commit to rollback to
  git checkout <commit-hash>
  ```

- [ ] Rebuild and restart
  ```bash
  cd web
  npm install
  npm run build
  pm2 restart scoresnap
  ```

## Resources

- **Full Setup Guide:** `SERVER_SETUP.md`
- **Quick Reference:** `DEPLOYMENT_QUICKSTART.md`
- **Deployment Scripts:** `deploy.sh`, `deploy-local.sh`
- **Server Setup Script:** `server-setup.sh`

---

## Quick Commands Reference

```bash
# Deploy (from local machine)
./deploy.sh

# View logs (from local machine)
ssh YOUR_USERNAME@192.168.1.80 'pm2 logs scoresnap'

# Restart app (on server)
pm2 restart scoresnap

# Check status (on server)
pm2 status

# View nginx logs (on server)
sudo tail -f /var/log/nginx/scoresnap_error.log
```

