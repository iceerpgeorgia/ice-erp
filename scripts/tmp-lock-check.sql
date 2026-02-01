SELECT COUNT(*) AS total,
       SUM(CASE WHEN parsing_lock THEN 1 ELSE 0 END) AS locked
FROM "GE78BG0000000893486000_BOG_GEL";

SELECT id, uuid, payment_id, transaction_date, parsing_lock
FROM "GE78BG0000000893486000_BOG_GEL"
WHERE parsing_lock = true
ORDER BY transaction_date DESC
LIMIT 20;
