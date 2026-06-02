"""
Creates the rs_waybills_in_projects junction table and a trigger on rs_waybills_in_items
that keeps it in sync whenever an item's project_uuid changes.

Waybill → projects is derived from items. If 10 items span 3 projects,
the waybill gets 3 rows in rs_waybills_in_projects.

Usage:
    python _create_waybill_projects_table.py            # dry-run
    python _create_waybill_projects_table.py --apply    # apply
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
# Step 1: Create junction table
# ─────────────────────────────────────────────────────────────────────────────

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS rs_waybills_in_projects (
    id           BIGSERIAL PRIMARY KEY,
    rs_id        TEXT      NOT NULL REFERENCES rs_waybills_in_api(rs_id) ON DELETE CASCADE,
    project_uuid UUID      NOT NULL REFERENCES projects(project_uuid)    ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (rs_id, project_uuid)
);
CREATE INDEX IF NOT EXISTS idx_rs_wip_rs_id        ON rs_waybills_in_projects (rs_id);
CREATE INDEX IF NOT EXISTS idx_rs_wip_project_uuid ON rs_waybills_in_projects (project_uuid);
"""

# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Backfill from current items state
# ─────────────────────────────────────────────────────────────────────────────

BACKFILL_SQL = """
INSERT INTO rs_waybills_in_projects (rs_id, project_uuid)
SELECT DISTINCT i.rs_id, i.project_uuid
FROM   rs_waybills_in_items i
JOIN   projects p ON p.project_uuid = i.project_uuid
WHERE  i.rs_id IS NOT NULL
  AND  i.project_uuid IS NOT NULL
ON CONFLICT (rs_id, project_uuid) DO NOTHING;
"""

BACKFILL_PREVIEW_SQL = """
SELECT
    COUNT(DISTINCT (i.rs_id, i.project_uuid))             AS valid_pairs,
    COUNT(DISTINCT i.project_uuid) FILTER (
        WHERE NOT EXISTS (
            SELECT 1 FROM projects p WHERE p.project_uuid = i.project_uuid
        )
    )                                                      AS invalid_project_uuids
FROM   rs_waybills_in_items i
WHERE  i.rs_id IS NOT NULL
  AND  i.project_uuid IS NOT NULL;
"""

# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Trigger on rs_waybills_in_items
#
# Row-level AFTER INSERT/UPDATE OF project_uuid/DELETE.
# Re-syncs the junction table for the affected rs_id:
#   - Removes project bindings that no item in that waybill still has
#   - Adds any new project bindings that appeared
# ─────────────────────────────────────────────────────────────────────────────

TRIGGER_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION refresh_waybill_project_bindings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_rs_id TEXT;
BEGIN
  v_rs_id := COALESCE(NEW.rs_id, OLD.rs_id);
  IF v_rs_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Remove stale bindings (projects no item in this waybill still holds)
  DELETE FROM rs_waybills_in_projects wip
  WHERE  wip.rs_id = v_rs_id
    AND  NOT EXISTS (
           SELECT 1
           FROM   rs_waybills_in_items i
           WHERE  i.rs_id        = v_rs_id
             AND  i.project_uuid = wip.project_uuid
         );

  -- Insert new bindings (projects that appeared but aren't in the table yet)
  -- Only include project_uuids that exist in the projects table (FK safety)
  INSERT INTO rs_waybills_in_projects (rs_id, project_uuid)
  SELECT DISTINCT v_rs_id, i.project_uuid
  FROM   rs_waybills_in_items i
  JOIN   projects p ON p.project_uuid = i.project_uuid
  WHERE  i.rs_id        = v_rs_id
    AND  i.project_uuid IS NOT NULL
  ON CONFLICT (rs_id, project_uuid) DO NOTHING;

  RETURN NULL;
END;
$$;
"""

TRIGGER_SQL = """
DROP TRIGGER IF EXISTS trg_refresh_waybill_project_bindings ON rs_waybills_in_items;

CREATE TRIGGER trg_refresh_waybill_project_bindings
  AFTER INSERT OR UPDATE OF project_uuid OR DELETE
  ON rs_waybills_in_items
  FOR EACH ROW
  EXECUTE FUNCTION refresh_waybill_project_bindings();
"""

# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────

print("=== Step 1: Create junction table rs_waybills_in_projects ===")
if DRY_RUN:
    print("  [DRY-RUN] Would create table + indexes")
else:
    cur.execute(CREATE_TABLE_SQL)
    conn.commit()
    print("  Table created (or already exists)")

cur.execute(BACKFILL_PREVIEW_SQL)
row = cur.fetchone()
valid_count, invalid_count = row[0], row[1]
print(f"\n=== Step 2: Backfill from current items ===")
print(f"  Valid (rs_id, project_uuid) pairs: {valid_count:,}")
if invalid_count:
    print(f"  Skipped (project_uuid not in projects table): {invalid_count:,} distinct UUIDs")
if DRY_RUN:
    print("  [DRY-RUN] Would insert those pairs")
else:
    cur.execute(BACKFILL_SQL)
    inserted = cur.rowcount
    conn.commit()
    print(f"  Inserted: {inserted:,} bindings")

print(f"\n=== Step 3: Trigger on rs_waybills_in_items ===")
if DRY_RUN:
    print("  [DRY-RUN] Would create function refresh_waybill_project_bindings() + trigger")
else:
    cur.execute(TRIGGER_FUNCTION_SQL)
    cur.execute(TRIGGER_SQL)
    conn.commit()
    print("  Created function refresh_waybill_project_bindings()")
    print("  Created trigger trg_refresh_waybill_project_bindings on rs_waybills_in_items")

# ─── Summary stats ────────────────────────────────────────────────────────
if not DRY_RUN:
    cur.execute("SELECT COUNT(*) FROM rs_waybills_in_projects")
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT rs_id) FROM rs_waybills_in_projects")
    distinct_waybills = cur.fetchone()[0]
    cur.execute("""
        SELECT project_count, COUNT(*) AS waybill_count
        FROM (
            SELECT rs_id, COUNT(*) AS project_count
            FROM rs_waybills_in_projects
            GROUP BY rs_id
        ) sub
        GROUP BY project_count
        ORDER BY project_count
    """)
    print(f"\n=== Result ===")
    print(f"  Total bindings in rs_waybills_in_projects: {total:,}")
    print(f"  Waybills with at least 1 project binding:  {distinct_waybills:,}")
    print(f"  Distribution (projects per waybill):")
    for r in cur.fetchall():
        print(f"    {r[0]} project(s): {r[1]:,} waybills")

conn.close()
print("\nDone.")
