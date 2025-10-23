# Quick Deployment Checklist

## 🚀 Fast Track to Production (30 minutes)

### 1. Create Production Database (5 min)
- [ ] Go to https://supabase.com
- [ ] Create new project
- [ ] Copy connection string from Settings > Database
- [ ] Save as `DATABASE_URL`

### 2. Update Google OAuth (3 min)
- [ ] Go to https://console.cloud.google.com/apis/credentials
- [ ] Edit OAuth client: `904189547818-lsif33dip9h7dq1i34p3htppq3018k2j`
- [ ] Add redirect URI: `https://ice-erp.vercel.app/api/auth/callback/google`
- [ ] Add origin: `https://ice-erp.vercel.app`
- [ ] Save changes

### 3. Deploy to Vercel (10 min)
- [ ] Push code to GitHub
  ```powershell
  git add .
  git commit -m "feat: prepare for deployment"
  git push origin main
  ```
- [ ] Go to https://vercel.com/new
- [ ] Import your GitHub repository
- [ ] Add environment variables:
  - `DATABASE_URL` = (from Supabase)
  - `NEXTAUTH_SECRET` = (run: `openssl rand -base64 32`)
  - `NEXTAUTH_URL` = `https://ice-erp.vercel.app`
  - `GOOGLE_CLIENT_ID` = `904189547818-xxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
  - `GOOGLE_CLIENT_SECRET` = `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx`
  - `AUTHORIZED_EMAILS` = `iceerpgeorgia@gmail.com`
- [ ] Click **Deploy**

### 4. Run Database Migrations (5 min)
```powershell
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
cd c:\next-postgres-starter
vercel link

# Pull production env vars
vercel env pull .env.production

# Run migrations
$env:DATABASE_URL=(Get-Content .env.production | Select-String "DATABASE_URL" | ForEach-Object { $_.ToString().Split('=',2)[1].Trim('"') })
npx prisma migrate deploy
```

### 5. Authorize First User (2 min)
In Supabase Dashboard > Table Editor > User table:
- [ ] Find `iceerpgeorgia@gmail.com`
- [ ] Set `isAuthorized` = `true`
- [ ] Set `role` = `system_admin`

### 6. Test! (5 min)
- [ ] Go to your Vercel URL
- [ ] Sign in with Google
- [ ] Access should work! ✅

---

## Future Updates

Just push to GitHub:
```powershell
git add .
git commit -m "feat: your changes"
git push origin main
```

Vercel automatically deploys! 🎉

If you added database changes:
```powershell
# After deployment
vercel env pull .env.production
$env:DATABASE_URL=(Get-Content .env.production | Select-String "DATABASE_URL" | ForEach-Object { $_.ToString().Split('=',2)[1].Trim('"') })
npx prisma migrate deploy
```

---

## Need Help?

See full guide: `docs/DEPLOYMENT.md`
