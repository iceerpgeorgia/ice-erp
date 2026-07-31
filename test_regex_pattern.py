import re

# The pattern we're using in the code
def test_pattern(cell_ref, xml_snippet):
    # The JavaScript pattern: <c r="${cellRef}"[^>]*>(?:(?!</row>)[\s\S])*?</c>
    # Need to convert to Python: <c r="${cellRef}"[^>]*>(?:(?!</row>)[\s\S])*?</c>
    
    # In Python, we can use negative lookahead: (?!</row>)
    # But the character class [\s\S] matches any whitespace or non-whitespace (i.e., everything)
    # And negative lookahead might not work well in the middle
    
    # Better approach: use DOTALL flag and match up to </c> but stop before </row>
    pattern = rf'<c r="{cell_ref}"[^>]*>.*?</c>'
    
    if re.search(pattern, xml_snippet, re.DOTALL):
        match = re.search(pattern, xml_snippet, re.DOTALL)
        return f'✓ MATCHED: {match.group(0)[:100]}'
    else:
        return f'✗ NOT MATCHED'

# Test with actual template XML
print('Testing regex patterns:\n')

# A-cell example from template
a_cell_xml = '<c r="A1" t="s"><v>11</v></c></row>'
print(f'A1 template: {a_cell_xml}')
print(f'  Pattern result: {test_pattern("A1", a_cell_xml)}')

# B-cell example from template (self-closing)
b_cell_xml = '<c r="B2" s="13"/></row>'
print(f'\nB2 template (self-closing): {b_cell_xml}')
print(f'  Pattern result: {test_pattern("B2", b_cell_xml)}')

# Check if the new JS pattern with negative lookahead would work
print('\n\nTesting negative lookahead pattern:')
print('Pattern: <c r="A1"[^>]*>(?:(?!</row>)[\\s\\S])*?</c>')

# This is tricky - need to test with row boundaries
xml_with_row = '<row r="1"><c r="A1" t="s"><v>11</v></c></row><row r="2"><c r="A2" t="s"><v>12</v></c></row>'
pattern = r'<c r="A1"[^>]*>(?:(?!</row>)[\s\S])*?</c>'

match = re.search(pattern, xml_with_row)
if match:
    print(f'✓ Matched: {match.group(0)}')
else:
    print(f'✗ Not matched')
