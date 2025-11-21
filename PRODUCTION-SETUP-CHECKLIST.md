# Production Setup Checklist

**Status:** Build Succeeded ✅ | Need to Configure Environment 🔧

## Your Vercel App URL
After checking your Vercel dashboard, your app should be at:
- **URL:** `https://ice-erp.vercel.app` (or similar)
- Find exact URL in: https://vercel.com/dashboard → ice-erp project

---

## Step-by-Step Setup Guide

### ✅ STEP 1: Get Your Vercel Deployment URL
1. Open https://vercel.com/dashboard
2. Click on your **ice-erp** project
3. Copy the deployment URL (e.g., `https://ice-erp-xxx.vercel.app`)
4. **Write it down here:** _________________________________

---

### 🔲 STEP 2: Create Supabase Database (5 minutes)

1. **Go to:** https://supabase.com/dashboard
2. **Click:** "New Project"
3. **Fill in:**
   - Name: `ice-erp-production`
   - Database Password: [Create a strong password - SAVE THIS!]
   - Region: Choose closest to your location
4. **Wait:** ~2 minutes for provisioning
5. **Navigate to:** Project Settings → Database → Connection String
6. **Copy:** Connection pooler string (Transaction mode)
   - Format: `postgresql://postgres.xxx:[PASSWORD]@aws-0-xxx.pooler.supabase.com:6543/postgres`
7. **Replace** `[PASSWORD]` with your actual password
8. **Write connection string here:** _________________________________

**Important:** Use the **connection pooler** (port 6543), not direct connection (port 5432)!

---

### 🔲 STEP 3: Configure Vercel Environment Variables

1. **Go to:** Vercel Dashboard → ice-erp → Settings → Environment Variables
2. **Add these variables** (set Environment to **Production** only):

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `DATABASE_URL` | Your Supabase connection string from Step 2 | Use connection pooler! |
| `NEXTAUTH_SECRET` | `dhFhx/XLIvdcZxDMszlcRnXLd5CHEGq0LVkLdbo4kis=` | Already generated |
| `NEXTAUTH_URL` | Your Vercel URL from Step 1 | e.g., https://ice-erp.vercel.app |
| `GOOGLE_CLIENT_ID` | `904189547818-lsif33dip9h7dq1i34p3htppq3018k2j.apps.googleusercontent.com` | From local .env |
| `GOOGLE_CLIENT_SECRET` | [Your secret from local .env] | Check .env.local file |
| `AUTHORIZED_EMAILS` | `iceerpgeorgia@gmail.com` | Your email |

3. **Click:** "Save" for each variable

---

### 🔲 STEP 4: Update Google OAuth Configuration

1. **Go to:** https://console.cloud.google.com/apis/credentials
2. **Find:** Your OAuth 2.0 Client ID (ends in ...k2j.apps.googleusercontent.com)
3. **Click:** Edit (pencil icon)
4. **Add to "Authorized JavaScript origins":**
   - `https://your-vercel-url.vercel.app` (your URL from Step 1)
5. **Add to "Authorized redirect URIs":**
   - `https://your-vercel-url.vercel.app/api/auth/callback/google`
6. **Click:** "Save"

---

### 🔲 STEP 5: Trigger Deployment with Environment Variables

Run these commands in your terminal to trigger a new deployment:

```powershell
git commit --allow-empty -m "trigger deployment with environment variables"
git push origin feat/add-entry-model
```

**Wait:** 3-5 minutes for Vercel to build and deploy
**Check:** Vercel dashboard for deployment status

---

### 🔲 STEP 6: Run Database Migrations

The migrations should run automatically during the Vercel build (via `vercel-build` script).

**Verify migrations ran:**
1. Go to Supabase dashboard → SQL Editor
2. Run this query:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```
3. You should see tables: `User`, `Country`, `EntityType`, `Entry`, `Counteragent`, `AuditLog`, etc.

**If migrations didn't run,** you can run them manually:
```powershell
# First, pull production environment variables locally
npm install -g vercel
vercel env pull .env.production

# Then run migrations
npx prisma migrate deploy
```

---

### 🔲 STEP 7: Authorize Your User Account

1. **Go to:** Supabase Dashboard → Your Project → SQL Editor
2. **Run this query:**
```sql
UPDATE "User" 
SET "isAuthorized" = true, 
    "role" = 'system_admin',
    "authorizedAt" = NOW(),
    "authorizedBy" = 'system'
WHERE email = 'iceerpgeorgia@gmail.com';
```
3. **Check rows affected:** Should show "1 row affected"

---

### 🔲 STEP 8: Test Your Production App

1. **Visit:** Your Vercel URL
2. **Click:** "Sign in with Google"
3. **Authorize:** Google OAuth prompt
4. **Expected:** Dashboard loads successfully
5. **Test:** Navigate to Admin → User Management
6. **Verify:** You can see users and your account shows as "system_admin"

---

### 🔲 STEP 9: Add Team Members

**For each team member:**

1. Share your Vercel URL with them
2. They sign in with their Google account
3. You authorize them:
   - Go to Admin → User Management
   - Find their email in the list
   - Click "Authorize" and select their role:
     - `system_admin` - Full access to everything
     - `admin` - Can manage most features
     - `user` - Standard access
4. They refresh the page and can now access the app

---

## Troubleshooting

### Issue: "Internal Server Error" when accessing app
**Solution:** Check that all environment variables are set correctly in Vercel

### Issue: "Access Denied" after signing in
**Solution:** Run the SQL query in Step 7 to authorize your user

### Issue: "Database connection failed"
**Solutions:**
- Verify DATABASE_URL is correct (check for password special characters)
- Use connection pooler URL (port 6543), not direct connection (port 5432)
- Check Supabase project is running (not paused)

### Issue: Google OAuth error
**Solution:** Verify redirect URIs in Google Console match your Vercel URL exactly

### Issue: Tables not found
**Solution:** Migrations didn't run. Follow manual migration steps in Step 6

---

## Quick Reference

### Your Production URLs
- **App:** https://[your-vercel-url].vercel.app
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Google Console:** https://console.cloud.google.com/apis/credentials

### Important Commands
```powershell
# Trigger new deployment
git push origin feat/add-entry-model

# Pull production env vars locally
vercel env pull .env.production

# Run migrations manually
npx prisma migrate deploy

# Open Prisma Studio for production DB
npx prisma studio
```

### Key Files
- `package.json` - Build scripts (vercel-build)
- `prisma/schema.prisma` - Database schema
- `.env.local` - Local environment variables (NOT for production)
- `VERCEL-DEPLOYMENT-STEPS.md` - Detailed deployment guide

---

## Security Notes

⚠️ **Never commit these to Git:**
- Database passwords
- OAuth client secrets
- NEXTAUTH_SECRET
- Any API keys

✅ **All secrets should be:**
- Stored in Vercel Environment Variables
- Stored in your password manager
- Shared securely with team (not via email/Slack)

---

## Support

If you need help:
1. Check Vercel deployment logs (Dashboard → Deployments → Click deployment → View Logs)
2. Check Supabase logs (Dashboard → Logs)
3. Check browser console for errors (F12 → Console tab)

---

**Last Updated:** October 28, 2025
**Build Status:** ✅ Successful
**Deployment:** Ready to configure
