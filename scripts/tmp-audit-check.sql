SELECT COUNT(*) AS total FROM "AuditLog";
SELECT "table", COUNT(*) AS total
FROM "AuditLog"
GROUP BY "table"
ORDER BY total DESC;
SELECT id, "table", record_id, action, user_email, created_at
FROM "AuditLog"
ORDER BY created_at DESC
LIMIT 10;
