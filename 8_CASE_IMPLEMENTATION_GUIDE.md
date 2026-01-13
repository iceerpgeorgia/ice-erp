# IMPLEMENTATION GUIDE: 8-Case Hierarchical Processing

## Summary of Required Changes

The bog_gel_raw table now has 8 boolean flags. The script needs to be updated to set these flags according to the hierarchical logic below.

## The 8 Cases

### Phase 1: Counteragent Identification (MUTUALLY EXCLUSIVE - only ONE can be TRUE)
- **Case 1**: `counteragent_processed` - INN matched in database
- **Case 2**: `counteragent_inn_blank` - No INN in raw data  
- **Case 3**: `counteragent_inn_nonblank_no_match` - INN exists but no DB match

### Phase 2: Payment ID Matching
- **Case 4**: `payment_id_match` - Payment ID found AND counteragent matches Case 1
- **Case 5**: `payment_id_counteragent_mismatch` - Payment ID found BUT conflicts with Case 1

### Phase 3: Parsing Rules (HIGHEST PARAMETER PRIORITY)
- **Case 6**: `parsing_rule_match` - Rule matched AND counteragent matches Case 1
- **Case 7**: `parsing_rule_counteragent_mismatch` - Rule matched BUT conflicts with Case 1
- **Case 8**: `parsing_rule_dominance` - Rule matched AND overrides Case 4 payment parameters

## Hierarchy Rules

1. **Counteragent from Case 1 is IMMUTABLE** - Never override
2. **Parsing Rules (Phase 3) OVERRIDE Payment (Phase 2) parameters**
3. **Only ONE of Cases 1, 2, 3 can be TRUE** per record
4. **Multiple flags can be TRUE** (e.g., Case 1 + Case 4 + Case 6 + Case 8)

## Parameter Assignment Priority

| Parameter | Priority Order |
|-----------|----------------|
| `counteragent_uuid` | Case 1 (immutable) → Case 4/6 (if Case 1 absent) |
| `project_uuid` | Case 6 → Case 4 → NULL |
| `financial_code_uuid` | Case 6 → Case 4 → NULL |
| `nominal_currency_uuid` | Case 6 → Case 4 → account_currency_uuid |

##UPDATE Query Structure

```python
UPDATE bog_gel_raw_893486000 SET
    counteragent_processed = %(case1)s,
    counteragent_inn_blank = %(case2)s,
    counteragent_inn_nonblank_no_match = %(case3)s,
    payment_id_match = %(case4)s,
    payment_id_counteragent_mismatch = %(case5)s,
    parsing_rule_match = %(case6)s,
    parsing_rule_counteragent_mismatch = %(case7)s,
    parsing_rule_dominance = %(case8)s,
    is_processed = TRUE,
    updated_at = NOW()
WHERE uuid = %(uuid)s
```

## Example Scenarios

### Scenario A: Simple Case 1 + Case 4
- Record has INN → Matches counteragent (Case 1 = TRUE)
- Has payment_id → Matches same counteragent (Case 4 = TRUE)
- **Result**: Use Case 1 counteragent + Case 4 parameters

### Scenario B: Case 1 + Case 4 + Case 6 (Rule overrides)
- Record has INN → Matches counteragent (Case 1 = TRUE)
- Has payment_id → Matches counteragent + has parameters (Case 4 = TRUE)
- Matches parsing rule → Same counteragent + different parameters (Case 6 = TRUE, Case 8 = TRUE)
- **Result**: Use Case 1 counteragent + Case 6 parameters (Case 8 indicates override)

### Scenario C: Case 2 + Case 6
- Record has NO INN (Case 2 = TRUE)
- Matches parsing rule → Provides counteragent (Case 6 = TRUE)
- **Result**: Use Case 6 counteragent + parameters

### Scenario D: Case 1 + Case 5 + Case 7
- Record has INN → Matches counteragent X (Case 1 = TRUE)
- Has payment_id → Suggests counteragent Y (Case 5 = TRUE, conflict!)
- Matches parsing rule → Suggests counteragent Z (Case 7 = TRUE, conflict!)
- **Result**: Use Case 1 counteragent X, flag conflicts, NO additional parameters

## Testing Checklist

After implementing, verify:

- [ ] Each record has exactly ONE of (Case 1, Case 2, Case 3) = TRUE
- [ ] Case 4 never TRUE when Case 5 is TRUE (mutually exclusive)
- [ ] Case 6 never TRUE when Case 7 is TRUE (mutually exclusive)
- [ ] Case 8 only TRUE when both Case 4 and Case 6 are TRUE
- [ ] Parsing rule parameters override payment parameters when Case 8 = TRUE
- [ ] Conflicts (Cases 5, 7) never provide parameters
- [ ] Case 1 counteragent never overridden

## Statistics Output

After processing, report:
```
📊 8-CASE SUMMARY:
  Case 1 (Counteragent matched):          33,329 records
  Case 2 (INN blank):                     15,775 records
  Case 3 (INN no match):                     476 records
  Case 4 (Payment match):                  7,014 records
  Case 5 (Payment conflict):                  29 records
  Case 6 (Rule match):                     5,356 records
  Case 7 (Rule conflict):                  1,493 records
  Case 8 (Rule dominance):                 1,200 records
```

## Files to Update

1. `import_bank_xml_data.py`:
   - `process_bog_gel()` function (lines ~450-750)
   - `backparse_bog_gel()` function (lines ~1050-1350)
   - Statistics dictionary
   - UPDATE query
   - Summary output

2. Test with:
   - `python import_bank_xml_data.py backparse`
   - Verify flags in database
   - Check consolidated_bank_accounts parameters

## Next Steps

Would you like me to:
1. Create a complete rewrite of the backparse_bog_gel function?
2. Create a SQL query to verify the 8 flags are set correctly?
3. Create test cases to validate the hierarchy?
