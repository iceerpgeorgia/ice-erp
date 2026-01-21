#!/usr/bin/env python3

# Given values
counteragent_uuid = "5BEEA027-BF57-4C93-AABC-21FD42F223A5"
financial_code_uuid = "319B2A70-B446-41F6-9F39-A3DFB1082786"
salary_order = "PRL012023"  # January 2023

print("\n" + "="*80)
print("PAYMENT ID CALCULATION - EXCEL FORMULA METHOD")
print("="*80 + "\n")

print(f"Input Values:")
print(f"  Counteragent UUID:    {counteragent_uuid}")
print(f"  Financial Code UUID:  {financial_code_uuid}")
print(f"  Salary Order:         {salary_order}")
print()

# Excel formula uses MID(text, start, length) where start is 1-indexed
# MID(UUID, 2, 1) means: start at position 2 (1-indexed), take 1 character

# The formula extracts positions: 2, 4, 6, 8, 10, 12 (1-indexed)
# In Python (0-indexed), these are: 1, 3, 5, 7, 9, 11

# Remove hyphens from UUIDs
ca_clean = counteragent_uuid.replace('-', '').upper()
fc_clean = financial_code_uuid.replace('-', '').upper()

print(f"UUIDs without hyphens:")
print(f"  Counteragent:  {ca_clean}")
print(f"  Financial:     {fc_clean}")
print()

# Extract characters at positions 2,4,6,8,10,12 (1-indexed) = indices 1,3,5,7,9,11 (0-indexed)
print(f"Excel Formula: MID(UUID, 2, 1), MID(UUID, 4, 1), MID(UUID, 6, 1), MID(UUID, 8, 1), MID(UUID, 10, 1), MID(UUID, 12, 1)")
print(f"Python indices (0-indexed): [1], [3], [5], [7], [9], [11]")
print()

counteragent_part = ca_clean[1] + ca_clean[3] + ca_clean[5] + ca_clean[7] + ca_clean[9] + ca_clean[11]
financial_part = fc_clean[1] + fc_clean[3] + fc_clean[5] + fc_clean[7] + fc_clean[9] + fc_clean[11]

print(f"Extracted Characters:")
print(f"  From Counteragent UUID:")
print(f"    Position [1]: {ca_clean[1]}")
print(f"    Position [3]: {ca_clean[3]}")
print(f"    Position [5]: {ca_clean[5]}")
print(f"    Position [7]: {ca_clean[7]}")
print(f"    Position [9]: {ca_clean[9]}")
print(f"    Position [11]: {ca_clean[11]}")
print(f"    Combined: {counteragent_part}")
print()

print(f"  From Financial Code UUID:")
print(f"    Position [1]: {fc_clean[1]}")
print(f"    Position [3]: {fc_clean[3]}")
print(f"    Position [5]: {fc_clean[5]}")
print(f"    Position [7]: {fc_clean[7]}")
print(f"    Position [9]: {fc_clean[9]}")
print(f"    Position [11]: {fc_clean[11]}")
print(f"    Combined: {financial_part}")
print()

# Construct payment ID
payment_id = f"NP_{counteragent_part}_NJ_{financial_part}_{salary_order}"

print(f"="*80)
print(f"GENERATED PAYMENT ID: {payment_id}")
print(f"="*80)
print()

# Also show lowercase version (case-insensitive matching)
print(f"Lowercase version: {payment_id.lower()}")
print()
