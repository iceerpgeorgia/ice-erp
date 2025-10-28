# 🚀 Your Code is on GitHub - Ready for Vercel!

## ✅ Step 1: Complete - Code Pushed to GitHub

Your code is now at: https://github.com/iceerpgeorgia/ice-erp

Branch: `feat/add-entry-model`

---

## 📋 Next Steps: Deploy to Vercel

### Step 1: Go to Vercel
Open your browser and go to: **https://vercel.com/new**

### Step 2: Sign Up / Sign In
- Click **"Continue with GitHub"**
- Authorize Vercel to access your GitHub

### Step 3: Import Your Repository
- You'll see a list of your repositories
- Find: **`iceerpgeorgia/ice-erp`**
- Click **"Import"**

### Step 4: Configure Project
Vercel will auto-detect Next.js. Settings:
- **Framework Preset**: Next.js ✅ (auto-detected)
- **Root Directory**: `./` (leave as is)
- **Build Command**: Leave default or use: `pnpm prisma generate && pnpm build`
- **Install Command**: `pnpm install`

### Step 5: Add Environment Variables ⚠️ IMPORTANT
Click **"Environment Variables"** and add these ONE BY ONE:

```
Name: DATABASE_URL
Value: (your Supabase connection string - get this next)

Name: NEXTAUTH_SECRET  
Value: dhFhx/XLIvdcZxDMszlcRnXLd5CHEGq0LVkLdbo4kis=

Name: NEXTAUTH_URL
Value: https://ice-erp.vercel.app
(will update with actual URL after deploy)

Name: GOOGLE_CLIENT_ID
Value: (from your .env.local file)

Name: GOOGLE_CLIENT_SECRET
Value: (from your .env.local file)

Name: AUTHORIZED_EMAILS
Value: iceerpgeorgia@gmail.com
```

**Don't have DATABASE_URL yet?**
- Skip it for now
- Deploy anyway
- We'll add it and redeploy

### Step 6: Deploy!
- Click **"Deploy"**
- Wait 2-3 minutes
- You'll get a URL like: `https://ice-erp-xxxxx.vercel.app`

---


## 🗄️ Step 7: Set Up Production Database (Supabase)

### Go to Supabase
1. Open: **https://supabase.com/dashboard**
2. Click **"New Project"**

### Create Project
- **Name**: `ice-erp-production`
- **Database Password**: (create a strong one - SAVE IT!)
- **Region**: Choose closest to your users
- **Plan**: Free (perfect for start)

### Wait for Provisioning
- Takes ~2 minutes
- Coffee break! ☕

### Get Connection String
1. Go to **Settings** (left sidebar)
2. Click **Database**
3. Scroll to **Connection string**
4. Select **URI** tab
5. Copy the connection string
6. It looks like: `postgresql://postgres.[project].supabase.co:5432/postgres`

### Add to Vercel
1. Go back to Vercel dashboard
2. Go to your project **Settings**
3. Click **Environment Variables**
4. Add:
   - Name: `DATABASE_URL`
   - Value: (paste your Supabase connection string)
5. Click **Save**

### Redeploy
1. Go to **Deployments** tab
2. Click the **"..."** menu on latest deployment
3. Click **"Redeploy"**
4. Wait 2 minutes

---

## 🔐 Step 8: Update Google OAuth

Your app is now live! But Google OAuth needs the new URL.

### Go to Google Cloud Console
1. Open: **https://console.cloud.google.com/apis/credentials**
2. Find your OAuth client
3. Click to edit

### Add Production URLs

**Authorized JavaScript origins - ADD:**
```
https://ice-erp.vercel.app
```
(use your actual Vercel URL)

**Authorized redirect URIs - ADD:**
```
https://ice-erp.vercel.app/api/auth/callback/google
```

### Update NEXTAUTH_URL in Vercel
1. Go to Vercel Dashboard > Your Project
2. Go to **Settings** > **Environment Variables**
3. Find `NEXTAUTH_URL`
4. Edit it to your actual Vercel URL
5. Save and Redeploy

---

## 🔄 Step 9: Run Database Migrations

### Install Vercel CLI (if not installed)
```powershell
npm install -g vercel
```

### Login to Vercel
```powershell
vercel login
```
(Browser will open for authorization)

### Link Your Project
```powershell
cd c:\next-postgres-starter
vercel link
```
- Select your team/account
- Select the `ice-erp` project
- Link to existing project: Yes

### Pull Environment Variables
```powershell
vercel env pull .env.production
```

### Run Migrations
```powershell
$env:DATABASE_URL=(Get-Content .env.production | Select-String "DATABASE_URL" | ForEach-Object { $_.ToString().Split('=',2)[1].Trim('"') })
npx prisma migrate deploy
npx prisma generate
```

---

## 👤 Step 10: Authorize Your Admin Account

### Via Supabase Dashboard
1. Go to **Supabase Dashboard**
2. Click **Table Editor** (left sidebar)
3. Select **User** table
4. Find row with `iceerpgeorgia@gmail.com`
5. Click to edit
6. Set:
   - `isAuthorized`: ✅ true
   - `role`: `system_admin`
   - `authorizedAt`: (click "Now")
   - `authorizedBy`: `system`
7. Click **Save**

### Or Via SQL Editor
1. Click **SQL Editor** in Supabase
2. Click **New query**
3. Paste:
```sql
UPDATE "User" 
SET 
  "isAuthorized" = true,
  "role" = 'system_admin',
  "authorizedBy" = 'system',
  "authorizedAt" = NOW()
WHERE email = 'iceerpgeorgia@gmail.com';
```
4. Click **Run**

---

## 🎉 Step 11: TEST YOUR APP!

### Visit Your Live URL
Go to: `https://your-vercel-url.vercel.app`

### Test Checklist
- [ ] Page loads
- [ ] Click **"Sign in with Google"**
- [ ] Sign in with `iceerpgeorgia@gmail.com`
- [ ] You're redirected back (not "Access Denied")
- [ ] You can see the dashboard
- [ ] Navigate to `/admin/users`
- [ ] Can see user management table
- [ ] Can toggle user authorization

### If Everything Works
**🎊 CONGRATULATIONS! Your app is LIVE!**

---

## 📝 Your Deployment Info

Fill this in for future reference:

```
Production URL: ___________________________
Vercel Project: ice-erp
GitHub Repo: iceerpgeorgia/ice-erp
Database: Supabase Project: ___________________________
Admin Email: iceerpgeorgia@gmail.com
```

---

## 🔄 How to Update Your App in Future

It's beautifully simple:

```powershell
# 1. Make changes in VS Code
# 2. Test locally: pnpm dev
# 3. Commit and push:
git add .
git commit -m "feat: your description"
git push origin feat/add-entry-model

# Vercel automatically deploys! ✨
# Live in 2-3 minutes
```

If you changed the database schema:
```powershell
# After automatic deployment:
vercel env pull .env.production
$env:DATABASE_URL=(Get-Content .env.production | Select-String "DATABASE_URL" | ForEach-Object { $_.ToString().Split('=',2)[1].Trim('"') })
npx prisma migrate deploy
```

---

## 🆘 Troubleshooting

### "Can't connect to database"
- Check `DATABASE_URL` in Vercel env vars
- Verify Supabase database is running
- Connection string format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`

### "OAuth redirect mismatch"
- Verify redirect URIs in Google Cloud Console
- Must exactly match your Vercel URL
- Include the `/api/auth/callback/google` path

### "Access Denied" when signing in
- User needs to be authorized in database
- Run the SQL query from Step 10

### Build fails
- Check Vercel build logs
- Usually missing environment variable
- Verify all env vars are set

---

## 📚 Documentation

- **Quick Guide**: `docs/DEPLOYMENT-QUICK.md`
- **Full Guide**: `docs/DEPLOYMENT.md`
- **Architecture**: `docs/DEPLOYMENT-ARCHITECTURE.md`
- **Domain Guide**: `docs/DOMAIN-GUIDE.md`

---

**Ready to start? Go to: https://vercel.com/new** 🚀

Your code is ready. Let's get it live!
