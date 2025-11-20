# 🎳 ScoreSnap

**AI-powered bowling score tracking made simple.**

ScoreSnap is a modern web application that uses AI vision to automatically extract bowling scores from scoreboard photos. Simply snap a picture of the bowling alley's digital scoreboard, and ScoreSnap will parse all the data, track your games, and provide detailed statistics over time.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-14.1.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)

---

## ✨ Features

- 📸 **AI Vision Parsing** - Upload scorecard photos and let OpenAI Vision extract all the data
- 🏆 **Game Tracking** - Automatically track games, series, and sessions
- 👥 **Bowler Profiles** - Manage bowler stats, averages, and history
- 🎯 **Team Management** - Track team scores and competitions
- 🗺️ **Bowling Alley Detection** - GPS-based alley identification using Google Places API
- 📊 **Statistics Dashboard** - View detailed stats, trends, and performance analytics
- 🔐 **User Authentication** - Secure authentication with Supabase Auth
- 🎨 **Modern UI** - Beautiful, responsive interface built with shadcn/ui
- 🌓 **Dark Mode** - Full light/dark theme support

---

## 🚀 Quick Start

### Prerequisites

Before installing ScoreSnap, ensure you have the following installed:

- **Node.js** (v20 or higher) - [Download](https://nodejs.org/)
- **npm** or **pnpm** - Comes with Node.js
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/) (Required for Supabase)
- **Supabase CLI** - Install via Homebrew or npm:
  ```bash
  # macOS
  brew install supabase/tap/supabase
  
  # Or via npm
  npm install -g supabase
  ```

### Installation

1. **Clone the repository:**
   ```bash
   git clone git@github.com:taylorRichie/ScoreSnap.git
   cd ScoreSnap
   ```

2. **Start Supabase (Docker):**
   
   Make sure Docker Desktop is running, then start Supabase local development:
   ```bash
   supabase start
   ```
   
   This will:
   - Pull and start all Supabase Docker containers
   - Run database migrations
   - Set up local PostgreSQL, Auth, Storage, and API services
   - Output connection details (save these!)

3. **Install web dependencies:**
   ```bash
   cd web
   npm install
   ```

4. **Configure environment variables:**
   
   Copy the example environment file:
   ```bash
   cp env.example .env.local
   ```
   
   Edit `.env.local` with your configuration:
   ```bash
   # Supabase Configuration (from `supabase start` output)
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-start
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-supabase-start
   
   # OpenAI Configuration
   OPENAI_API_KEY=sk-your-openai-api-key
   
   # Google Places API Configuration
   GOOGLE_PLACES_API_KEY=your-google-places-api-key
   
   # Development
   NODE_ENV=development
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   The app will be available at http://localhost:3000

6. **Verify installation:**
   ```bash
   npm run health-check
   ```
   
   This checks that all static assets are loading correctly.

---

## 🔧 Configuration

### Required API Keys

#### OpenAI API Key
ScoreSnap uses OpenAI's Vision API to parse scoreboard images.

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Add to `.env.local` as `OPENAI_API_KEY`

**Cost:** ~$0.01-0.05 per image (GPT-4 Vision pricing)

#### Google Places API Key
Used for accurate bowling alley identification and location data.

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable these APIs:
   - Places API (New)
   - Maps Static API
4. Create credentials → API Key
5. Restrict the key to your domains (optional but recommended)
6. Add to `.env.local` as `GOOGLE_PLACES_API_KEY`

**Cost:** $0-200/month free tier (depends on usage)

### Supabase Configuration

After running `supabase start`, you'll see output like:

```
API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Copy the `anon key` and `service_role key` to your `.env.local`.

---

## 📁 Project Structure

```
ScoreSnap/
├── supabase/                    # Database configuration
│   ├── config.toml              # Supabase configuration
│   └── migrations/              # Database migrations
│       ├── 20241116000000_initial_schema.sql
│       ├── 20241118000000_add_session_name.sql
│       └── ...
├── web/                         # Next.js web application
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── api/             # API routes
│   │   │   ├── auth/            # Authentication pages
│   │   │   ├── dashboard/       # Main dashboard
│   │   │   ├── sessions/        # Session management
│   │   │   ├── bowlers/         # Bowler profiles
│   │   │   └── upload/          # Upload interface
│   │   ├── components/          # React components
│   │   │   └── ui/              # shadcn/ui components
│   │   ├── lib/                 # Core libraries
│   │   │   ├── supabase.ts      # Supabase client
│   │   │   ├── vision.ts        # OpenAI Vision API
│   │   │   ├── google-places.ts # Google Places API
│   │   │   └── database.ts      # Database utilities
│   │   └── types/               # TypeScript definitions
│   ├── docs/                    # Documentation
│   ├── public/                  # Static assets
│   └── package.json
├── .gitignore                   # Git ignore rules
├── LICENSE                      # Project license
└── README.md                    # This file
```

---

## 🛠️ Development

### Available Commands

```bash
# Database
supabase start                    # Start Supabase (Docker)
supabase stop                     # Stop Supabase
supabase db reset                 # Reset database (⚠️ deletes data)
supabase migration new <name>     # Create new migration
supabase db push                  # Apply migrations

# Web Application
cd web
npm run dev                       # Start dev server
npm run build                     # Build for production
npm run start                     # Start production server
npm run lint                      # Run ESLint
npm run type-check                # TypeScript type checking
npm run health-check              # Verify assets loading
```

### Development Workflow

1. **Start Supabase:**
   ```bash
   supabase start
   ```

2. **Start the web app:**
   ```bash
   cd web
   npm run dev
   ```

3. **Make changes** to code in `web/src/`

4. **Access services:**
   - Web App: http://localhost:3000
   - Supabase Studio: http://localhost:54323
   - Email Testing: http://localhost:54324

5. **Run health check** after changes:
   ```bash
   npm run health-check
   ```

### Database Migrations

To create a new migration:

```bash
supabase migration new add_new_feature
```

Edit the generated SQL file in `supabase/migrations/`, then apply:

```bash
supabase db push
```

**Important:** Never run `supabase db reset` on production data. Use migrations to modify schema.

---

## 📱 Usage

### Upload a Scorecard

1. **Take a photo** of your bowling alley's digital scoreboard
2. **Navigate to Upload** (`/upload`)
3. **Drop the image** or click to select
4. **Wait for processing** (~5-10 seconds)
5. **Review parsed data** and confirm

### View Statistics

- **Dashboard** - Overall statistics and recent games
- **Sessions** - View individual bowling sessions
- **Bowlers** - See bowler profiles and averages
- **Alleys** - Explore bowling alleys you've visited

---

## 🏗️ Architecture

### Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript
- **UI Framework:** shadcn/ui, Tailwind CSS, Radix UI
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** Supabase Auth
- **AI/ML:** OpenAI GPT-4 Vision API
- **Maps:** Google Places API (New), Static Maps API
- **Hosting:** Vercel (recommended) or any Node.js host

### Key Features

#### AI Vision Processing

ScoreSnap uses OpenAI's Vision API to parse bowling scorecards:

1. User uploads image
2. Image sent to GPT-4 Vision with structured prompt
3. AI extracts: bowler names, scores, frames, strikes, spares
4. Data validated and stored in database
5. Duplicate detection prevents re-uploading same scorecard

See `web/src/lib/vision.ts` for implementation details.

#### Location Identification

Uses GPS data from photo EXIF + Google Places API:

1. Extract GPS coordinates from image metadata
2. Query Google Places API for nearby bowling alleys
3. Match to existing alleys or create new entry
4. Store place_id for consistent identification

See `web/src/lib/google-places.ts` for implementation.

#### Database Schema

Key tables:
- `profiles` - User accounts
- `uploads` - Uploaded scorecard images
- `bowling_alleys` - Bowling alley locations
- `sessions` - Bowling sessions (multiple games)
- `teams` - Teams of bowlers
- `series` - Individual bowler's series
- `games` - Individual games
- `frames` - Frame-by-frame data
- `rolls` - Individual roll data

See `supabase/migrations/` for full schema.

---

## 🔒 Security

- ✅ All API keys stored in `.env.local` (never committed)
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Service role key only used server-side
- ✅ User authentication required for all actions
- ✅ File uploads validated and sanitized

---

## 🐛 Troubleshooting

### Docker/Supabase Issues

**Problem:** `supabase start` fails

**Solution:**
1. Ensure Docker Desktop is running
2. Check Docker has enough resources (4GB RAM minimum)
3. Try: `supabase stop && supabase start`

### Styling Issues

**Problem:** Pages load without CSS

**Solution:**
```bash
cd web
pkill -f "next dev"
rm -rf .next
npm run dev
npm run health-check
```

### Database Issues

**Problem:** Tables don't exist

**Solution:**
```bash
supabase db reset  # ⚠️ This deletes all data!
supabase db push   # Or just push migrations
```

### API Key Issues

**Problem:** "Invalid API key" errors

**Solution:**
1. Check `.env.local` exists in `web/` directory
2. Verify keys are correct (no extra spaces)
3. Restart dev server after changing .env

---

## 📚 Documentation

Additional documentation in `web/docs/`:

- [Bowling Scorecard Format](web/docs/BOWLING_SCORECARD_FORMAT.md)
- [Google Places Implementation](web/docs/GOOGLE_PLACES_IMPLEMENTATION.md)
- [Vision Prompt Improvements](web/docs/VISION_PROMPT_IMPROVEMENTS.md)
- [Duplicate Detection](web/docs/DUPLICATE_DETECTION.md)
- [Bowler Merge Feature](web/docs/BOWLER_MERGE_FEATURE.md)
- [UI Guidelines](web/docs/ui/shadcn-usage.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run type-check && npm run lint`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Rules

- **Never** create custom UI components - use shadcn/ui
- **Always** use environment variables for secrets
- **Never** commit `.env.local` or API keys
- Use TypeScript for all new files
- Follow existing code style

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Database and auth
- [OpenAI](https://openai.com/) - Vision API
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Google Places API](https://developers.google.com/maps/documentation/places/web-service) - Location data

---

## 📞 Support

For issues and questions:
- 🐛 [Open an issue](https://github.com/taylorRichie/ScoreSnap/issues)
- 📖 Read the [documentation](web/docs/)

---

**Built with ❤️ for bowlers everywhere** 🎳
