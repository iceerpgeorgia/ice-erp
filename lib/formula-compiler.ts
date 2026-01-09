// Formula to JavaScript compiler for runtime evaluation
export function compileFormulaToJS(formula: string): string {
  // Remove highlighting markers
  let code = formula.replace(/«|»/g, '').trim();
  
  // Remove leading = if present
  code = code.replace(/^=/, '');
  
  // Replace Excel functions with JavaScript equivalents
  
  // SEARCH(text, column) -> column.toLowerCase().includes(text.toLowerCase())
  code = code.replace(
    /SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/gi,
    (_, text, col) => `(row.${col} && String(row.${col}).toLowerCase().includes("${text}".toLowerCase()))`
  );
  
  code = code.replace(
    /SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/gi,
    (_, text, col) => `(row.${col} && String(row.${col}).toLowerCase().includes('${text}'.toLowerCase()))`
  );
  
  // EXACT(text, column) -> column === text
  code = code.replace(
    /EXACT\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/gi,
    (_, text, col) => `(row.${col} === "${text}")`
  );
  
  code = code.replace(
    /EXACT\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/gi,
    (_, text, col) => `(row.${col} === '${text}')`
  );
  
  // ISBLANK(column) -> column == null
  code = code.replace(
    /ISBLANK\s*\(\s*(\w+)\s*\)/gi,
    (_, col) => `(row.${col} == null)`
  );
  
  // ISEMPTY(column) -> column == null || column === ''
  code = code.replace(
    /ISEMPTY\s*\(\s*(\w+)\s*\)/gi,
    (_, col) => `(row.${col} == null || row.${col} === '')`
  );
  
  // LEN(column) -> String(column).length
  code = code.replace(
    /LEN\s*\(\s*(\w+)\s*\)/gi,
    (_, col) => `(String(row.${col} || '').length)`
  );
  
  // LEFT(column, n) -> String(column).substring(0, n)
  code = code.replace(
    /LEFT\s*\(\s*(\w+)\s*,\s*(\d+)\s*\)/gi,
    (_, col, n) => `(String(row.${col} || '').substring(0, ${n}))`
  );
  
  // RIGHT(column, n) -> String(column).slice(-n)
  code = code.replace(
    /RIGHT\s*\(\s*(\w+)\s*,\s*(\d+)\s*\)/gi,
    (_, col, n) => `(String(row.${col} || '').slice(-${n}))`
  );
  
  // UPPER(column) -> String(column).toUpperCase()
  code = code.replace(
    /UPPER\s*\(\s*(\w+)\s*\)/gi,
    (_, col) => `(String(row.${col} || '').toUpperCase())`
  );
  
  // LOWER(column) -> String(column).toLowerCase()
  code = code.replace(
    /LOWER\s*\(\s*(\w+)\s*\)/gi,
    (_, col) => `(String(row.${col} || '').toLowerCase())`
  );
  
  // OR(...) -> (... || ...)
  code = code.replace(/\bOR\s*\(/gi, '(');
  code = code.replace(/\)\s*,\s*/g, ') || '); // Handle OR commas
  
  // AND(...) -> (... && ...)
  code = code.replace(/\bAND\s*\(/gi, '(');
  
  // NOT(...) -> !(...)
  code = code.replace(/\bNOT\s*\(/gi, '!(');
  
  // Replace column references with row.column
  // Match column names not already prefixed with row.
  code = code.replace(
    /(?<!row\.)(\b[a-z_][a-z0-9_]*\b)(?!\s*\()/gi,
    (match, col) => {
      // Skip if it's a JavaScript keyword
      const keywords = ['true', 'false', 'null', 'row'];
      if (keywords.includes(col.toLowerCase())) return match;
      return `row.${col}`;
    }
  );
  
  // Handle comparison operators - ensure they work with potential null values
  // Replace standalone column comparisons
  code = code.replace(
    /row\.(\w+)\s*(===|!==|==|!=|>=|<=|>|<)\s*"([^"]+)"/g,
    (_, col, op, val) => `(row.${col} ${op} "${val}")`
  );
  
  code = code.replace(
    /row\.(\w+)\s*(===|!==|==|!=|>=|<=|>|<)\s*'([^']+)'/g,
    (_, col, op, val) => `(row.${col} ${op} '${val}')`
  );
  
  code = code.replace(
    /row\.(\w+)\s*(===|!==|==|!=|>=|<=|>|<)\s*([\d.]+)/g,
    (_, col, op, val) => `(row.${col} ${op} ${val})`
  );
  
  // Replace = with === for proper JavaScript comparison
  code = code.replace(/\s*=\s*(?!=)/g, ' === ');
  
  // Replace <> with !==
  code = code.replace(/\s*<>\s*/g, ' !== ');
  
  // Wrap in function for evaluation
  const functionCode = `(function(row) { return ${code}; })`;
  
  return functionCode;
}

// Test/evaluate the compiled script
export function evaluateCondition(script: string, row: Record<string, any>): boolean {
  try {
    const fn = eval(script);
    return Boolean(fn(row));
  } catch (error) {
    console.error('Error evaluating condition script:', error);
    return false;
  }
}
