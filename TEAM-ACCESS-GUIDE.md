# 🚀 ICE ERP - Production Access Guide

## For Team Members

### How to Access the App

1. **Get the URL from your admin**
   - The URL will look like: `https://ice-erp-xxx.vercel.app`
   
2. **Visit the URL in your browser**

3. **Click "Sign in with Google"**

4. **Wait for admin to authorize your account**
   - After first login, you'll see "Access Denied"
   - Contact admin (iceerpgeorgia@gmail.com) to authorize you
   
5. **Refresh the page** after admin authorizes you
   - You'll now have access to the dashboard

---

## For Admin (iceerpgeorgia@gmail.com)

### Your Access URLs

- **Production App:** Check Vercel dashboard for exact URL
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard  
- **Google OAuth Console:** https://console.cloud.google.com/apis/credentials

### How to Authorize Team Members

**Method 1: Through the UI (Easiest)**
1. Go to your app → Admin → User Management
2. Find the team member's email in the list
3. Click "Authorize" button
4. Select their role (user/admin/system_admin)
5. Tell them to refresh their browser

**Method 2: Using Supabase SQL**
1. Go to Supabase Dashboard → SQL Editor
2. Run this query (replace the email):
```sql
UPDATE "User" 
SET "isAuthorized" = true, 
    "role" = 'admin',  -- or 'user' or 'system_admin'
    "authorizedAt" = NOW(),
    "authorizedBy" = 'system'
WHERE email = 'teammember@example.com';
```

### User Roles Explained

- **system_admin** (Full Access)
  - Manage users (authorize/deauthorize)
  - Access all features
  - Modify system settings
  - Best for: You and senior administrators

- **admin** (Most Features)
  - Access most features
  - Cannot manage users
  - Best for: Department heads, managers

- **user** (Standard Access)
  - Basic features only
  - View and edit their own data
  - Best for: Regular employees

---

## Quick Actions

### Check Deployment Status
1. Go to https://vercel.com/dashboard
2. Click on **ice-erp** project
3. See latest deployment status

### View Application Logs
1. Vercel Dashboard → ice-erp → Deployments
2. Click on latest deployment
3. Click "View Function Logs" or "View Build Logs"

### View Database
1. Supabase Dashboard → Your Project → Table Editor
2. Or use SQL Editor for queries

### Update the App
Simply push to GitHub:
```powershell
git push origin feat/add-entry-model
```
Vercel will automatically deploy in ~3-5 minutes

---

## Troubleshooting

### "Access Denied" after signing in
- **Solution:** Contact admin to authorize your account

### Can't sign in with Google
- **Contact admin** - OAuth settings may need updating

### Page not loading / Error 500
- **Wait a few minutes** - App might be deploying
- **Contact admin** if issue persists

### Forgot the app URL
- **Contact admin** for the correct URL

---

## Support Contact

**Admin:** iceerpgeorgia@gmail.com

**For technical issues:**
- Check with admin first
- Admin has access to logs and can diagnose issues

---

## Security Reminders

✅ **DO:**
- Use a strong Google account password
- Sign out when using shared computers
- Report any suspicious activity

❌ **DON'T:**
- Share your login credentials
- Leave your session open on public computers
- Share the app URL publicly (it's for internal use only)

---

**Last Updated:** October 28, 2025
**Status:** Production Ready (after setup)
