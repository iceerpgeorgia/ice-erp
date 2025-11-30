# Deployment Architecture

## 🏗️ Current Setup (Development)

```
┌─────────────┐
│   Your PC   │
│ localhost:  │
│    3000     │
└──────┬──────┘
       │
       ├─────────► Local PostgreSQL
       │           (localhost:5432)
       │
       └─────────► Google OAuth
                   (localhost redirect)
```

## ☁️ Production Setup (Recommended)

```
                    ┌──────────────┐
                    │   Internet   │
                    │    Users     │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Vercel    │
                    │  (Hosting)   │
                    │ iceerpgeorgia│
                    │    .com      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         ┌─────────┐  ┌─────────┐  ┌─────────┐
         │Supabase │  │ Google  │  │  Your   │
         │Postgres │  │  OAuth  │  │ GitHub  │
         │Database │  │         │  │  Repo   │
         └─────────┘  └─────────┘  └─────────┘
```

## 🔄 Continuous Deployment Workflow

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  1. Developer Makes Changes                         │
│     ┌─────────────┐                                 │
│     │   Your PC   │                                 │
│     │  (VS Code)  │                                 │
│     └──────┬──────┘                                 │
│            │ git push                               │
│            ▼                                        │
│  2. Push to GitHub                                  │
│     ┌─────────────┐                                 │
│     │   GitHub    │                                 │
│     │   Repo      │                                 │
│     └──────┬──────┘                                 │
│            │ webhook                                │
│            ▼                                        │
│  3. Vercel Auto-Deploy                              │
│     ┌─────────────┐                                 │
│     │   Vercel    │                                 │
│     │  Building   │ ← Runs: prisma generate        │
│     │             │ ← Runs: next build             │
│     └──────┬──────┘                                 │
│            │                                        │
│            ▼                                        │
│  4. Deploy Complete                                 │
│     ┌─────────────┐                                 │
│     │  Live Site  │                                 │
│     │   ✅ Ready  │                                 │
│     └─────────────┘                                 │
│                                                     │
│  Total Time: 2-3 minutes                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 🔐 Environment Variables Flow

```
Development (.env.local)          Production (Vercel)
┌─────────────────────┐          ┌─────────────────────┐
│ DATABASE_URL=       │          │ DATABASE_URL=       │
│   localhost:5432    │          │   supabase.co       │
│                     │          │                     │
│ NEXTAUTH_URL=       │          │ NEXTAUTH_URL=       │
│   localhost:3000    │          │   iceerpgeorgia.com │
│                     │          │                     │
│ GOOGLE_CLIENT_ID    │   Same   │ GOOGLE_CLIENT_ID    │
│ GOOGLE_SECRET       │ ────────►│ GOOGLE_SECRET       │
│ NEXTAUTH_SECRET     │          │ NEXTAUTH_SECRET     │
│ AUTHORIZED_EMAILS   │          │ AUTHORIZED_EMAILS   │
└─────────────────────┘          └─────────────────────┘
```

## 🗄️ Database Migration Strategy

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  Local Development                               │
│  ────────────────                                │
│                                                  │
│  1. Make schema changes                          │
│     ├─ Edit: prisma/schema.prisma               │
│     └─ Run: prisma migrate dev --name feature   │
│                                                  │
│  2. Commit migrations                            │
│     ├─ Git add: prisma/migrations/              │
│     └─ Git push to GitHub                       │
│                                                  │
│  3. Deploy to Production                         │
│     ├─ Vercel auto-deploys                      │
│     └─ Manual: prisma migrate deploy            │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 📊 Cost Estimate (Monthly)

```
┌─────────────────────┬─────────┬──────────────┐
│ Service             │ Tier    │ Cost         │
├─────────────────────┼─────────┼──────────────┤
│ Vercel              │ Hobby   │ $0           │
│ Supabase            │ Free    │ $0           │
│ GitHub              │ Free    │ $0           │
│ Google OAuth        │ Free    │ $0           │
├─────────────────────┼─────────┼──────────────┤
│ TOTAL               │         │ $0/month ✅  │
└─────────────────────┴─────────┴──────────────┘

Limits on Free Tier:
• Vercel: 100GB bandwidth/month
• Supabase: 500MB database, 2GB bandwidth
• Plenty for small-medium teams!

Scale to paid when needed:
• Vercel Pro: $20/month
• Supabase Pro: $25/month
```

## 🔄 Update Scenarios

### Scenario 1: Code Changes Only
```
git add .
git commit -m "feat: add new feature"
git push
```
→ Automatic deployment in 2-3 minutes ✅

### Scenario 2: Database Schema Changes
```
npx prisma migrate dev --name add_field
git add prisma/migrations/
git commit -m "feat: add new field"
git push
```
→ Deploy, then run:
```powershell
vercel env pull .env.production
$env:DATABASE_URL="..." 
npx prisma migrate deploy
```
→ Done! ✅

### Scenario 3: Environment Variable Changes
```
1. Go to Vercel Dashboard
2. Project Settings > Environment Variables
3. Add/Edit variable
4. Redeploy: vercel --prod
```
→ Live in 2 minutes ✅

## 🚨 Rollback Strategy

If deployment has issues:

```
Option 1: Instant Rollback
┌─────────────────────────────────┐
│ Vercel Dashboard                │
│ ├─ Go to Deployments            │
│ ├─ Find previous good deploy    │
│ └─ Click "Promote to Production"│
│                                 │
│ Time: 30 seconds                │
└─────────────────────────────────┘

Option 2: Git Revert
┌─────────────────────────────────┐
│ git revert HEAD                 │
│ git push                        │
│                                 │
│ Auto-deploys previous version   │
│ Time: 2-3 minutes               │
└─────────────────────────────────┘
```

## 📱 Access Patterns

```
Production Access:
┌──────────────────────────────────────────┐
│                                          │
│  Users visit: https://iceerpgeorgia.com  │
│                                          │
│  ├─ Click "Sign in with Google"         │
│  ├─ Google OAuth login                  │
│  ├─ Redirect back to app                │
│  └─ Session created                      │
│                                          │
│  ✅ Authorized users see dashboard       │
│  ❌ Unauthorized see "Access Denied"     │
│                                          │
│  System Admin can authorize at:          │
│  https://iceerpgeorgia.com/admin/users   │
│                                          │
└──────────────────────────────────────────┘
```
