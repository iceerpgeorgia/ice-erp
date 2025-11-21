# ☁️ Cloud Deployment Checklist

Print this or keep it open while deploying!

---

## 📦 PREPARATION (10 min)

### Gather Information
- [ ] GitHub username: ________________
- [ ] Project repository: iceerpgeorgia/ice-erp
- [ ] Your email for admin: iceerpgeorgia@gmail.com

### Accounts Needed
- [ ] GitHub account (have login ready)
- [ ] Vercel account - Sign up at https://vercel.com
- [ ] Supabase account - Sign up at https://supabase.com
- [ ] Google Cloud Console access

---

## 🗄️ DATABASE SETUP (5 min)

### Supabase Setup
- [ ] Go to https://supabase.com/dashboard
- [ ] Click "New Project"
- [ ] Fill in:
  - Name: `ice-erp-production`
  - Database Password: ________________ (SAVE THIS!)
  - Region: Choose closest to users
- [ ] Wait for provisioning (~2 minutes)
- [ ] Go to Settings > Database
- [ ] Copy "Connection string" (URI mode)
- [ ] Save as: `DATABASE_URL` below

```
DATABASE_URL=postgresql://postgres:_______________
```

---

## 🔐 GOOGLE OAUTH UPDATE (3 min)

### Update OAuth Settings
- [ ] Go to https://console.cloud.google.com/apis/credentials
- [ ] Find client: `904189547818-lsif33dip9h7dq1i34p3htppq3018k2j`
- [ ] Click to edit

### Add These URLs

**Authorized JavaScript origins:**
```
https://ice-erp.vercel.app
```

**Authorized redirect URIs:**
```
https://ice-erp.vercel.app/api/auth/callback/google
```

- [ ] Click "Save"

---

## 📤 PUSH TO GITHUB (5 min)

### In Your Terminal
```powershell
cd c:\next-postgres-starter

git add .
git commit -m "feat: prepare for production deployment"
git push origin main
```

- [ ] Pushed successfully
- [ ] Check GitHub - files are there

---

## 🚀 VERCEL DEPLOYMENT (10 min)

### Create Deployment
- [ ] Go to https://vercel.com/new
- [ ] Click "Import Git Repository"
- [ ] Select: `iceerpgeorgia/ice-erp`
- [ ] Framework: Next.js (auto-detected)
- [ ] Root Directory: `./`

### Add Environment Variables

Click "Environment Variables" and add these:

```
DATABASE_URL
postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
(from Supabase)

NEXTAUTH_SECRET
dhFhx/XLIvdcZxDMszlcRnXLd5CHEGq0LVkLdbo4kis=
(or generate new with: ./scripts/generate-secret.ps1)

NEXTAUTH_URL
https://ice-erp.vercel.app
(will get actual URL after deploy)

GOOGLE_CLIENT_ID
904189547818-xxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com

GOOGLE_CLIENT_SECRET
GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx

AUTHORIZED_EMAILS
iceerpgeorgia@gmail.com
```

- [ ] All variables added
- [ ] Click "Deploy"
- [ ] Wait for build (~3 minutes)
- [ ] Copy your Vercel URL: ________________

---

## 🔄 DATABASE MIGRATIONS (5 min)

### Install Vercel CLI
```powershell
npm install -g vercel
```

- [ ] Installed

### Run Migrations
```powershell
# Login
vercel login
# (Browser will open, authorize)

# Link project
cd c:\next-postgres-starter
vercel link
# Select: iceerpgeorgia > ice-erp

# Pull env vars
vercel env pull .env.production

# Run migrations
$env:DATABASE_URL=(Get-Content .env.production | Select-String "DATABASE_URL" | ForEach-Object { $_.ToString().Split('=',2)[1].Trim('"') })
npx prisma migrate deploy
npx prisma generate
```

- [ ] Migrations completed successfully

---

## 👤 AUTHORIZE FIRST ADMIN (2 min)

### Via Supabase Dashboard
- [ ] Go to Supabase Dashboard
- [ ] Click "Table Editor"
- [ ] Select "User" table
- [ ] Find row: `iceerpgeorgia@gmail.com`
- [ ] Click to edit
- [ ] Set:
  - `isAuthorized`: `true` ✅
  - `role`: `system_admin`
  - `authorizedBy`: `system`
  - `authorizedAt`: (click "Now")
- [ ] Save

### Or Via SQL Editor
```sql
UPDATE "User" 
SET 
  "isAuthorized" = true,
  "role" = 'system_admin',
  "authorizedBy" = 'system',
  "authorizedAt" = NOW()
WHERE email = 'iceerpgeorgia@gmail.com';
```

- [ ] Admin authorized

---

## ✅ TESTING (5 min)

### Test Your Deployment

Go to your Vercel URL: ________________

- [ ] Page loads
- [ ] Click "Sign in with Google"
- [ ] Select your Google account
- [ ] Redirects back successfully
- [ ] You can see dashboard
- [ ] Go to `/admin/users`
- [ ] Can see user management table
- [ ] Can toggle authorization
- [ ] Can change roles

---

## 🎯 POST-DEPLOYMENT

### Update OAuth (if needed)
If using custom domain later:
- [ ] Add domain redirect URIs to Google Console
- [ ] Update `NEXTAUTH_URL` in Vercel

### Document Your Setup
```
Production URL: ________________
Database: Supabase project: ________________
Vercel Project: ice-erp
Admin Email: iceerpgeorgia@gmail.com
```

---

## 🔄 FUTURE UPDATES

### Making Changes

```powershell
# 1. Make changes in VS Code
# 2. Test locally: pnpm dev
# 3. Commit and push:
git add .
git commit -m "feat: description"
git push origin main

# Vercel auto-deploys! ✨
```

### Database Changes

```powershell
# 1. Create migration
npx prisma migrate dev --name feature_name

# 2. Push to GitHub
git add prisma/migrations/
git commit -m "feat: add migration"
git push

# 3. After deploy, run:
vercel env pull .env.production
$env:DATABASE_URL=(Get-Content .env.production | Select-String "DATABASE_URL" | ForEach-Object { $_.ToString().Split('=',2)[1].Trim('"') })
npx prisma migrate deploy
```

---

## 📞 HELP & TROUBLESHOOTING

### Build Failed?
- [ ] Check Vercel build logs
- [ ] Verify all environment variables are set
- [ ] Check for syntax errors

### Can't Sign In?
- [ ] Verify Google OAuth redirect URIs
- [ ] Check `NEXTAUTH_URL` matches Vercel URL
- [ ] Verify user is authorized in database

### Database Connection Error?
- [ ] Check `DATABASE_URL` format
- [ ] Verify Supabase database is running
- [ ] Check Prisma migrations are applied

---

## 🎉 SUCCESS!

When everything works:
- ✅ App is live 24/7
- ✅ No need for your PC to be on
- ✅ Automatic deployments on git push
- ✅ Free SSL certificate
- ✅ Global CDN
- ✅ Professional grade infrastructure

**Total Time**: ~30 minutes
**Monthly Cost**: $0 (free tier)

---

*Keep this checklist for reference!*
*Last updated: October 24, 2025*
