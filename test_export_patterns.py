#!/usr/bin/env python3
"""Test if export code patterns would match template cells"""
import re

# Sample XML patterns from the template
sample_xml = '''<c r="B2" s="13"/>
<c r="B5" s="13"/>
<c r="B9" s="13"/>
<c r="B16" s="13"/>
<c r="B18" s="13"/>
<c r="A1" t="s"><v>11</v></c>'''

# Export code pattern (from route.ts line ~308)
cell_ref = "B2"
cell_content = '<c r="B2"><is><t>Test Value</t></is></c>'

print("Testing export code patterns against template structure")
print("="*80)
print()

print(f"Target cell: {cell_ref}")
print(f"Template has: <c r=\"{cell_ref}\" s=\"13\"/>")
print()

# Pattern 1: Replace existing cell (any format)
pattern1 = new_pattern1 = re.compile(f'<c r="{cell_ref}"[^>]*>.*?</c>', re.DOTALL)
print(f"Pattern 1 (full cell): r'<c r=\"{cell_ref}\"[^>]*>.*?</c>'")
if pattern1.search(sample_xml):
    print(f"  ✓ MATCHES")
else:
    print(f"  ✗ NO MATCH")

print()

# Pattern 1b: Self-closing cell
pattern1b = re.compile(f'<c r="{cell_ref}"[^>]*/>')
print(f"Pattern 1b (self-closing): r'<c r=\"{cell_ref}\"[^>]*/>")
if pattern1b.search(sample_xml):
    print(f"  ✓ MATCHES")
    result = pattern1b.sub(cell_content, sample_xml)
    print(f"  Result: {result[:100]}")
else:
    print(f"  ✗ NO MATCH")

print()
print()

# Pattern 2: Empty self-closing cell
pattern2 = re.compile(f'<c r="{cell_ref}"[^>]*/>')
print(f"Pattern 2 (empty cell): r'<c r=\"{cell_ref}\"[^>]*/>")
if pattern2.search(sample_xml):
    print(f"  ✓ MATCHES")
else:
    print(f"  ✗ NO MATCH")

print()
print()

print("Detailed test with actual replacement:")
print("-"*80)

# This is what the export code does
target_xml = sample_xml
cell_ref = "B2"
stringValue = "Test Value"

# Escape XML
escapedValue = (stringValue
    .replace('&', '&amp;')
    .replace('<', '&lt;')
    .replace('>', '&gt;')
    .replace('"', '&quot;')
    .replace("'", '&apos;'))

# For non-date cell (use inlineStr format)
cellContent = f'<c r="{cell_ref}"><is><t>{escapedValue}</t></is></c>'

print(f"Looking for: <c r=\"{cell_ref}\"")
print(f"Replacement content: {cellContent[:60]}...")
print()

# Pattern 1: Full cell replacement
cellPattern = re.compile(f'<c r="{cell_ref}"[^>]*>.*?</c>', re.DOTALL)
if cellPattern.search(target_xml):
    print(f"✓ Pattern 1 found and would replace")
    modified = cellPattern.sub(cellContent, target_xml)
    print(f"  Before: {target_xml[:150]}")
    print(f"  After:  {modified[:150]}")
else:
    print(f"✗ Pattern 1 not found")
    
    # Pattern 2: Self-closing cell
    emptyPattern = re.compile(f'<c r="{cell_ref}"[^>]*/>')
    if emptyPattern.search(target_xml):
        print(f"✓ Pattern 2 (self-closing) found and would replace")
        modified = emptyPattern.sub(cellContent, target_xml)
        print(f"  Original: {target_xml}")
        print(f"  Modified: {modified[:200]}")
    else:
        print(f"✗ Pattern 2 not found")
