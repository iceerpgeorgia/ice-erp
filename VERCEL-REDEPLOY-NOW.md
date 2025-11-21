# 🚀 REDEPLOY TO FIX NEXTAUTH_SECRET ERROR

## Problem Identified
The Vercel logs show: **`[next-auth][error][NO_SECRET]`**

Current deployments were built **before** environment variables were added to Vercel. Environment variables require a **redeploy** to take effect.

## Quick Fix - Trigger Redeploy (Choose ONE method)

### Method 1: Via Vercel Dashboard (Easiest)
1. Go to: https://vercel.com/iceerp/ice/deployments
2. Find the **latest deployment** (top of list)
3. Click the **⋮ (three dots)** menu on the right
4. Click **"Redeploy"**
5. Click **"Redeploy"** again to confirm
6. Wait ~2-3 minutes for build to complete

### Method 2: Push Empty Commit (Alternative)
```powershell
# From workspace root
git commit --allow-empty -m "chore: trigger redeploy for env vars"
git push origin feat/add-entry-model
```

### Method 3: Vercel CLI (If installed)
```powershell
vercel --prod
```

## What This Will Do
✅ Build new deployment with NEXTAUTH_SECRET loaded
✅ Build with all 6 environment variables active
✅ Fix the "Configuration" error
✅ Enable Google OAuth sign-in
✅ Allow session management

## After Redeploy Completes
1. **Wait for "Ready" status** in Vercel dashboard (~2-3 minutes)
2. **Visit your app**: https://ice-cn571w70z-iceerp.vercel.app
3. **Try signing in** with Google
4. **Expected result**: "Access Denied" page (GOOD! This means NextAuth is working)
5. **Then authorize yourself** using SQL in Supabase

## Verify Deployment Includes Env Vars
In Vercel dashboard:
1. Go to new deployment
2. Click "Environment Variables" tab
3. Should see: NEXTAUTH_SECRET, DATABASE_URL, GOOGLE_CLIENT_ID, etc.

## Next Steps After Successful Redeploy
1. ✅ Test sign-in → Should show "Access Denied" (expected)
2. ✅ Run authorization SQL in Supabase
3. ✅ Refresh app → Should have full access
4. ✅ Test all features (dictionaries, admin panel)
5. ✅ Add team member

---
**Note**: The error happens because Vercel builds are immutable. New env vars don't affect existing builds - you must create a new build.
