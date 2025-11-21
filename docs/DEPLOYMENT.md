# Production Deployment Guide

## 🚀 Deploy to Vercel (Recommended)

Vercel is ideal for Next.js applications with automatic deployments, preview URLs, and great developer experience.

### Prerequisites
1. GitHub account (to push your code)
2. Vercel account (free at https://vercel.com)
3. Production PostgreSQL database (Supabase, Neon, or Railway)

---

## Step 1: Prepare Your Repository

### 1.1 Create .gitignore (if not exists)
Ensure these files are NOT committed:
```
.env
.env.local
.env.production
node_modules/
.next/
check-user.js
authorize-user.js
test-db.js
*.log
```

### 1.2 Push to GitHub
```bash
git add .
git commit -m "feat: prepare for production deployment"
git push origin feat/add-entry-model
```

---

## Step 2: Set Up Production Database

### Option A: Supabase (Recommended - Free tier available)

1. Go to https://supabase.com
2. Create a new project
3. Wait for database to provision (~2 minutes)
4. Go to **Settings > Database**
5. Copy the **Connection string** (URI format)
   - Example: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`
6. Save this as your production `DATABASE_URL`

### Option B: Neon (Serverless PostgreSQL)

1. Go to https://neon.tech
2. Create a new project
3. Copy the connection string
4. Save as production `DATABASE_URL`

### Option C: Railway

1. Go to https://railway.app
2. Create new project > Provision PostgreSQL
3. Copy the `DATABASE_URL` from variables tab

---

## Step 3: Configure Google OAuth for Production

### 3.1 Update Google Cloud Console

1. Go to https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID: `904189547818-lsif33dip9h7dq1i34p3htppq3018k2j`
3. Click to edit it

### 3.2 Add Production URLs

**Authorized JavaScript origins:**
```
https://iceerpgeorgia.com
https://www.iceerpgeorgia.com
https://ice-erp.vercel.app
```

**Authorized redirect URIs:**
```
https://iceerpgeorgia.com/api/auth/callback/google
https://www.iceerpgeorgia.com/api/auth/callback/google
https://ice-erp.vercel.app/api/auth/callback/google
```

> Note: Replace `ice-erp.vercel.app` with your actual Vercel domain (you'll get this in Step 4)

---

## Step 4: Deploy to Vercel

### 4.1 Connect to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository: `iceerpgeorgia/ice-erp`
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `pnpm prisma generate && pnpm build`
   - **Install Command**: `pnpm install`

### 4.2 Configure Environment Variables

Add these environment variables in Vercel:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# NextAuth
NEXTAUTH_SECRET=your-random-secret-here
NEXTAUTH_URL=https://your-domain.vercel.app

# Google OAuth
GOOGLE_CLIENT_ID=904189547818-xxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx

# System Admin
AUTHORIZED_EMAILS=iceerpgeorgia@gmail.com

# Supabase (if using)
NEXT_PUBLIC_SUPABASE_URL=https://gvxxtlmlnwxejstckyal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Figma (if using)
FIGMA_TOKEN=your-figma-token
FIGMA_FILE_KEY=Hx04EeBQ2dPmG3gq71HfOk
FIGMA_TABLE_SLUGS=countries,counteragents,entity_types
DESIGN_SOURCE=figma
```

### 4.3 Deploy

1. Click **Deploy**
2. Wait for deployment to complete (~2-3 minutes)
3. You'll get a URL like: `https://ice-erp.vercel.app`

---

## Step 5: Run Database Migrations

### 5.1 Install Vercel CLI (on your local machine)

```powershell
npm install -g vercel
```

### 5.2 Login to Vercel

```powershell
vercel login
```

### 5.3 Link your project

```powershell
cd c:\next-postgres-starter
vercel link
```

### 5.4 Run migrations on production database

```powershell
# Pull production environment variables
vercel env pull .env.production

# Run migrations
$env:DATABASE_URL=(Get-Content .env.production | Select-String "DATABASE_URL" | ForEach-Object { $_.ToString().Split('=',2)[1].Trim('"') })
npx prisma migrate deploy
npx prisma generate
```

Or use the script:
```bash
# In Git Bash or WSL
chmod +x scripts/migrate-production.sh
DATABASE_URL="your-production-db-url" ./scripts/migrate-production.sh
```

---

## Step 6: Set Up Custom Domain (Optional)

### 6.1 In Vercel Dashboard

1. Go to your project settings
2. Click **Domains**
3. Add your domain: `iceerpgeorgia.com`

### 6.2 Configure DNS

Add these records to your domain provider:

**For root domain:**
```
Type: A
Name: @
Value: 76.76.21.21
```

**For www subdomain:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 6.3 Update Environment Variables

Update `NEXTAUTH_URL` in Vercel:
```
NEXTAUTH_URL=https://iceerpgeorgia.com
```

---

## Step 7: Authorize First Admin User

After deployment, the first system admin needs to be authorized:

### Option 1: Via Direct Database Access

If using Supabase:
1. Go to Supabase Dashboard > Table Editor
2. Find the `User` table
3. Locate `iceerpgeorgia@gmail.com`
4. Set:
   - `isAuthorized` = `true`
   - `role` = `system_admin`
   - `authorizedBy` = `system`
   - `authorizedAt` = current timestamp

### Option 2: Via SQL Query

Run this in your database console:
```sql
UPDATE "User" 
SET 
  "isAuthorized" = true,
  "role" = 'system_admin',
  "authorizedBy" = 'system',
  "authorizedAt" = NOW()
WHERE email = 'iceerpgeorgia@gmail.com';
```

---

## Step 8: Continuous Deployment (Automatic)

Once set up, deployments are automatic:

1. **Push to main branch** → Deploys to production
2. **Push to feature branch** → Creates preview deployment
3. **Open Pull Request** → Creates preview URL for testing

### Development Workflow

```bash
# Make changes locally
git checkout -b feat/new-feature
# ... make changes ...
git commit -m "feat: add new feature"
git push origin feat/new-feature

# Vercel automatically creates a preview deployment
# Test at: https://ice-erp-git-feat-new-feature-iceerpgeorgia.vercel.app

# Merge to main when ready
git checkout main
git merge feat/new-feature
git push origin main

# Automatic production deployment!
```

---

## Step 9: Database Migrations in CI/CD

For future schema changes:

### 9.1 Create Migration Locally

```powershell
npx prisma migrate dev --name add_new_feature
git add prisma/migrations/
git commit -m "feat: add new database migration"
git push
```

### 9.2 Apply to Production

After deployment completes:
```powershell
vercel env pull .env.production
$env:DATABASE_URL=(Get-Content .env.production | Select-String "DATABASE_URL" | ForEach-Object { $_.ToString().Split('=',2)[1].Trim('"') })
npx prisma migrate deploy
```

Or set up as a Vercel Build Command in `package.json`:
```json
{
  "scripts": {
    "vercel-build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

---

## Monitoring and Maintenance

### View Logs
```powershell
vercel logs
```

### Redeploy
```powershell
vercel --prod
```

### Environment Variables
```powershell
# List all
vercel env ls

# Add new
vercel env add SECRET_KEY

# Pull to local
vercel env pull
```

---

## Alternative Platforms

### Railway.app
- All-in-one: Database + App hosting
- Free tier: $5 monthly credit
- Deploy: Connect GitHub, add env vars, deploy

### Render.com
- Free PostgreSQL included
- Auto-deploy from GitHub
- Slower than Vercel but includes DB

### DigitalOcean App Platform
- $5/month minimum
- Managed PostgreSQL
- Good for larger apps

---

## Security Checklist

Before going live:

- [ ] All secrets are in environment variables (not committed)
- [ ] `NEXTAUTH_SECRET` is a strong random string
- [ ] Production database has strong password
- [ ] Google OAuth has correct redirect URIs
- [ ] First admin user is authorized
- [ ] Database backups are enabled (Supabase/Neon do this automatically)
- [ ] SSL/HTTPS is enabled (Vercel does this automatically)

---

## Troubleshooting

### "Invalid callback URL"
- Check Google OAuth redirect URIs match your Vercel URL exactly
- Ensure `NEXTAUTH_URL` matches your deployment URL

### "Database connection failed"
- Verify `DATABASE_URL` is correct in Vercel
- Check database is accessible from external IPs
- For Supabase: Use "Connection string" not "Session pooler"

### "Prisma Client not generated"
- Add `prisma generate` to build command
- Ensure migrations are deployed

### Users can't sign in
- Check `AUTHORIZED_EMAILS` in production env vars
- Manually authorize first admin in database
- Check auth logs in Vercel dashboard

---

## Support

- Vercel Docs: https://vercel.com/docs
- Prisma Docs: https://www.prisma.io/docs
- NextAuth Docs: https://next-auth.js.org/

Your app should now be live and accessible 24/7! 🎉
