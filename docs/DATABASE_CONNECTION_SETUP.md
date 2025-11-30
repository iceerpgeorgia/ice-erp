# Database Connection Issues - Troubleshooting

## Current Issue
Intermittent connection errors to Supabase from Vercel:
```
Can't reach database server at `aws-1-eu-west-1.pooler.supabase.com:6543`
```

## Root Cause
This is a **known issue** with Supabase connection pooler and Vercel serverless functions. The connection pooler can become overwhelmed when multiple serverless functions try to connect simultaneously.

## Solutions

### Option 1: Verify Current DATABASE_URL Has Correct Parameters (Recommended)

Your `DATABASE_URL` in Vercel **MUST** include these parameters:

```
postgresql://postgres.fojbzghphznbslqwurrm:PASSWORD@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Critical Parameters:**
- `?pgbouncer=true` - REQUIRED for connection pooling
- `&connection_limit=1` - REQUIRED to prevent connection exhaustion

### Option 2: Use Supabase Direct Connection with Prisma Accelerate

If the pooler keeps timing out, consider using Prisma Accelerate:
1. Sign up for Prisma Accelerate (free tier available)
2. Get your accelerated connection string
3. Update DATABASE_URL in Vercel

### Option 3: Switch to Session Tokens (Quick Fix)

If database sessions are causing issues, switch NextAuth to JWT sessions:

In `lib/auth.ts`:
```typescript
session: { 
  strategy: "jwt",  // Change from "database"
  maxAge: 30 * 24 * 60 * 60,
},
```

**Pros:** Eliminates database queries for every page load
**Cons:** User data in session won't update until re-login

## Immediate Steps to Take

### 1. Check Current DATABASE_URL in Vercel

Go to: Vercel Dashboard → Settings → Environment Variables → DATABASE_URL

Ensure it looks like:
```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

### 2. If Parameters Are Missing

Update it with the correct format and redeploy.

### 3. Check Supabase Database Status

1. Go to Supabase Dashboard
2. Check if database is active and not paused
3. Verify connection pooling is enabled

### 4. Monitor Connection Usage

In Supabase Dashboard → Database → Connection Pooling:
- Check current active connections
- Free tier limit: 60 connections
- Connection pooler limit: 15 connections per database

## Why This Happens

1. **Serverless Cold Starts**: Each Vercel function creates a new Prisma client
2. **Connection Pooling**: Without proper parameters, connections aren't reused
3. **Supabase Limits**: Free tier has connection limits
4. **NextAuth Database Sessions**: Every page load queries the database for session

## Long-term Solution

Consider implementing:

1. **JWT Sessions** (immediate, no DB queries)
2. **Prisma Accelerate** (managed connection pooling)
3. **Upgrade Supabase Plan** (higher connection limits)
4. **Redis Session Store** (faster, fewer DB connections)

## Testing the Fix

After updating DATABASE_URL:

1. Redeploy in Vercel
2. Clear browser cookies
3. Sign in again
4. Navigate between pages
5. Check Vercel Function logs for errors

If you still see errors after 5 minutes, the connection pooler might be rate-limiting. Wait 10 minutes and try again.

## Solution

### Step 1: Update DATABASE_URL in Vercel

Go to Vercel Dashboard → Project Settings → Environment Variables

Replace the `DATABASE_URL` with the following format:

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Important parameters:**
- `pgbouncer=true` - Uses Supabase's connection pooler
- `connection_limit=1` - Limits connections per serverless function (crucial for Vercel)

### Step 2: Get Your Connection String from Supabase

1. Go to Supabase Dashboard → Project Settings → Database
2. Scroll to "Connection Pooling"
3. Copy the "Connection string" (mode: Transaction)
4. Add `&connection_limit=1` to the end

Example:
```
postgresql://postgres.fojbzghphznbslqwurrm:YOUR_PASSWORD@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

### Step 3: Update All Environment Variables

Make sure to set the `DATABASE_URL` for:
- ✅ Production
- ✅ Preview
- ✅ Development (optional, use local DB for dev)

### Step 4: Redeploy

After updating the environment variable:
1. Go to Vercel Dashboard → Deployments
2. Click "..." on the latest deployment
3. Click "Redeploy"
4. Wait for deployment to complete

## Verification

Test the connection by:
1. Loading any page that requires authentication
2. Checking Vercel Functions logs for Prisma errors
3. Trying to load any dictionary page (Countries, Counteragents, etc.)

If successful, you should see no Prisma connection errors in logs.

## Alternative: Direct Connection (Not Recommended for Serverless)

If you must use direct connection (not pooler), use port 5432:
```
postgresql://postgres:[PASSWORD]@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres
```

**Warning:** Direct connections will exhaust connection limits on serverless platforms. Always use connection pooling for Vercel.

## Troubleshooting

### Still getting connection errors?

1. **Check Supabase Status**: Verify your project is active in Supabase dashboard
2. **Verify Password**: Ensure the password doesn't contain special characters that need URL encoding
3. **Check Connection Limit**: Supabase free tier has 60 direct connections, pooler handles this better
4. **Review Logs**: Check Vercel Function logs for detailed error messages

### URL Encode Special Characters

If your password contains special characters, encode them:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`

Example:
```
Password: myP@ss#123
Encoded: myP%40ss%23123
```

## Current Configuration

Your Supabase connection details:
- Host: `aws-1-eu-west-1.pooler.supabase.com`
- Port: `6543` (connection pooler)
- Database: `postgres`
- Project: `fojbzghphznbslqwurrm`

Recommended DATABASE_URL format:
```
postgresql://postgres.fojbzghphznbslqwurrm:YOUR_PASSWORD_HERE@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```
