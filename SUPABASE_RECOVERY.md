# Supabase Database Recovery Guide

## Current Status
- ❌ `DATABASE_URL` is empty
- ❌ `DIRECT_DATABASE_URL` is empty
- ✅ Supabase project is configured (fojbzghphznbslqwurrm)
- ✅ Backups exist

## Steps to Fix

### 1. Verify Database Status in Supabase Dashboard
- Go to https://app.supabase.com
- Select project: **fojbzghphznbslqwurrm**
- Click **Settings** (left sidebar) → **Database**
- Check status - should show "Active" (not "Paused")

### 2. If Database is Paused
- Click the **Resume** button next to the database
- Wait for it to become active (~1-2 minutes)

### 3. Get Connection Strings
- Still in Settings → Database section
- Scroll down to **Connection String**
- Select **Node.js** from the dropdown
- Copy the entire string

### 4. Update .env.local
```bash
# Replace with the connection string from Supabase
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres?schema=public"

# This should be the same as DATABASE_URL for local development
DIRECT_DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres?schema=public"
```

### 5. Verify Connection
```bash
pnpm prisma db push
# Or for checking:
npx prisma db pull
```

### 6. If Tables Are Still Missing - Restore from Backup
1. Go to **Settings** → **Backups** in Supabase
2. Find the most recent backup before the payment issue
3. Click **Restore**
4. Select **Overwrite database** option
5. Wait for restoration (~5-15 minutes)
6. Run migrations again: `pnpm prisma migrate deploy`

### 7. After Restoration - Start Dev Server
```bash
pnpm dev
```

## Troubleshooting

### Error: "Cannot connect to database"
- Verify DATABASE_URL is correct
- Check your IP is whitelisted (Settings → Security)
- Ensure password doesn't have special characters (or escape them)

### Error: "No such table"
- Tables might not have been restored
- Go back to step 6 and restore from backup
- Run: `pnpm prisma migrate deploy`

### Still no tables after restore
- Backups might be corrupted
- Contact Supabase support with your project ID: fojbzghphznbslqwurrm
