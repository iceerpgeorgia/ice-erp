#!/usr/bin/env python3
"""
Visual demonstration of Payment ID generation using Excel formula
Formula: "NP_"&MID(COUNTERAGENT_UUID,2,1)&MID(COUNTERAGENT_UUID,4,1)&MID(COUNTERAGENT_UUID,6,1)&
         MID(COUNTERAGENT_UUID,8,1)&MID(COUNTERAGENT_UUID,10,1)&MID(COUNTERAGENT_UUID,12,1)&
         "_NJ_"&MID(financial_code_uuid,2,1)&MID(financial_code_uuid,4,1)&MID(financial_code_uuid,6,1)&
         MID(financial_code_uuid,8,1)&MID(financial_code_uuid,10,1)&MID(financial_code_uuid,12,1)&
         "_PRL"&IF(LEN(MONTH(SALARY_MONTH))=1,0&MONTH(SALARY_MONTH))&YEAR(SALARY_MONTH)
"""

# ═══════════════════════════════════════════════════════════════════════════════
# INPUT VALUES
# ═══════════════════════════════════════════════════════════════════════════════

counteragent_uuid = "5BEEA027-BF57-4C93-AABC-21FD42F223A5"
financial_code_uuid = "319B2A70-B446-41F6-9F39-A3DFB1082786"
salary_order = "PRL012023"  # January 2023

print("\n" + "╔" + "═"*78 + "╗")
print("║" + " "*20 + "PAYMENT ID GENERATION DEMONSTRATION" + " "*23 + "║")
print("╚" + "═"*78 + "╝\n")

print("📋 INPUT VALUES:")
print("─" * 80)
print(f"  Counteragent UUID:    {counteragent_uuid}")
print(f"  Financial Code UUID:  {financial_code_uuid}")
print(f"  Salary Order (PRL):   {salary_order}")
print()

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Remove hyphens from UUIDs
# ═══════════════════════════════════════════════════════════════════════════════

print("╔" + "═"*78 + "╗")
print("║  STEP 1: Remove Hyphens from UUIDs" + " "*44 + "║")
print("╚" + "═"*78 + "╝")
print()

ca_clean = counteragent_uuid.replace('-', '').upper()
fc_clean = financial_code_uuid.replace('-', '').upper()

print(f"  Original Counteragent:  {counteragent_uuid}")
print(f"  Cleaned Counteragent:   {ca_clean}")
print()
print(f"  Original Financial:     {financial_code_uuid}")
print(f"  Cleaned Financial:      {fc_clean}")
print()

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Extract characters using Excel MID formula
# ═══════════════════════════════════════════════════════════════════════════════

print("╔" + "═"*78 + "╗")
print("║  STEP 2: Extract Characters (Excel MID Formula)" + " "*29 + "║")
print("╚" + "═"*78 + "╝")
print()

print("  Excel Formula: MID(UUID, position, 1) extracts 1 character at position")
print("  Excel uses 1-indexed positions: 2, 4, 6, 8, 10, 12")
print("  Python uses 0-indexed positions: 1, 3, 5, 7, 9, 11")
print()

# Visual representation with position markers
print("  " + "┌" + "─"*70 + "┐")
print(f"  │ COUNTERAGENT UUID: {ca_clean} │")
print("  " + "└" + "─"*70 + "┘")
print("     Position (0-idx): ", end="")
for i in range(len(ca_clean)):
    if i in [1, 3, 5, 7, 9, 11]:
        print(f"\033[92m{i:2d}\033[0m ", end="")
    else:
        print(f"{i:2d} ", end="")
print()
print("     Character:        ", end="")
for i, char in enumerate(ca_clean):
    if i in [1, 3, 5, 7, 9, 11]:
        print(f"\033[92m {char}\033[0m ", end="")
    else:
        print(f" {char} ", end="")
print()
print()

counteragent_part = ca_clean[1] + ca_clean[3] + ca_clean[5] + ca_clean[7] + ca_clean[9] + ca_clean[11]

print(f"  ✅ Extracted from Counteragent:")
print(f"     Position [1]  = '{ca_clean[1]}'   (Excel MID pos 2)")
print(f"     Position [3]  = '{ca_clean[3]}'   (Excel MID pos 4)")
print(f"     Position [5]  = '{ca_clean[5]}'   (Excel MID pos 6)")
print(f"     Position [7]  = '{ca_clean[7]}'   (Excel MID pos 8)")
print(f"     Position [9]  = '{ca_clean[9]}'   (Excel MID pos 10)")
print(f"     Position [11] = '{ca_clean[11]}'   (Excel MID pos 12)")
print(f"     \033[1m\033[96mCombined: {counteragent_part}\033[0m")
print()

print("  " + "┌" + "─"*70 + "┐")
print(f"  │ FINANCIAL CODE UUID: {fc_clean} │")
print("  " + "└" + "─"*70 + "┘")
print("     Position (0-idx): ", end="")
for i in range(len(fc_clean)):
    if i in [1, 3, 5, 7, 9, 11]:
        print(f"\033[92m{i:2d}\033[0m ", end="")
    else:
        print(f"{i:2d} ", end="")
print()
print("     Character:        ", end="")
for i, char in enumerate(fc_clean):
    if i in [1, 3, 5, 7, 9, 11]:
        print(f"\033[92m {char}\033[0m ", end="")
    else:
        print(f" {char} ", end="")
print()
print()

financial_part = fc_clean[1] + fc_clean[3] + fc_clean[5] + fc_clean[7] + fc_clean[9] + fc_clean[11]

print(f"  ✅ Extracted from Financial Code:")
print(f"     Position [1]  = '{fc_clean[1]}'   (Excel MID pos 2)")
print(f"     Position [3]  = '{fc_clean[3]}'   (Excel MID pos 4)")
print(f"     Position [5]  = '{fc_clean[5]}'   (Excel MID pos 6)")
print(f"     Position [7]  = '{fc_clean[7]}'   (Excel MID pos 8)")
print(f"     Position [9]  = '{fc_clean[9]}'   (Excel MID pos 10)")
print(f"     Position [11] = '{fc_clean[11]}'   (Excel MID pos 12)")
print(f"     \033[1m\033[96mCombined: {financial_part}\033[0m")
print()

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Construct Payment ID
# ═══════════════════════════════════════════════════════════════════════════════

print("╔" + "═"*78 + "╗")
print("║  STEP 3: Construct Payment ID" + " "*48 + "║")
print("╚" + "═"*78 + "╝")
print()

payment_id = f"NP_{counteragent_part}_NJ_{financial_part}_{salary_order}"

print("  Format: NP_<counteragent>_NJ_<financial>_<salary_order>")
print()
print(f"  \"NP_\" + \"{counteragent_part}\" + \"_NJ_\" + \"{financial_part}\" + \"_{salary_order}\"")
print()
print("  " + "┌" + "─"*76 + "┐")
print(f"  │ \033[1m\033[93m{payment_id:^76}\033[0m │")
print("  " + "└" + "─"*76 + "┘")
print()

# ═══════════════════════════════════════════════════════════════════════════════
# FINAL RESULT
# ═══════════════════════════════════════════════════════════════════════════════

print()
print("╔" + "═"*78 + "╗")
print("║" + " "*28 + "FINAL RESULT" + " "*38 + "║")
print("╠" + "═"*78 + "╣")
print(f"║  Payment ID (uppercase): \033[1m\033[92m{payment_id:<48}\033[0m║")
print(f"║  Payment ID (lowercase): \033[1m\033[92m{payment_id.lower():<48}\033[0m║")
print("╚" + "═"*78 + "╝")
print()

# ═══════════════════════════════════════════════════════════════════════════════
# VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

print("╔" + "═"*78 + "╗")
print("║  VERIFICATION - Check Against Database" + " "*38 + "║")
print("╚" + "═"*78 + "╝")
print()

try:
    import psycopg2
    import os
    from dotenv import load_dotenv
    
    load_dotenv('.env')
    conn = psycopg2.connect(os.getenv('DATABASE_URL').split('?')[0])
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT payment_id, salary_month
        FROM salary_accruals
        WHERE counteragent_uuid = %s 
          AND financial_code_uuid = %s
        LIMIT 3
    """, (counteragent_uuid.lower(), financial_code_uuid.lower()))
    
    rows = cursor.fetchall()
    
    if rows:
        print("  Found matching records in database:")
        print("  " + "─" * 76)
        for row in rows:
            db_payment_id = row[0]
            db_month = row[1]
            month_str = db_month.strftime('%m%Y')
            match = "✅ MATCH" if db_payment_id.upper() == payment_id.upper() else "❌ DIFFERENT"
            print(f"  {db_payment_id} (Month: {month_str}) {match}")
        print()
        
        # Find exact match
        cursor.execute("""
            SELECT payment_id
            FROM salary_accruals
            WHERE LOWER(payment_id) = LOWER(%s)
        """, (payment_id,))
        
        exact_match = cursor.fetchone()
        if exact_match:
            print(f"  ✅ Exact payment ID \033[92m{payment_id}\033[0m exists in database!")
        else:
            print(f"  ℹ️  Payment ID \033[93m{payment_id}\033[0m not in database (different month)")
    else:
        print("  ℹ️  No matching records found for this counteragent + financial code combination")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"  ⚠️  Could not verify against database: {e}")

print()
