# ScoreSnap Web Application

A Next.js application for capturing and analyzing bowling scoreboard images using OpenAI Vision API.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Run health check to verify everything is working:**
   ```bash
   npm run health-check
   ```

## 🔍 Health Check (Preventing Styling Regressions)

This project includes an automated health check script to prevent styling regressions where Next.js static assets (CSS/JS) fail to load.

### What it checks:
- ✅ Root page loads (`/`)
- ✅ Dashboard page loads (`/dashboard`)
- ✅ CSS assets are served (`/_next/static/css/app/layout.css`)
- ✅ JavaScript chunks are served (`/_next/static/chunks/main-app.js`)
- ✅ Authentication pages load (`/auth/login`)

### Common Issues & Fixes:

#### Styling Not Loading (404 on CSS/JS assets)
**Symptoms:** Pages load as plain HTML without styles, console shows 404 errors for `layout.css`, `main-app.js`, etc.

**Causes:**
- Multiple Next.js servers running simultaneously
- Stale build cache (`.next` directory)
- Server not fully started

**Quick Fix:**
```bash
# Kill all Next.js processes
pkill -f "next dev"

# Clear cache and restart
rm -rf .next
npm run dev
```

**Prevention:**
Run the health check after starting the server:
```bash
npm run health-check
```

If any checks fail, the script will provide specific guidance on what to fix.

### Running Health Check Programmatically

The health check can be integrated into CI/CD pipelines or run manually:

```bash
# Via npm script
npm run health-check

# Directly
node test-health-check.js

# With custom timeout (default 5s)
TIMEOUT=10000 node test-health-check.js
```

## 🏗️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run health-check` - Verify server is serving assets correctly

### Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── auth/           # Authentication pages
│   ├── dashboard/      # Main dashboard
│   ├── upload/         # File upload interface
│   ├── sessions/       # Session management
│   └── bowlers/        # Bowler profiles
├── components/         # Reusable components
├── lib/               # Utility functions and API clients
├── types/             # TypeScript type definitions
└── utils/             # Helper utilities
```

## 🔧 Troubleshooting

### Build Issues
```bash
# Clear all caches
rm -rf .next node_modules/.cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Database Issues
Ensure Supabase local development server is running:
```bash
supabase start
```

### Port Conflicts
If port 3000 is in use:
```bash
# Find process using port 3000
lsof -ti:3000 | xargs kill -9

# Or run on different port
PORT=3001 npm run dev
```

## 📝 Development Guidelines

### Preventing Static Asset Issues

1. **Always run health check after server start:**
   ```bash
   npm run health-check
   ```

2. **Clear cache when switching branches:**
   ```bash
   rm -rf .next
   ```

3. **Single server instance:** Only run one `npm run dev` at a time

4. **Check console for 404 errors** on CSS/JS assets and run health check if found

### Code Quality

- Run `npm run lint` before committing
- Run `npm run type-check` to verify TypeScript
- Use the health check script in CI/CD pipelines

## 🎯 Features

- 📸 Upload bowling scoreboard images
- 🤖 AI-powered score extraction using OpenAI Vision
- 👥 Bowler profile management
- 📊 Session and team statistics
- 🔐 User authentication
- 📱 Mobile-responsive design

## 🚀 Deployment

Build for production:
```bash
npm run build
npm run start
```

The health check script can be run in production to verify assets are being served correctly by your hosting platform.
