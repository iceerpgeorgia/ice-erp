import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import type { TableDesign, ColumnDesign } from "@/types/design";
import fs from "fs/promises";
import path from "path";

const BreakpointEnum = z.enum(["sm", "md", "lg"]);

const ColumnSchema = z
  .object({
    label: z.string(),
    field: z.string(),
    dbName: z.string().optional(),
    type: z.string().optional(),
    nullable: z.boolean().optional(),
    unique: z.boolean().optional(),
    pk: z.boolean().optional(),
    default: z.any().optional(),
    visible: z.boolean().optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    width: z.number().optional(),
    hideBelow: BreakpointEnum.optional(),
  })
  .passthrough();

const ThemeTokensSchema = z.record(z.union([z.string(), z.number()])).optional();

const LayoutSchema = z
  .object({
    density: z.enum(["compact", "normal", "comfortable"]).optional(),
    maxWidth: z.string().optional(),
    rowHeight: z.number().optional(),
    columnVisibility: z.record(BreakpointEnum).optional(),
  })
  .passthrough()
  .optional();

const DesignSchema = z
  .object({
    table: z.string(),
    model: z.string().optional(),
    primaryKey: z.array(z.string()).optional(),
    columns: z.array(ColumnSchema),
    indexes: z
      .array(
        z.object({ name: z.string(), type: z.string(), columns: z.array(z.string()) })
      )
      .optional(),
    ui: z
      .object({
        rowId: z.string().optional(),
        defaultSort: z
          .array(z.object({ column: z.string(), direction: z.enum(["asc", "desc"]) }))
          .optional(),
        visibleColumns: z.array(z.string()).optional(),
        actions: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
    exampleRow: z.record(z.any()).optional(),
    layout: LayoutSchema,
    typography: ThemeTokensSchema,
    colors: ThemeTokensSchema,
  })
  .passthrough();

export type DesignSource = "auto" | "supabase" | "local" | "figma";

function tryParseJson(value: unknown): any | null {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectPluginJson(node: any): any | null {
  if (!node) return null;
  const fromDescription = tryParseJson(node.description);
  if (fromDescription) return fromDescription;

  const pluginSources: Record<string, any> = {
    ...(node.pluginData || {}),
  };
  if (node.sharedPluginData && typeof node.sharedPluginData === "object") {
    for (const ns of Object.keys(node.sharedPluginData)) {
      const inner = node.sharedPluginData[ns];
      if (inner && typeof inner === "object") {
        for (const key of Object.keys(inner)) {
          pluginSources[`${ns}:${key}`] = inner[key];
        }
      }
    }
  }
  for (const value of Object.values(pluginSources)) {
    const parsed = tryParseJson(value as any);
    if (parsed) return parsed;
  }
  return null;
}

// Try to interpret various shapes that might come from Figma/Supabase
function normalizeDesign(input: any, slug: string): TableDesign {
  // If it already validates, return as-is
  const parsed = DesignSchema.safeParse(input);
  if (parsed.success) return parsed.data as TableDesign;

  // Heuristics: some tools store { name, fields: [{name,label,type, ...}] }
  const table = input.table || input.name || slug;
  const fields: any[] = input.columns || input.fields || [];
  const columns: ColumnDesign[] = fields.map((f: any) => ({
    label: f.label || f.title || f.name,
    field: f.field || f.key || f.name,
    dbName: f.dbName || f.column || f.name,
    type: f.type || f.kind || undefined,
    nullable: f.nullable ?? f.optional ?? undefined,
    unique: f.unique ?? undefined,
    pk: f.pk ?? f.primaryKey ?? undefined,
    default: f.default ?? undefined,
    visible: f.visible ?? true,
    align:
      f.align === "left" || f.align === "center" || f.align === "right"
        ? f.align
        : undefined,
    width: typeof f.width === "number" ? f.width : undefined,
    hideBelow:
      f.hideBelow === "sm" || f.hideBelow === "md" || f.hideBelow === "lg"
        ? f.hideBelow
        : undefined,
    ...f,
  }));

  const candidate: TableDesign = {
    table,
    model: input.model,
    primaryKey: input.primaryKey || input.pk || ["id"],
    columns,
    ui: input.ui,
    layout: input.layout,
    typography: input.typography,
    colors: input.colors,
    exampleRow: input.exampleRow,
  };
  // Validate after normalization
  const validated = DesignSchema.safeParse(candidate);
  if (validated.success) return validated.data as TableDesign;
  throw new Error("Failed to normalize table design from Supabase/Figma");
}

async function loadFromSupabase(slug: string): Promise<TableDesign | null> {
  try {
    const table = process.env.SUPABASE_DESIGNS_TABLE || "table_designs";
    const slugField = process.env.SUPABASE_DESIGNS_SLUG_FIELD || "slug";
    const configField = process.env.SUPABASE_DESIGNS_CONFIG_FIELD || "config";
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from(table)
      .select(`${slugField}, ${configField}`)
      .eq(slugField, slug)
      .single();
    if (error) return null;
    const record = data as Record<string, any>;
    if (!record || !record[configField]) return null;
    const cfg =
      typeof record[configField] === "string"
        ? JSON.parse(record[configField])
        : record[configField];
    return normalizeDesign(cfg, slug);
  } catch {
    return null;
  }
}

async function loadFromLocal(slug: string): Promise<TableDesign | null> {
  try {
    const file = path.join(process.cwd(), "design", `${slug}.table.json`);
    const raw = await fs.readFile(file, "utf8");
    const json = JSON.parse(raw);
    return normalizeDesign(json, slug);
  } catch {
    return null;
  }
}

async function loadFromFigma(slug: string): Promise<TableDesign | null> {
  const token = process.env.FIGMA_TOKEN;
  const fileKey = process.env.FIGMA_FILE_KEY;
  if (!token || !fileKey) return null;
  try {
    const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
    url.searchParams.set("plugin_data", "shared");
    const res = await fetch(url as any, {
      headers: {
        // Prefer official X-Figma-Token header; keep Authorization for compatibility
        "X-Figma-Token": token,
        Authorization: `Bearer ${token}`,
      },
    } as any);
    if (!res.ok) return null;
    const data: any = await res.json();

    function* walk(node: any): any {
      if (!node) return;
      yield node;
      if (node.children && Array.isArray(node.children)) {
        for (const c of node.children) yield* walk(c);
      }
    }

    const names = [
      `table:${slug}`,
      `table-${slug}`,
      `${slug}.table`,
      `${slug} table`,
    ];

    let candidate: any | null = null;
    for (const n of walk(data?.document)) {
      const name: string = (n?.name ?? "").toLowerCase();
      if (names.some((k) => name === k.toLowerCase())) {
        candidate = n;
        break;
      }
    }
    // If not found, try any node containing a text child with JSON
    if (!candidate) {
      for (const n of walk(data?.document)) {
        if (n?.type === "TEXT") {
          const chars: string = n?.characters ?? "";
          if (chars.trim().startsWith("{") && chars.trim().endsWith("}")) {
            candidate = n;
            break;
          }
        }
      }
    }
    if (!candidate) return null;

    const pluginPayload = collectPluginJson(candidate);
    if (pluginPayload) {
      try {
        return normalizeDesign(pluginPayload, slug);
      } catch {
        // fall through to other heuristics
      }
    }

    const tryParse = (s: string) => tryParseJson(s);
    let rawJson: any | null = null;

    if (candidate.type === "TEXT" && typeof candidate.characters === "string") {
      rawJson = tryParse(candidate.characters);
    }
    if (!rawJson && candidate.children) {
      for (const c of candidate.children) {
        if (c?.type === "TEXT" && typeof c?.characters === "string") {
          rawJson = tryParse(c.characters);
          if (rawJson) break;
        }
        const pluginChild = collectPluginJson(c);
        if (!rawJson && pluginChild) {
          rawJson = pluginChild;
          break;
        }
      }
    }

    if (rawJson) {
      return normalizeDesign(rawJson, slug);
    }

    // Heuristic: build from layers named like "col:<field> label=Name width=120 align=center uppercase"
    const fields: any[] = [];
    for (const c of candidate.children ?? []) {
      const nm: string = String(c?.name ?? "");
      if (nm.startsWith("col:")) {
        const after = nm.slice(4);
        const [fieldPart, ...kv] = after.split(" ");
        const f: any = { field: fieldPart, name: fieldPart };
        for (const pair of kv) {
          const [k, v] = pair.split("=");
          if (!k) continue;
          if (k === "label") f.label = v;
          if (k === "width") f.width = Number(v);
          if (k === "align") f.align = v;
          if (k === "hideBelow") f.hideBelow = v;
          if (k === "uppercase") f.uppercase = v === "true" || v === undefined;
        }
        const pluginCol = collectPluginJson(c);
        if (pluginCol && typeof pluginCol === "object") {
          Object.assign(f, pluginCol);
        }
        fields.push(f);
      }
    }
    if (fields.length) {
      return normalizeDesign({ table: slug, fields }, slug);
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadDesign(
  slug: string,
  source: DesignSource = "auto"
): Promise<TableDesign | null> {
  if (source === "supabase") return loadFromSupabase(slug);
  if (source === "local") return loadFromLocal(slug);
  if (source === "figma") return loadFromFigma(slug) ?? (await loadFromLocal(slug));
  // auto
  return (
    (await loadFromSupabase(slug)) ??
    (await loadFromLocal(slug)) ??
    (await loadFromFigma(slug))
  );
}
