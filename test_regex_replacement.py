import re

# Test the regex replacement logic
test_xml = '''<row r="1" spans="1:5" x14ac:dyDescent="0.25"><c r="A1" t="s"><v>11</v></c></row><row r="2" spans="1:5" x14ac:dyDescent="0.25"><c r="A2" t="s"><v>12</v></c><c r="B2" s="13"/></row>'''

cellRef = "A1"
newContent = f'<c r="{cellRef}"><is><t>Project_Department</t></is></c>'

print("ORIGINAL XML:")
print(test_xml)
print()

# Pattern 1: Replace existing cell
cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>[\\s\\S]*?</c>')
match = cellPattern.search(test_xml)

if match:
    print(f"MATCH FOUND: {match.group()}")
    print(f"Match includes </row>: {'</row>' in match.group()}")
    print()
    
    # Do replacement
    if not '</row>' in match.group():
        result = test_xml.replace(match.group(), newContent)
        print("RESULT AFTER REPLACEMENT:")
        print(result)
else:
    print("NO MATCH FOUND")

print()
print("Testing B1 (doesn't exist in template):")
cellRef = "B1"
cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>[\\s\\S]*?</c>')
match = cellPattern.search(test_xml)
if match:
    print(f"B1 found: {match.group()}")
else:
    print("B1 not found - will try Pattern 3")
    rowNum = 1
    rowPattern = re.compile(f'(<row r="{rowNum}"[^>]*>)')
    row_match = rowPattern.search(test_xml)
    if row_match:
        print(f"Row found: {row_match.group()}")
        newContent = f'<c r="B1"><is><t>some_value</t></is></c>'
        result = test_xml.replace(row_match.group(), f"{row_match.group()}{newContent}")
        print("After Pattern 3 insertion:")
        print(result)
