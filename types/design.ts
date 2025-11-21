export type ColumnAlign = "left" | "center" | "right";

export type ColumnDesign = {
  label: string;
  field: string; // logical field key used in UI
  dbName?: string; // optional DB column name
  type?: string;
  nullable?: boolean;
  unique?: boolean;
  pk?: boolean;
  default?: string | boolean | number | null;
  visible?: boolean;
  align?: ColumnAlign;
  width?: number;
  hideBelow?: "sm" | "md" | "lg";
  // extra passthrough
  [key: string]: any;
};

export type TableLayoutConfig = {
  density?: "compact" | "normal" | "comfortable";
  maxWidth?: string;
  rowHeight?: number;
  columnVisibility?: Record<string, "sm" | "md" | "lg">;
  [key: string]: any;
};

export type TableThemeTokens = {
  [token: string]: string | number | undefined;
};

export type TableDesign = {
  table: string; // db table name
  model?: string; // prisma model name
  primaryKey?: string[];
  columns: ColumnDesign[];
  indexes?: Array<{ name: string; type: string; columns: string[] }>;
  ui?: {
    rowId?: string;
    defaultSort?: Array<{ column: string; direction: "asc" | "desc" }>;
    visibleColumns?: string[];
    actions?: string[];
    headerBg?: string;
    headerText?: string;
    borderColor?: string;
    rowAltBg?: string;
    fontSize?: string;
    fontFamily?: string;
    radius?: number | string;
    shadow?: string | boolean;
    stickyHeader?: boolean;
    cellPaddingX?: number;
    cellPaddingY?: number;
    rowHeight?: number;
    booleanStyles?: Record<string, any>;
    [key: string]: any;
  };
  layout?: TableLayoutConfig;
  typography?: TableThemeTokens;
  colors?: TableThemeTokens;
  exampleRow?: Record<string, any>;
  // passthrough for unknown fields
  [key: string]: any;
};

