-- Check consolidated records by bank account
SELECT 
    'CONSOLIDATED RECORDS BY ACCOUNT' as info,
    bank_account_uuid,
    COUNT(*) as record_count
FROM consolidated_bank_accounts 
GROUP BY bank_account_uuid 
ORDER BY record_count DESC;

-- Check total
SELECT 
    'TOTAL CONSOLIDATED' as info,
    COUNT(*) as total_records
FROM consolidated_bank_accounts;

-- Check raw tables
SELECT 
    'RAW TABLE' as info,
    'bog_gel_raw_893486000' as table_name,
    COUNT(*) as record_count
FROM bog_gel_raw_893486000;

-- Check the specific account details
SELECT 
    'ACCOUNT DETAILS' as info,
    ba.account_number,
    ba.raw_table_name,
    (SELECT COUNT(*) FROM consolidated_bank_accounts WHERE bank_account_uuid = ba.uuid) as consolidated_count
FROM bank_accounts ba
WHERE ba.uuid = '60582948-8c5b-4715-b75c-ca03e3d36a4e';
