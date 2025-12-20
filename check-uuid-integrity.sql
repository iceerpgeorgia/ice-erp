-- UUID Integrity Checks for Projects and Related Tables
-- This script checks for orphaned UUIDs (references to non-existent records)

\echo '=== Checking Projects Table UUID References ==='
\echo ''

-- Check 1: Projects with missing counteragent_uuid references
\echo 'Check 1: Projects with invalid counteragent_uuid (not in counteragents table):'
SELECT 
    p.id,
    p.project_name,
    p.counteragent_uuid,
    p.counteragent AS cached_name
FROM project p
LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
WHERE p.counteragent_uuid IS NOT NULL 
  AND c.counteragent_uuid IS NULL
ORDER BY p.id;

\echo ''
\echo 'Count of projects with invalid counteragent_uuid:'
SELECT COUNT(*) as invalid_counteragent_count
FROM project p
LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
WHERE p.counteragent_uuid IS NOT NULL 
  AND c.counteragent_uuid IS NULL;

\echo ''
\echo '---'
\echo ''

-- Check 2: Projects with missing financial_code_uuid references
\echo 'Check 2: Projects with invalid financial_code_uuid (not in financial_codes table):'
SELECT 
    p.id,
    p.project_name,
    p.financial_code_uuid,
    p.financial_code AS cached_code
FROM project p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
WHERE p.financial_code_uuid IS NOT NULL 
  AND fc.uuid IS NULL
ORDER BY p.id;

\echo ''
\echo 'Count of projects with invalid financial_code_uuid:'
SELECT COUNT(*) as invalid_financial_code_count
FROM project p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
WHERE p.financial_code_uuid IS NOT NULL 
  AND fc.uuid IS NULL;

\echo ''
\echo '---'
\echo ''

-- Check 3: Projects with missing currency_uuid references
\echo 'Check 3: Projects with invalid currency_uuid (not in currencies table):'
SELECT 
    p.id,
    p.project_name,
    p.currency_uuid,
    p.currency AS cached_currency
FROM project p
LEFT JOIN currencies cur ON p.currency_uuid = cur.uuid
WHERE p.currency_uuid IS NOT NULL 
  AND cur.uuid IS NULL
ORDER BY p.id;

\echo ''
\echo 'Count of projects with invalid currency_uuid:'
SELECT COUNT(*) as invalid_currency_count
FROM project p
LEFT JOIN currencies cur ON p.currency_uuid = cur.uuid
WHERE p.currency_uuid IS NOT NULL 
  AND cur.uuid IS NULL;

\echo ''
\echo '---'
\echo ''

-- Check 4: Projects with missing state_uuid references
\echo 'Check 4: Projects with invalid state_uuid (not in project_states table):'
SELECT 
    p.id,
    p.project_name,
    p.state_uuid,
    p.state AS cached_state
FROM project p
LEFT JOIN project_states ps ON p.state_uuid = ps.uuid
WHERE p.state_uuid IS NOT NULL 
  AND ps.uuid IS NULL
ORDER BY p.id;

\echo ''
\echo 'Count of projects with invalid state_uuid:'
SELECT COUNT(*) as invalid_state_count
FROM project p
LEFT JOIN project_states ps ON p.state_uuid = ps.uuid
WHERE p.state_uuid IS NOT NULL 
  AND ps.uuid IS NULL;

\echo ''
\echo '---'
\echo ''

-- Check 5: Project Employees with missing project_uuid references
\echo 'Check 5: Project Employees with invalid project_uuid (not in project table):'
SELECT 
    pe.id,
    pe.project_uuid,
    pe.employee_uuid
FROM project_employees pe
LEFT JOIN project p ON pe.project_uuid = p.project_uuid
WHERE pe.project_uuid IS NOT NULL 
  AND p.project_uuid IS NULL
ORDER BY pe.id;

\echo ''
\echo 'Count of project_employees with invalid project_uuid:'
SELECT COUNT(*) as invalid_project_uuid_count
FROM project_employees pe
LEFT JOIN project p ON pe.project_uuid = p.project_uuid
WHERE pe.project_uuid IS NOT NULL 
  AND p.project_uuid IS NULL;

\echo ''
\echo '---'
\echo ''

-- Check 6: Project Employees with missing employee_uuid references (counteragents)
\echo 'Check 6: Project Employees with invalid employee_uuid (not in counteragents table):'
SELECT 
    pe.id,
    pe.project_uuid,
    pe.employee_uuid
FROM project_employees pe
LEFT JOIN counteragents c ON pe.employee_uuid = c.counteragent_uuid
WHERE pe.employee_uuid IS NOT NULL 
  AND c.counteragent_uuid IS NULL
ORDER BY pe.id;

\echo ''
\echo 'Count of project_employees with invalid employee_uuid:'
SELECT COUNT(*) as invalid_employee_uuid_count
FROM project_employees pe
LEFT JOIN counteragents c ON pe.employee_uuid = c.counteragent_uuid
WHERE pe.employee_uuid IS NOT NULL 
  AND c.counteragent_uuid IS NULL;

\echo ''
\echo '---'
\echo ''

-- Check 7: Counteragents with missing country_uuid references
\echo 'Check 7: Counteragents with invalid country_uuid (not in countries table):'
SELECT 
    c.id,
    c.counteragent,
    c.country_uuid,
    c.country AS cached_country
FROM counteragents c
LEFT JOIN countries co ON c.country_uuid = co.country_uuid
WHERE c.country_uuid IS NOT NULL 
  AND co.country_uuid IS NULL
ORDER BY c.id
LIMIT 20;

\echo ''
\echo 'Count of counteragents with invalid country_uuid:'
SELECT COUNT(*) as invalid_country_count
FROM counteragents c
LEFT JOIN countries co ON c.country_uuid = co.country_uuid
WHERE c.country_uuid IS NOT NULL 
  AND co.country_uuid IS NULL;

\echo ''
\echo '---'
\echo ''

-- Check 8: Counteragents with missing entity_type_uuid references
\echo 'Check 8: Counteragents with invalid entity_type_uuid (not in entity_types table):'
SELECT 
    c.id,
    c.counteragent,
    c.entity_type_uuid,
    c.entity_type AS cached_entity_type
FROM counteragents c
LEFT JOIN entity_types et ON c.entity_type_uuid = et.entity_type_uuid
WHERE c.entity_type_uuid IS NOT NULL 
  AND et.entity_type_uuid IS NULL
ORDER BY c.id
LIMIT 20;

\echo ''
\echo 'Count of counteragents with invalid entity_type_uuid:'
SELECT COUNT(*) as invalid_entity_type_count
FROM counteragents c
LEFT JOIN entity_types et ON c.entity_type_uuid = et.entity_type_uuid
WHERE c.entity_type_uuid IS NOT NULL 
  AND et.entity_type_uuid IS NULL;

\echo ''
\echo '=== Summary ==='
\echo ''

-- Summary of all integrity issues
SELECT 
    'Projects -> Counteragents' as check_type,
    COUNT(*) as issues_found
FROM project p
LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
WHERE p.counteragent_uuid IS NOT NULL AND c.counteragent_uuid IS NULL

UNION ALL

SELECT 
    'Projects -> Financial Codes' as check_type,
    COUNT(*) as issues_found
FROM project p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
WHERE p.financial_code_uuid IS NOT NULL AND fc.uuid IS NULL

UNION ALL

SELECT 
    'Projects -> Currencies' as check_type,
    COUNT(*) as issues_found
FROM project p
LEFT JOIN currencies cur ON p.currency_uuid = cur.uuid
WHERE p.currency_uuid IS NOT NULL AND cur.uuid IS NULL

UNION ALL

SELECT 
    'Projects -> States' as check_type,
    COUNT(*) as issues_found
FROM project p
LEFT JOIN project_states ps ON p.state_uuid = ps.uuid
WHERE p.state_uuid IS NOT NULL AND ps.uuid IS NULL

UNION ALL

SELECT 
    'Project Employees -> Projects' as check_type,
    COUNT(*) as issues_found
FROM project_employees pe
LEFT JOIN project p ON pe.project_uuid = p.project_uuid
WHERE pe.project_uuid IS NOT NULL AND p.project_uuid IS NULL

UNION ALL

SELECT 
    'Project Employees -> Counteragents' as check_type,
    COUNT(*) as issues_found
FROM project_employees pe
LEFT JOIN counteragents c ON pe.employee_uuid = c.counteragent_uuid
WHERE pe.employee_uuid IS NOT NULL AND c.counteragent_uuid IS NULL

UNION ALL

SELECT 
    'Counteragents -> Countries' as check_type,
    COUNT(*) as issues_found
FROM counteragents c
LEFT JOIN countries co ON c.country_uuid = co.country_uuid
WHERE c.country_uuid IS NOT NULL AND co.country_uuid IS NULL

UNION ALL

SELECT 
    'Counteragents -> Entity Types' as check_type,
    COUNT(*) as issues_found
FROM counteragents c
LEFT JOIN entity_types et ON c.entity_type_uuid = et.entity_type_uuid
WHERE c.entity_type_uuid IS NOT NULL AND et.entity_type_uuid IS NULL;
