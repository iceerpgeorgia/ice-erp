# Database Connection Setup for Vercel

## Issue
Vercel serverless functions are getting connection errors to Supabase:
```
Can't reach database server at `aws-1-eu-west-1.pooler.supabase.com:6543`
```

## Root Cause
Supabase connection pooler has limits and serverless functions need proper connection parameters.

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
