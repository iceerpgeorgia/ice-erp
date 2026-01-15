"""
Formula to JavaScript compiler for runtime evaluation.
Python version of lib/formula-compiler.ts
"""
import re

def compile_formula(formula):
    """
    Compile Excel-style formula to JavaScript code.
    Returns compiled JavaScript code as string.
    """
    # Remove highlighting markers
    code = formula.replace('«', '').replace('»', '').strip()
    
    # Remove leading = if present
    if code.startswith('='):
        code = code[1:]
    
    # Handle NOT(ISERROR(SEARCH(text, column, start))) - 3 parameters
    code = re.sub(
        r'NOT\s*\(\s*ISERROR\s*\(\s*SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*,\s*\d+\s*\)\s*\)\s*\)',
        lambda m: f'(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes("{m.group(1)}".toLowerCase()))',
        code,
        flags=re.IGNORECASE
    )
    
    code = re.sub(
        r"NOT\s*\(\s*ISERROR\s*\(\s*SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*,\s*\d+\s*\)\s*\)\s*\)",
        lambda m: f"(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes('{m.group(1)}'.toLowerCase()))",
        code,
        flags=re.IGNORECASE
    )
    
    # Handle NOT(ISERROR(SEARCH(text, column))) - 2 parameters
    code = re.sub(
        r'NOT\s*\(\s*ISERROR\s*\(\s*SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)\s*\)\s*\)',
        lambda m: f'(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes("{m.group(1)}".toLowerCase()))',
        code,
        flags=re.IGNORECASE
    )
    
    code = re.sub(
        r"NOT\s*\(\s*ISERROR\s*\(\s*SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*\)\s*\)\s*\)",
        lambda m: f"(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes('{m.group(1)}'.toLowerCase()))",
        code,
        flags=re.IGNORECASE
    )
    
    # Handle ISNUMBER(SEARCH(text, column, start)) - 3 parameters
    code = re.sub(
        r'ISNUMBER\s*\(\s*SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*,\s*\d+\s*\)\s*\)',
        lambda m: f'(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes("{m.group(1)}".toLowerCase()))',
        code,
        flags=re.IGNORECASE
    )
    
    code = re.sub(
        r"ISNUMBER\s*\(\s*SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*,\s*\d+\s*\)\s*\)",
        lambda m: f"(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes('{m.group(1)}'.toLowerCase()))",
        code,
        flags=re.IGNORECASE
    )
    
    # Handle ISNUMBER(SEARCH(text, column)) - 2 parameters
    code = re.sub(
        r'ISNUMBER\s*\(\s*SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)\s*\)',
        lambda m: f'(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes("{m.group(1)}".toLowerCase()))',
        code,
        flags=re.IGNORECASE
    )
    
    code = re.sub(
        r"ISNUMBER\s*\(\s*SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*\)\s*\)",
        lambda m: f"(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes('{m.group(1)}'.toLowerCase()))",
        code,
        flags=re.IGNORECASE
    )
    
    # Handle standalone SEARCH(text, column, start) - 3 parameters
    code = re.sub(
        r'SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*,\s*\d+\s*\)',
        lambda m: f'(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes("{m.group(1)}".toLowerCase()))',
        code,
        flags=re.IGNORECASE
    )
    
    code = re.sub(
        r"SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*,\s*\d+\s*\)",
        lambda m: f"(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes('{m.group(1)}'.toLowerCase()))",
        code,
        flags=re.IGNORECASE
    )
    
    # Handle standalone SEARCH(text, column) - 2 parameters
    code = re.sub(
        r'SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)',
        lambda m: f'(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes("{m.group(1)}".toLowerCase()))',
        code,
        flags=re.IGNORECASE
    )
    
    code = re.sub(
        r"SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*\)",
        lambda m: f"(row.{m.group(2)} && String(row.{m.group(2)}).toLowerCase().includes('{m.group(1)}'.toLowerCase()))",
        code,
        flags=re.IGNORECASE
    )
    
    # Handle column comparisons (e.g., DocProdGroup="COM")
    code = re.sub(
        r'(\w+)\s*=\s*"([^"]+)"',
        lambda m: f'row.{m.group(1)} === "{m.group(2)}"',
        code
    )
    
    code = re.sub(
        r"(\w+)\s*=\s*'([^']+)'",
        lambda m: f"row.{m.group(1)} === '{m.group(2)}'",
        code
    )
    
    # Handle AND/OR logic
    code = re.sub(r'\bAND\b', '&&', code, flags=re.IGNORECASE)
    code = re.sub(r'\bOR\b', '||', code, flags=re.IGNORECASE)
    code = re.sub(r'\bNOT\b', '!', code, flags=re.IGNORECASE)
    
    # Wrap in function
    return f'(function(row) {{ return {code}; }})'

if __name__ == '__main__':
    # Test the compiler
    test_formulas = [
        'isnumber(search("ობიექტი: Bearing.ge; თარიღი:",docinformation,1))',
        'NOT(ISERROR(SEARCH("test",docinformation,1)))',
        'DocProdGroup="COM"'
    ]
    
    for formula in test_formulas:
        print(f"Formula: {formula}")
        print(f"Compiled: {compile_formula(formula)}")
        print()
