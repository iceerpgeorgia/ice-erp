/**
 * @jest-environment node
 */
import {
  quoteIdent,
  quoteQualifiedIdent,
  quoteAllowedIdent,
  sqlUuidList,
  sqlStringLiteral,
} from "../sql/safe-identifier";

describe("quoteIdent", () => {
  it("quotes a valid identifier", () => {
    expect(quoteIdent("my_table")).toBe('"my_table"');
    expect(quoteIdent("Col1")).toBe('"Col1"');
  });

  it("rejects identifiers with quotes, semicolons, or spaces", () => {
    expect(() => quoteIdent("foo; DROP TABLE bar")).toThrow();
    expect(() => quoteIdent('foo"bar')).toThrow();
    expect(() => quoteIdent("foo bar")).toThrow();
    expect(() => quoteIdent("1abc")).toThrow();
    expect(() => quoteIdent("")).toThrow();
  });
});

describe("quoteQualifiedIdent", () => {
  it("handles schema-qualified names", () => {
    expect(quoteQualifiedIdent("public.users")).toBe('"public"."users"');
    expect(quoteQualifiedIdent("users")).toBe('"users"');
  });

  it("rejects more than one dot", () => {
    expect(() => quoteQualifiedIdent("a.b.c")).toThrow();
  });
});

describe("quoteAllowedIdent", () => {
  it("returns quoted identifier when in allow-list", () => {
    expect(quoteAllowedIdent("payments", ["payments", "users"])).toBe('"payments"');
  });

  it("rejects identifiers not in allow-list", () => {
    expect(() => quoteAllowedIdent("evil", ["payments"])).toThrow();
  });
});

describe("sqlUuidList", () => {
  it("returns (NULL) for empty arrays", () => {
    expect(sqlUuidList([])).toBe("(NULL)");
  });

  it("emits cast literals for valid UUIDs", () => {
    const result = sqlUuidList(["123e4567-e89b-12d3-a456-426614174000"]);
    expect(result).toBe("('123e4567-e89b-12d3-a456-426614174000'::uuid)");
  });

  it("rejects invalid UUIDs", () => {
    expect(() => sqlUuidList(["not-a-uuid"])).toThrow();
    expect(() => sqlUuidList(["'; DROP TABLE--"])).toThrow();
  });
});

describe("sqlStringLiteral", () => {
  it("escapes single quotes", () => {
    expect(sqlStringLiteral("O'Brien")).toBe("'O''Brien'");
  });

  it("wraps plain strings in single quotes", () => {
    expect(sqlStringLiteral("hello")).toBe("'hello'");
  });
});
