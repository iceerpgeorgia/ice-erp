-- Detect raw transactions bound to multiple batch IDs
SELECT raw_record_uuid, COUNT(DISTINCT batch_id) AS batch_count, ARRAY_AGG(DISTINCT batch_id) AS batch_ids
FROM bank_transaction_batches
GROUP BY raw_record_uuid
HAVING COUNT(DISTINCT batch_id) > 1
ORDER BY batch_count DESC;

-- Detect batches with fewer than 2 partitions
SELECT batch_id, batch_uuid, raw_record_uuid, COUNT(*) AS partition_count
FROM bank_transaction_batches
GROUP BY batch_id, batch_uuid, raw_record_uuid
HAVING COUNT(*) < 2
ORDER BY partition_count ASC;

-- Detect dangling BTC_* payment_id with no partitions
SELECT table_name, raw_record_uuid, payment_id
FROM (
  SELECT 'GE78BG0000000893486000_BOG_GEL' AS table_name, raw_record_uuid, payment_id
  FROM "GE78BG0000000893486000_BOG_GEL"
  WHERE payment_id LIKE 'BTC_%'
  UNION ALL
  SELECT 'GE65TB7856036050100002_TBC_GEL' AS table_name, raw_record_uuid, payment_id
  FROM "GE65TB7856036050100002_TBC_GEL"
  WHERE payment_id LIKE 'BTC_%'
) raw
WHERE NOT EXISTS (
  SELECT 1
  FROM bank_transaction_batches btb
  WHERE btb.batch_id = raw.payment_id
    AND btb.raw_record_uuid::text = raw.raw_record_uuid::text
);
