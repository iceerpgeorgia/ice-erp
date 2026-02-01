// Formula to JavaScript compiler for runtime evaluation
export function compileFormulaToJS(formula: string): string {
  // Remove highlighting markers
  let code = formula.replace(/«|»/g, '').trim();
  
  // Remove leading = if present
  code = code.replace(/^=/, '');
  
  // Replace Excel functions with JavaScript equivalents
  
  // Handle the common pattern: NOT(ISERROR(SEARCH(text, column, start))) - returns true if found
  code = code.replace(
    /NOT\s*\(\s*ISERROR\s*\(\s*SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*,\s*\d+\s*\)\s*\)\s*\)/gi,
    (_, text, col) => `(row.${col} && String(row.${col}).toLowerCase().includes("${text}".toLowerCase()))`
  );
  
  code = code.replace(
    /NOT\s*\(\s*ISERROR\s*\(\s*SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*,\s*\d+\s*\)\s*\)\s*\)/gi,
    (_, text, col) => `(row.${col} && String(row.${col}).toLowerCase().includes('${text}'.toLowerCase()))`
  );
  
  // 2-parameter NOT(ISERROR(SEARCH(...)))
  code = code.replace(
    /NOT\s*\(\s*ISERROR\s*\(\s*SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)\s*\)\s*\)/gi,
    (_, text, col) => `(row.${col} && String(row.${col}).toLowerCase().includes("${text}".toLowerCase()))`
  );
  
  code = code.replace(
    /NOT\s*\(\s*ISERROR\s*\(\s*SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*\)\s*\)\s*\)/gi,
    (_, text, col) => `(row.${col} && String(row.${col}).toLowerCase().includes('${text}'.toLowerCase()))`
  );
  
  // Handle ISNUMBER(SEARCH(text, column, start)) - returns true if found (3-parameter)
  code = code.replace(
    /ISNUMBER\s*\(\s*SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*,\s*\d+\s*\)\s*\)/gi,
    (_, text, col) => `(row.${col} && String(row.${col}).toLowerCase().includes("${text}".toLowerCase()))`
  );
  
  code = code.replace(
    /ISNUMBER\s*\(\s*SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*,\s*\d+\s*\)\s*\)/gi,
    (_, text, col) => `(row.${col} && String(row.${col}).toLowerCase().includes('${text}'.toLowerCase()))`
  );
  
  // Handle ISNUMBER(SEARCH(text, column)) - returns true if found (2-parameter)
  code = code.replace(
    /ISNUMBER\s*\(\s*SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)\s*\)/gi,
    (_, text, col) => `(row.${col} && String(row.${col}).toLowerCase().includes("${text}".toLowerCase()))`
  );
  
  code = code.replace(
    /ISNUMBER\s*\(\s*SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*\)\s*\)/gi,
    (_, text, col) => `(row.${col} && String(row.${col}).toLowerCase().includes('${text}'.toLowerCase()))`
  );
  
  // Standalone SEARCH - returns position number or -1
  // 3-parameter version: SEARCH(text, column, start_position)
  code = code.replace(
    /SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*,\s*\d+\s*\)/gi,
    (_, text, col) => `((row.${col} ? String(row.${col}).toLowerCase().indexOf("${text}".toLowerCase()) : -1) + 1)`
  );
  
  code = code.replace(
    /SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*,\s*\d+\s*\)/gi,
    (_, text, col) => `((row.${col} ? String(row.${col}).toLowerCase().indexOf('${text}'.toLowerCase()) : -1) + 1)`
  );
  
  // 2-parameter version: SEARCH(text, column)
  code = code.replace(
    /SEARCH\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/gi,
    (_, text, col) => `((row.${col} ? String(row.${col}).toLowerCase().indexOf("${text}".toLowerCase()) : -1) + 1)`
  );
  
  code = code.replace(
    /SEARCH\s*\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/gi,
    (_, text, col) => `((row.${col} ? String(row.${col}).toLowerCase().indexOf('${text}'.toLowerCase()) : -1) + 1)`
  );
  
  // ISERROR(expression) -> simple error checking (for remaining cases)
  code = code.replace(
    /ISERROR\s*\(/gi,
    '(function(){ try { var result = ('
  );
  
  // ISNUMBER(expression) -> typeof check
  code = code.replace(
    /ISNUMBER\s*\(/gi,
    '(typeof ('
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

  // AND/OR(...) -> (... && ...) / (... || ...)
  code = applyLogicalFunctions(code);
  
  // NOT(...) -> !(...)
  code = code.replace(/\bNOT\s*\(/gi, '!(');
  
  // Replace column references with row.column (avoid string literals)
  const stringLiterals: string[] = [];
  code = code.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, (match) => {
    const token = `@@${stringLiterals.length}@@`;
    stringLiterals.push(match);
    return token;
  });

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

  // Restore string literals
  code = code.replace(/@@(\d+)@@/g, (_, idx) => stringLiterals[Number(idx)] ?? _);
  
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

  code = code.replace(
    /row\.(\w+)\s*(===|==)\s*""/g,
    (_, col) => `(row.${col} == null || row.${col} === "")`
  );

  code = code.replace(
    /row\.(\w+)\s*(===|==)\s*''/g,
    (_, col) => `(row.${col} == null || row.${col} === '')`
  );

  code = code.replace(
    /row\.(\w+)\s*(!==|!=)\s*""/g,
    (_, col) => `(row.${col} != null && row.${col} !== "")`
  );

  code = code.replace(
    /row\.(\w+)\s*(!==|!=)\s*''/g,
    (_, col) => `(row.${col} != null && row.${col} !== '')`
  );
  
  // Wrap in function for evaluation
  const functionCode = `(function(row) { return ${code}; })`;
  
  return functionCode;
}

function applyLogicalFunctions(input: string): string {
  const withAnd = transformLogicalFunction(input, 'AND', '&&');
  return transformLogicalFunction(withAnd, 'OR', '||');
}

function transformLogicalFunction(input: string, name: string, joiner: string): string {
  let i = 0;
  let out = '';
  const upperName = name.toUpperCase();

  while (i < input.length) {
    const ch = input[i];
    const isWord = (c: string) => /[A-Za-z0-9_]/.test(c);

    if (
      i + name.length <= input.length &&
      input.substr(i, name.length).toUpperCase() === upperName &&
      (i === 0 || !isWord(input[i - 1]))
    ) {
      let j = i + name.length;
      while (j < input.length && /\s/.test(input[j])) j++;
      if (j < input.length && input[j] === '(') {
        let depth = 1;
        let k = j + 1;
        let inString: '"' | '\'' | null = null;
        let escape = false;
        while (k < input.length && depth > 0) {
          const c = input[k];
          if (inString) {
            if (escape) {
              escape = false;
            } else if (c === '\\') {
              escape = true;
            } else if (c === inString) {
              inString = null;
            }
          } else {
            if (c === '"' || c === "'") {
              inString = c as '"' | '\'';
            } else if (c === '(') {
              depth++;
            } else if (c === ')') {
              depth--;
            }
          }
          k++;
        }

        if (depth === 0) {
          const inner = input.slice(j + 1, k - 1);
          const transformedInner = applyLogicalFunctions(inner);
          const args = splitTopLevelArgs(transformedInner)
            .map((arg) => arg.trim())
            .filter((arg) => arg.length > 0)
            .filter((arg) => !/^=\s*(""|'')$/.test(arg));

          let replacement = 'true';
          if (args.length === 1) replacement = args[0];
          else if (args.length > 1) replacement = `(${args.join(` ${joiner} `)})`;

          out += replacement;
          i = k;
          continue;
        }
      }
    }

    out += ch;
    i++;
  }

  return out;
}

function splitTopLevelArgs(input: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inString: '"' | '\'' | null = null;
  let escape = false;
  let current = '';

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inString) {
      current += c;
      if (escape) {
        escape = false;
      } else if (c === '\\') {
        escape = true;
      } else if (c === inString) {
        inString = null;
      }
      continue;
    }

    if (c === '"' || c === "'") {
      inString = c as '"' | '\'';
      current += c;
      continue;
    }

    if (c === '(') {
      depth++;
      current += c;
      continue;
    }
    if (c === ')') {
      depth = Math.max(0, depth - 1);
      current += c;
      continue;
    }

    if (c === ',' && depth === 0) {
      args.push(current);
      current = '';
      continue;
    }

    current += c;
  }

  if (current.length > 0 || input.trim().length === 0) args.push(current);
  return args;
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
