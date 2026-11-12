# 🚀 Alliance Highline Recovery - QUICK REFERENCE CARD

**Problem**: 20 cost payment IDs cleared (payment_id = NULL)  
**Solution**: Export data → Analyze → Recover  
**Time**: 30 minutes  
**Status**: ✅ Ready to execute NOW

---

## ONE-PAGE SUMMARY

| What | SQL Query | Expected | File |
|------|-----------|----------|------|
| **Export Orphaned Payments** | Query 1 (below) | 20 rows | `alliance_orphaned_payments.csv` |
| **Export Waybills** | Query 2 (below) | 20-40 rows | `alliance_waybills.csv` |
| **Analyze & Generate SQL** | `scripts/alliance-recovery-backup-match.ts` | Recovery SQL | `alliance_recovery.sql` |
| **Execute Recovery** | All UPDATE statements from recovery SQL | 20 updates | Restored payment_ids |

---

## QUERY 1: Export Orphaned Cost Payments (COPY & PASTE THIS)

```sql
SELECT 
    p.uuid, p.payment_id, p.counteragent_uuid, p.financial_code_uuid,
    p.amount, p.created_at, ca.name as counteragent_name, fc.code
FROM payments p
LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.uuid
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
WHERE 
    p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
    AND p.waybill_derived = TRUE
    AND p.payment_id IS NULL
ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.created_at;
```

**Steps**:
1. Open: https://app.supabase.com/projects/fojbzghphznbslqwurrm/sql/new
2. Copy query above
3. Paste → Click RUN
4. Download CSV → Save as `alliance_orphaned_payments.csv`

---

## QUERY 2: Export Waybill Source Data (COPY & PASTE THIS)

```sql
SELECT 
    w.uuid, w.waybill_no, w.rs_id, w.counteragent_uuid,
    w.financial_code_uuid, w.sum, w.create_date,
    ca.name as counteragent_name, fc.code
FROM rs_waybills_in_api w
LEFT JOIN counteragents ca ON w.counteragent_uuid = ca.uuid
LEFT JOIN financial_codes fc ON w.financial_code_uuid = fc.uuid
WHERE w.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
ORDER BY w.created_at DESC;
```

**Steps**:
1. Open: https://app.supabase.com/projects/fojbzghphznbslqwurrm/sql/new
2. Copy query above
3. Paste → Click RUN
4. Download CSV → Save as `alliance_waybills.csv`

---

## ANALYSIS & RECOVERY

### Option A: Automated Matching Script (Fastest)

```bash
# From repository root
npx ts-node scripts/alliance-recovery-backup-match.ts \
  --orphaned alliance_orphaned_payments.csv \
  --waybills alliance_waybills.csv \
  --output alliance_recovery.sql
```

**Output**: `alliance_recovery.sql` with 20 UPDATE statements

### Option B: Direct API Recovery (30 seconds)

```bash
export CRON_SECRET="pA0josnPQ0Qnee6B47f7ATN/GN60cNfxU3SXJKZwSQA="

# Analyze (read-only)
curl -X POST "https://ice-erp.vercel.app/api/admin/alliance-recovery" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"action":"analyze"}'

# Recover
curl -X POST "https://ice-erp.vercel.app/api/admin/alliance-recovery" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"action":"recover","confirm":true}'
```

---

## EXECUTION STEPS

### Timeline: 30 Minutes

| Time | Step |
|------|------|
| 0:00 - 0:05 | Export orphaned payments (Query 1) |
| 0:05 - 0:08 | Export waybill data (Query 2) |
| 0:08 - 0:15 | Run matching script (generates SQL) |
| 0:15 - 0:20 | Review generated SQL in text editor |
| 0:20 - 0:23 | Execute recovery SQL in Supabase |
| 0:23 - 0:30 | Verify in UI (Payments Report, Handovers) |

---

## HOW IT WORKS

```
ORPHANED COST PAYMENTS (20 rows)
├─ Group by: (financial_code_uuid, counteragent_uuid)
├─ Within each group, order by: created_at
└─ Position 1 → matches Position 1 in waybill group
   Position 2 → matches Position 2 in waybill group
   ...
   
RESULT: 20 UPDATE statements restoring payment_id
```

---

## VERIFICATION CHECKLIST

After recovery, verify:

- [ ] Supabase: 0 orphaned cost payments (Query returns 0 rows)
- [ ] UI: Payments Report shows payment_ids (not "Unknown")
- [ ] UI: Job Distributions resolve correctly
- [ ] UI: Handovers page displays properly

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Query returns 0 rows | Check you're in production Supabase (fojbzghphznbslqwurrm) |
| CSV download button missing | Scroll right in results table |
| Recovery SQL fails | Verify all 20 payments exist and are orphaned (Query 1) |
| Payment_ids still NULL after recovery | Check SQL executed in production (not local/staging) |

---

## RELATED DOCUMENTATION

- **Full Export Guide**: `ALLIANCE_RECOVERY_SQL_EXPORT_GUIDE.md`
- **SQL Queries**: `ALLIANCE_RECOVERY_EXPORT_QUERIES.sql`
- **Matching Script**: `scripts/alliance-recovery-backup-match.ts`
- **Actionable Steps**: `ALLIANCE_RECOVERY_ACTIONABLE.md`

---

## START NOW

### 5-Minute Quick Start

1. **Open Supabase**: https://app.supabase.com/projects/fojbzghphznbslqwurrm/sql/new
2. **Copy QUERY 1** (above)
3. **Paste & Run** → Download CSV
4. **Done**: You have orphaned payments data
5. **Next**: Export waybills with QUERY 2

**Total recovery time: 30 minutes** ⏱️

---

**Ready? Start with QUERY 1 above!** 🚀
