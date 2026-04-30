/**
 * SQL identifier safety helpers.
 *
 * Prisma's `$queryRawUnsafe` does not parameterize identifiers (table/column
 * names). When we need a dynamic identifier (e.g. picking a raw bank statement
 * table at runtime), we must validate and quote it ourselves.
 *
 * Use these helpers anywhere we interpolate identifiers into raw SQL strings.
 */

const IDENT_RX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Quote a single SQL identifier (table or column name).
 *
 * - Throws if the input contains anything other than [A-Za-z0-9_] starting
 *   with a letter or underscore.
 * - Wraps the identifier in double quotes and escapes embedded quotes.
 *
 * Use for column names that come from user input or dynamic config.
 */
export function quoteIdent(name: string): string {
  if (typeof name !== "string" || !IDENT_RX.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${JSON.stringify(name)}`);
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Quote a possibly schema-qualified identifier (`schema.table` or `table`).
 */
export function quoteQualifiedIdent(name: string): string {
  if (typeof name !== "string") {
    throw new Error(`Unsafe SQL identifier: ${JSON.stringify(name)}`);
  }
  const parts = name.split(".");
  if (parts.length === 0 || parts.length > 2) {
    throw new Error(`Unsafe SQL identifier: ${JSON.stringify(name)}`);
  }
  return parts.map(quoteIdent).join(".");
}

/**
 * Validate a candidate identifier against an allow-list of known safe values
 * and return the quoted form. Throws on miss.
 *
 * Prefer this over `quoteIdent` whenever possible — it gives defense in depth
 * by rejecting anything not in the explicit allow-list, even if the identifier
 * happens to look syntactically valid.
 */
export function quoteAllowedIdent(name: string, allowList: readonly string[]): string {
  if (!allowList.includes(name)) {
    throw new Error(`Identifier not in allow-list: ${JSON.stringify(name)}`);
  }
  return quoteIdent(name);
}

/**
 * Build a SQL fragment for `IN (uuid1, uuid2, ...)` from a list of UUID
 * strings. Validates each value and emits properly quoted/cast literals so
 * the result is safe to interpolate into `$queryRawUnsafe`.
 *
 * Returns the literal `'(NULL)'` if the list is empty so the surrounding
 * `IN (...)` clause stays syntactically valid and matches no rows.
 */
const UUID_RX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export function sqlUuidList(values: readonly string[]): string {
  if (!Array.isArray(values) || values.length === 0) {
    return "(NULL)";
  }
  const safe = values.map((v) => {
    if (typeof v !== "string" || !UUID_RX.test(v)) {
      throw new Error(`Unsafe UUID literal: ${JSON.stringify(v)}`);
    }
    return `'${v}'::uuid`;
  });
  return `(${safe.join(", ")})`;
}

/**
 * Quote a string literal for raw SQL. Prefer parameter placeholders (`$1`)
 * whenever possible — this exists for the rare cases where placeholders are
 * not usable (e.g. inside computed expressions used as identifiers).
 */
export function sqlStringLiteral(value: string): string {
  if (typeof value !== "string") {
    throw new Error(`Unsafe SQL literal: ${JSON.stringify(value)}`);
  }
  return `'${value.replace(/'/g, "''")}'`;
}
