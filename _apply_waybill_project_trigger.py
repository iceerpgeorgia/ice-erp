"""
Two-phase script:
  1. Create a DB trigger that keeps rs_waybills_in_items.project_uuid in sync
     whenever rs_waybills_in_api.project_uuid changes.
     - Items that were already "following" the waybill (same project or NULL) get updated.
     - Items that were manually set to a different project are left untouched.
  2. Backfill: copy waybill project_uuid into items that currently have no project.

Usage:
    python _apply_waybill_project_trigger.py            # dry-run (backfill only previewed)
    python _apply_waybill_project_trigger.py --apply    # create trigger + run backfill
"""

import os, re, sys
from dotenv import load_dotenv
import psycopg2

DRY_RUN = "--apply" not in sys.argv

load_dotenv(".env")
url = os.environ["DIRECT_URL"]
m = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(\S+?)(?:\?.*)?$', url)
user, pw, host, port, db = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
pw = pw.replace('%25', '%')

conn = psycopg2.connect(host=host, port=int(port), dbname=db, user=user, password=pw, sslmode='require')
conn.autocommit = False
cur = conn.cursor()

# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Create trigger function + trigger
# ─────────────────────────────────────────────────────────────────────────────

TRIGGER_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION sync_waybill_items_project()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Nothing to do if project_uuid didn't actually change
  IF NEW.project_uuid IS NOT DISTINCT FROM OLD.project_uuid THEN
    RETURN NEW;
  END IF;

  -- Propagate to items that were following the waybill:
  --   (a) item had the same project as the waybill before the change, OR
  --   (b) item had no project at all
  -- Items with a *different* manually-set project are intentionally skipped.
  UPDATE rs_waybills_in_items
  SET    project_uuid = NEW.project_uuid,
         updated_at   = NOW()
  WHERE  rs_id = NEW.rs_id
    AND  (
           project_uuid IS NOT DISTINCT FROM OLD.project_uuid
           OR project_uuid IS NULL
         );

  RETURN NEW;
END;
$$;
"""

TRIGGER_SQL = """
DROP TRIGGER IF EXISTS trg_sync_waybill_items_project ON rs_waybills_in_api;

CREATE TRIGGER trg_sync_waybill_items_project
  AFTER UPDATE OF project_uuid ON rs_waybills_in_api
  FOR EACH ROW
  EXECUTE FUNCTION sync_waybill_items_project();
"""

# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Backfill query
# ─────────────────────────────────────────────────────────────────────────────

BACKFILL_PREVIEW_SQL = """
SELECT COUNT(*)
FROM rs_waybills_in_items i
JOIN rs_waybills_in_api   w ON w.rs_id = i.rs_id
WHERE i.project_uuid IS NULL
  AND w.project_uuid IS NOT NULL
"""

BACKFILL_SQL = """
UPDATE rs_waybills_in_items i
SET    project_uuid = w.project_uuid,
       updated_at   = NOW()
FROM   rs_waybills_in_api w
WHERE  w.rs_id = i.rs_id
  AND  i.project_uuid IS NULL
  AND  w.project_uuid IS NOT NULL
"""

# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────

print("=== Step 1: Trigger ===")
if DRY_RUN:
    print("  [DRY-RUN] Would create function sync_waybill_items_project() + trigger trg_sync_waybill_items_project")
else:
    cur.execute(TRIGGER_FUNCTION_SQL)
    cur.execute(TRIGGER_SQL)
    conn.commit()
    print("  Created function sync_waybill_items_project()")
    print("  Created trigger trg_sync_waybill_items_project on rs_waybills_in_api")

print("\n=== Step 2: Backfill items with no project from waybill ===")
cur.execute(BACKFILL_PREVIEW_SQL)
count = cur.fetchone()[0]
print(f"  Items to update (no project, waybill has project): {count:,}")

if DRY_RUN:
    print("  [DRY-RUN] No changes made. Re-run with --apply to apply.")
else:
    cur.execute(BACKFILL_SQL)
    updated = cur.rowcount
    conn.commit()
    print(f"  Updated: {updated:,} rows")

conn.close()
print("\nDone.")
