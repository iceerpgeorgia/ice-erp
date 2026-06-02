import os, re
from dotenv import load_dotenv
import psycopg2

load_dotenv(".env")
url = os.environ["DIRECT_URL"]
m = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(\S+?)(?:\?.*)?$', url)
user, pw, host, port, db = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
pw = pw.replace('%25', '%')

conn = psycopg2.connect(host=host, port=int(port), dbname=db, user=user, password=pw, sslmode='require')
cur = conn.cursor()

# --- 1. Overall counts ---
cur.execute("""
SELECT
    COUNT(*) FILTER (WHERE project_uuid IS NOT NULL) AS waybills_with_project,
    COUNT(*) FILTER (WHERE project_uuid IS NULL)     AS waybills_without_project,
    COUNT(*)                                          AS total_waybills
FROM rs_waybills_in_api
""")
row = cur.fetchone()
print(f"\n=== Waybills (rs_waybills_in_api) ===")
print(f"  Total:         {row[2]:>7,}")
print(f"  With project:  {row[0]:>7,}  ({row[0]/row[2]*100:.1f}%)")
print(f"  No project:    {row[1]:>7,}  ({row[1]/row[2]*100:.1f}%)")

cur.execute("""
SELECT
    COUNT(*) FILTER (WHERE project_uuid IS NOT NULL) AS items_with_project,
    COUNT(*) FILTER (WHERE project_uuid IS NULL)     AS items_without_project,
    COUNT(*)                                          AS total_items
FROM rs_waybills_in_items
""")
row = cur.fetchone()
print(f"\n=== Waybill Items (rs_waybills_in_items) ===")
print(f"  Total:         {row[2]:>7,}")
print(f"  With project:  {row[0]:>7,}  ({row[0]/row[2]*100:.1f}%)")
print(f"  No project:    {row[1]:>7,}  ({row[1]/row[2]*100:.1f}%)")

# --- 2. Per-waybill project alignment ---
cur.execute("""
WITH waybill_summary AS (
    SELECT
        w.rs_id,
        w.waybill_no,
        w.project_uuid                                    AS wb_project,
        COUNT(i.id)                                       AS item_count,
        COUNT(i.id) FILTER (WHERE i.project_uuid IS NOT NULL)  AS items_with_proj,
        COUNT(DISTINCT i.project_uuid) FILTER (WHERE i.project_uuid IS NOT NULL) AS distinct_item_projects,
        BOOL_OR(i.project_uuid = w.project_uuid)         AS any_item_matches_wb,
        BOOL_AND(i.project_uuid = w.project_uuid OR (i.project_uuid IS NULL AND w.project_uuid IS NULL))
                                                          AS all_items_match_wb,
        BOOL_AND(i.project_uuid IS NULL)                 AS all_items_null_project
    FROM rs_waybills_in_api w
    JOIN rs_waybills_in_items i ON i.rs_id = w.rs_id
    GROUP BY w.rs_id, w.waybill_no, w.project_uuid
)
SELECT
    COUNT(*) FILTER (WHERE wb_project IS NOT NULL AND all_items_match_wb)        AS wb_proj_items_all_match,
    COUNT(*) FILTER (WHERE wb_project IS NOT NULL AND NOT all_items_match_wb AND any_item_matches_wb) AS wb_proj_partial_mismatch,
    COUNT(*) FILTER (WHERE wb_project IS NOT NULL AND NOT any_item_matches_wb)   AS wb_proj_no_item_match,
    COUNT(*) FILTER (WHERE wb_project IS NULL AND items_with_proj > 0)           AS wb_no_proj_items_have_proj,
    COUNT(*) FILTER (WHERE wb_project IS NULL AND items_with_proj = 0)           AS both_no_project,
    COUNT(*) FILTER (WHERE distinct_item_projects > 1)                           AS items_multi_project,
    COUNT(*)                                                                      AS total_waybills_with_items
FROM waybill_summary
""")
row = cur.fetchone()
total = row[6]
print(f"\n=== Per-Waybill Project Alignment (waybills that have items) ===")
print(f"  Total waybills with items:           {total:>7,}")
print(f"  WB has project, all items match:     {row[0]:>7,}  ({row[0]/total*100:.1f}%)")
print(f"  WB has project, partial mismatch:    {row[1]:>7,}  ({row[1]/total*100:.1f}%)")
print(f"  WB has project, NO items match:      {row[2]:>7,}  ({row[2]/total*100:.1f}%)")
print(f"  WB no project, items have project:   {row[3]:>7,}  ({row[3]/total*100:.1f}%)")
print(f"  Both have no project:                {row[4]:>7,}  ({row[4]/total*100:.1f}%)")
print(f"  Items have 2+ distinct projects:     {row[5]:>7,}  ({row[5]/total*100:.1f}%)")

# --- 3. Per-item breakdown ---
cur.execute("""
SELECT
    SUM(CASE WHEN i.project_uuid IS NOT NULL AND i.project_uuid = w.project_uuid THEN 1 ELSE 0 END) AS match,
    SUM(CASE WHEN i.project_uuid IS NOT NULL AND (w.project_uuid IS NULL OR i.project_uuid <> w.project_uuid) THEN 1 ELSE 0 END) AS item_only,
    SUM(CASE WHEN i.project_uuid IS NULL AND w.project_uuid IS NOT NULL THEN 1 ELSE 0 END) AS waybill_has_item_doesnt,
    SUM(CASE WHEN i.project_uuid IS NULL AND w.project_uuid IS NULL THEN 1 ELSE 0 END) AS both_null,
    COUNT(*) AS total
FROM rs_waybills_in_items i
LEFT JOIN rs_waybills_in_api w ON w.rs_id = i.rs_id
""")
row = cur.fetchone()
total = row[4]
print(f"\n=== Per-Item Project Breakdown ===")
print(f"  Total items:                               {total:>8,}")
print(f"  Item project = waybill project (match):   {row[0]:>8,}  ({row[0]/total*100:.1f}%)")
print(f"  Item has project, waybill differs/null:   {row[1]:>8,}  ({row[1]/total*100:.1f}%)")
print(f"  Waybill has project, item does NOT:       {row[2]:>8,}  ({row[2]/total*100:.1f}%)")
print(f"  Both null (no project):                   {row[3]:>8,}  ({row[3]/total*100:.1f}%)")

# --- 4. Sample: waybills where some items have a different project ---
cur.execute("""
SELECT w.waybill_no,
       w.project_uuid::text AS wb_project,
       i.project_uuid::text AS item_project,
       COUNT(*) AS item_count
FROM rs_waybills_in_api w
JOIN rs_waybills_in_items i ON i.rs_id = w.rs_id
WHERE w.project_uuid IS NOT NULL
  AND i.project_uuid IS NOT NULL
  AND i.project_uuid <> w.project_uuid
GROUP BY w.waybill_no, w.project_uuid, i.project_uuid
ORDER BY item_count DESC
LIMIT 10
""")
rows = cur.fetchall()
if rows:
    print(f"\n=== Sample: Items with DIFFERENT project than waybill ===")
    print(f"  {'Waybill No':<14}  {'Waybill project':<36}  {'Item project':<36}  Items")
    for r in rows:
        print(f"  {r[0]:<14}  {r[1]:<36}  {r[2]:<36}  {r[3]}")

# --- 5. Opportunity: items have project but waybill doesn't ---
cur.execute("""
SELECT COUNT(DISTINCT w.rs_id)
FROM rs_waybills_in_api w
JOIN rs_waybills_in_items i ON i.rs_id = w.rs_id
WHERE w.project_uuid IS NULL AND i.project_uuid IS NOT NULL
""")
row = cur.fetchone()
print(f"\n=== Opportunity ===")
print(f"  Waybills with no project but ≥1 item has one: {row[0]:,}")

# --- 6. Distribution: how many items per waybill have a project ---
cur.execute("""
SELECT
    CASE
        WHEN items_with_proj = 0 THEN 'none'
        WHEN items_with_proj = item_count THEN 'all'
        ELSE 'partial'
    END AS coverage,
    COUNT(*) AS waybill_count
FROM (
    SELECT w.rs_id,
           COUNT(i.id) AS item_count,
           COUNT(i.id) FILTER (WHERE i.project_uuid IS NOT NULL) AS items_with_proj
    FROM rs_waybills_in_api w
    JOIN rs_waybills_in_items i ON i.rs_id = w.rs_id
    GROUP BY w.rs_id
) sub
GROUP BY coverage
ORDER BY waybill_count DESC
""")
rows = cur.fetchall()
print(f"\n=== Project Coverage per Waybill (item level) ===")
for r in rows:
    print(f"  {r[0]:>10}: {r[1]:,} waybills")

conn.close()
