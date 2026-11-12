# Direct Database Query Tool

**Use this tool when you have the restored GCP backup database connection details.**

## How to Use

### Step 1: Get Connection Details from GCP

If the backup is a **Cloud SQL instance**, ask whoever provisioned it or check:

**In GCP Console:**
1. Go to **Cloud SQL** → **Instances**
2. Click the backup instance name
3. Note the **Public IP address** (this is your Host)
4. Click **Connections** tab → find **User Accounts** section
5. Note the username (usually `postgres`)
6. Get password from your password manager or reset it

**You'll need:**
- **Host**: IP address or hostname (e.g., `35.192.1.2`)
- **Database**: Usually `postgres` or the specific DB name
- **Username**: Usually `postgres`
- **Password**: The actual database password
- **Port**: Usually `5432` (press Enter to use default)

### Step 2: Run the Tool

```bash
npx ts-node scripts/query-backup-db.ts
```

### Step 3: Enter Connection Details When Prompted

```
Database Host (IP or hostname): 35.192.1.2
Database Name (usually "postgres"): postgres
Username (usually "postgres"): postgres
Password: [your-password-here]
Port (default 5432): [press Enter]
```

### What You'll Get

✅ **Orphaned cost payments** (20 rows) — payments with `payment_id = NULL`  
✅ **Waybill source data** — for matching algorithm  
✅ **CSV export format** — ready to copy/paste into matching script  

### Then Use the CSV Files

1. Copy the CSV sections from tool output
2. Save as `alliance_orphaned_payments.csv` and `alliance_waybills.csv`
3. Run matching script:
   ```bash
   npx ts-node scripts/alliance-recovery-backup-match.ts \
     --orphaned alliance_orphaned_payments.csv \
     --waybills alliance_waybills.csv \
     --output alliance_recovery.sql
   ```
4. Execute `alliance_recovery.sql` in production Supabase

---

## Troubleshooting

**Connection refused?**
- Verify the IP address is correct
- Check if firewall allows port 5432
- Confirm username/password

**Database not found?**
- Try different database names: `postgres`, `ice_erp`, `icedb`, etc.
- Ask the admin what database was restored

**Command not found?**
- Install dependencies first: `pnpm i`
- Ensure you're in the project root directory

---

**No Supabase. No OAuth. Direct database access.**
