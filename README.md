# Next.js + Postgres Starter (Google Sign-In)

[![CI — Lint & Unit](https://img.shields.io/github/actions/workflow/status/iceerpgeorgia/ice-erp/ci-unit.yml?branch=main&label=CI%20%E2%80%94%20Lint%20%26%20Unit)](https://github.com/iceerpgeorgia/ice-erp/actions/workflows/ci-unit.yml)
[![CI — E2E](https://img.shields.io/github/actions/workflow/status/iceerpgeorgia/ice-erp/ci-e2e.yml?branch=main&label=CI%20%E2%80%94%20E2E)](https://github.com/iceerpgeorgia/ice-erp/actions/workflows/ci-e2e.yml)

## 1) Prereqs
- Node 18+
- Postgres running (create an empty database)
- Google OAuth credentials (Web app) from https://console.cloud.google.com/apis/credentials

## 2) Configure
Copy `.env.example` to `.env.local` and fill:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=some-long-random-string
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb?schema=public
```

## 3) Install & migrate
```
npm install
npx prisma migrate dev --name init
```

## 4) Run
```
npm run dev
```

Open http://localhost:3000 and sign in with Google.
Go to `/dashboard` to submit and view entries.

## 🚀 Production Deployment

### Quick Start
See **[Quick Deployment Guide](docs/DEPLOYMENT-QUICK.md)** for 30-minute setup.

### Full Guide
See **[Deployment Guide](docs/DEPLOYMENT.md)** for detailed instructions including:
- Vercel deployment with automatic CI/CD
- Production database setup (Supabase/Neon)
- Google OAuth configuration
- Database migrations
- Custom domain setup
- Continuous deployment workflow

### Recommended Stack
- **Hosting**: Vercel (free tier)
- **Database**: Supabase or Neon (free tier)
- **Domain**: Custom domain with SSL (automatic)
- **CI/CD**: Automatic deployment on git push

Once deployed, all future updates are automatic - just `git push`! 🎉

### Notes
- Auth uses NextAuth v4 with JWT sessions (no NextAuth DB tables).
- We still keep our own `User` table for ownership of `Entry` records.
- Update schema in `prisma/schema.prisma` and run new migrations as you grow.
