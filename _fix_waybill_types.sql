-- Fix wrong TYPE labels in rs_waybills_in_api
-- Background: The original RS_WAYBILL_TYPE mapping in constants.ts was wrong
-- for types 1, 3, 4, 5. This script corrects existing DB records.
--
-- Correct TYPE → label mapping (from protocol + CSV cross-reference):
--   TYPE 1 = შიდა გადაზიდვა
--   TYPE 2 = ტრანსპორტირებით  (was already correct, no change)
--   TYPE 3 = ტრანსპორტირების გარეშე
--   TYPE 4 = დისტრიბუცია
--   TYPE 5 = უკან დაბრუნება
--   TYPE 6 = ქვე-ზედნადები    (was stored as raw '6', no mapping existed)
--
-- Current (wrong) DB state:
--   'ტრანსპორტირების გარეშე' = TYPE 1 records (wrong label)
--   'ტრანსპორტირებით'        = TYPE 2 records (correct)
--   'უკან დაბრუნება'         = TYPE 3 records (wrong label)
--   'ქვე-ზედნადები'          = TYPE 4 records (wrong label)
--   'შიდა გადაზიდვა'         = TYPE 5 records (wrong label)
--   '6'                      = TYPE 6 records (raw code, never mapped)

BEGIN;

-- Three-way circular swap for types 1, 3, 5
-- Use temp label to avoid collision
UPDATE rs_waybills_in_api SET type = '___tmp_fix___' WHERE type = 'ტრანსპორტირების გარეშე';
UPDATE rs_waybills_in_api SET type = 'ტრანსპორტირების გარეშე' WHERE type = 'უკან დაბრუნება';
UPDATE rs_waybills_in_api SET type = 'უკან დაბრუნება' WHERE type = 'შიდა გადაზიდვა';
UPDATE rs_waybills_in_api SET type = 'შიდა გადაზიდვა' WHERE type = '___tmp_fix___';

-- Rename TYPE 4 label
UPDATE rs_waybills_in_api SET type = 'დისტრიბუცია' WHERE type = 'ქვე-ზედნადები';

-- Map raw code '6' → proper label
UPDATE rs_waybills_in_api SET type = 'ქვე-ზედნადები' WHERE type = '6';

COMMIT;

-- Verify result
SELECT type, COUNT(*) FROM rs_waybills_in_api GROUP BY type ORDER BY COUNT(*) DESC;
