#!/usr/bin/env python3

counteragent_uuid = "5BEEA027-BF57-4C93-AABC-21FD42F223A5"
financial_code_uuid = "319B2A70-B446-41F6-9F39-A3DFB1082786"

print("\n" + "="*80)
print("COMPARING: CURRENT vs EXPECTED PAYMENT ID")
print("="*80 + "\n")

print("Expected: np_be07b5_nj_1ba0b4_prl012023")
print("Got:      np_be07f7_nj_1ba046_prl012023")
print()
print("Differences:")
print("  Counteragent: be07b5 vs be07f7")
print("  Financial:    1ba0b4 vs 1ba046")
print()

print("="*80)
print("ANALYSIS: WHERE DO THESE CHARACTERS COME FROM?")
print("="*80 + "\n")

# Try with hyphens (Excel MID works on original UUID with hyphens)
print("HYPOTHESIS: Excel MID extracts from UUID WITH hyphens\n")
print(f"Counteragent UUID: {counteragent_uuid}")
print("                   " + "".join([f"{i%10}" for i in range(1, len(counteragent_uuid)+1)]))
print("                   " + counteragent_uuid)
print()

# Excel positions 2,4,6,8,10,12 (1-indexed) = Python indices 1,3,5,7,9,11 (0-indexed)
chars = [counteragent_uuid[1], counteragent_uuid[3], counteragent_uuid[5], 
         counteragent_uuid[7], counteragent_uuid[9], counteragent_uuid[11]]

result_with_hyphens = ''.join(chars)
print(f"Extracting at Excel positions [2,4,6,8,10,12] (with hyphens):")
print(f"  Position 2  = '{counteragent_uuid[1]}'")
print(f"  Position 4  = '{counteragent_uuid[3]}'")
print(f"  Position 6  = '{counteragent_uuid[5]}'")
print(f"  Position 8  = '{counteragent_uuid[7]}'")
print(f"  Position 10 = '{counteragent_uuid[9]}'")
print(f"  Position 12 = '{counteragent_uuid[11]}'")
print(f"  Result: {result_with_hyphens.lower()}")
print(f"  Expected: be07b5")
print(f"  Match: {'✅ YES' if result_with_hyphens.lower() == 'be07b5' else '❌ NO'}")
print()

print(f"Financial UUID: {financial_code_uuid}")
print("                " + "".join([f"{i%10}" for i in range(1, len(financial_code_uuid)+1)]))
print("                " + financial_code_uuid)
print()

fin_chars = [financial_code_uuid[1], financial_code_uuid[3], financial_code_uuid[5],
             financial_code_uuid[7], financial_code_uuid[9], financial_code_uuid[11]]

fin_result = ''.join(fin_chars)
print(f"Extracting at Excel positions [2,4,6,8,10,12] (with hyphens):")
print(f"  Position 2  = '{financial_code_uuid[1]}'")
print(f"  Position 4  = '{financial_code_uuid[3]}'")
print(f"  Position 6  = '{financial_code_uuid[5]}'")
print(f"  Position 8  = '{financial_code_uuid[7]}'")
print(f"  Position 10 = '{financial_code_uuid[9]}'")
print(f"  Position 12 = '{financial_code_uuid[11]}'")
print(f"  Result: {fin_result.lower()}")
print(f"  Expected: 1ba0b4")
print(f"  Match: {'✅ YES' if fin_result.lower() == '1ba0b4' else '❌ NO'}")
print()

print("="*80)
print("🐛 BUG FOUND!")
print("="*80)
print()
print("Current code REMOVES hyphens first, then extracts characters.")
print("Excel formula extracts FROM the UUID WITH hyphens!")
print()
print("FIX: Do NOT remove hyphens before extraction.")
print("     Extract at indices [1,3,5,7,9,11] from original UUID.")
print()
