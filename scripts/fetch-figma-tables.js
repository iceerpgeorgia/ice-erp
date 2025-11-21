/*
 Fetch table designs from Figma and write design/<slug>.table.json

 Usage (set env first):
   FIGMA_TOKEN=xxxxx FIGMA_FILE_KEY=yyyyy FIGMA_TABLE_SLUGS=countries,counteragents node scripts/fetch-figma-tables.js

 Optional env:
   FIGMA_FRAME_PREFIX=table:   // searches for frames named `${prefix}${slug}`
*/

const fs = require('fs');
const path = require('path');

function loadDotEnvLocal() {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

function tryParseJson(value) {
  if (typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch { return null; }
}

function collectPluginJson(node) {
  if (!node) return null;
  const fromDescription = tryParseJson(node.description);
  if (fromDescription) return fromDescription;

  const sources = { ...(node.pluginData || {}) };
  if (node.sharedPluginData && typeof node.sharedPluginData === 'object') {
    for (const ns of Object.keys(node.sharedPluginData)) {
      const inner = node.sharedPluginData[ns];
      if (!inner || typeof inner !== 'object') continue;
      for (const key of Object.keys(inner)) {
        sources[`${ns}:${key}`] = inner[key];
      }
    }
  }
  for (const value of Object.values(sources)) {
    const parsed = tryParseJson(value);
    if (parsed) return parsed;
  }
  return null;
}

async function main() {
  loadDotEnvLocal();
  const token = process.env.FIGMA_TOKEN;
  const fileKey = process.env.FIGMA_FILE_KEY;
  const slugs = (process.env.FIGMA_TABLE_SLUGS || '').split(',').map(s => s.trim()).filter(Boolean);
  const prefix = process.env.FIGMA_FRAME_PREFIX || 'table:';
  if (!token || !fileKey || slugs.length === 0) {
    console.error('Missing FIGMA_TOKEN, FIGMA_FILE_KEY or FIGMA_TABLE_SLUGS');
    process.exit(1);
  }

  const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
  url.searchParams.set('plugin_data', 'shared');
  const res = await fetch(url, {
    headers: { 'X-Figma-Token': token, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error('Figma API error:', res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();

  function* walk(node) {
    if (!node) return;
    yield node;
    if (node.children && Array.isArray(node.children)) {
      for (const c of node.children) yield* walk(c);
    }
  }

  const outDir = path.join(process.cwd(), 'design');
  fs.mkdirSync(outDir, { recursive: true });

  for (const slug of slugs) {
    const names = [ `${prefix}${slug}`, `${slug}.table`, `${slug} table`, `table-${slug}` ];
    let candidate = null;
    for (const n of walk(data.document)) {
      const nm = String(n?.name || '').toLowerCase();
      if (names.some(k => nm === k.toLowerCase())) { candidate = n; break; }
    }

    // Try plugin / description JSON first
    let raw = collectPluginJson(candidate);

    const tryParse = (s) => tryParseJson(s);

    if (!raw && candidate) {
      // Try JSON text nodes under the frame
      const searchTexts = (node) => {
        if (!node) return null;
        if (node.type === 'TEXT' && typeof node.characters === 'string') {
          const s = node.characters.trim();
          if (s.startsWith('{') && s.endsWith('}')) {
            const j = tryParse(s);
            if (j) return j;
          }
        }
        const pluginPayload = collectPluginJson(node);
        if (pluginPayload) return pluginPayload;
        for (const c of node.children || []) {
          const got = searchTexts(c);
          if (got) return got;
        }
        return null;
      };
      raw = searchTexts(candidate);
    }

    if (!raw) {
      // Try fallback heuristic using layer names
      if (!candidate) {
        console.warn(`[figma] No frame or JSON found for slug: ${slug}`);
        continue;
      }
      const fields = [];
      for (const c of candidate.children || []) {
        const nm = String(c?.name || '');
        if (nm.startsWith('col:')) {
          const after = nm.slice(4);
          const [field, ...kv] = after.split(' ');
          const f = { name: field, field, dbName: field };
          for (const pair of kv) {
            const [k, v] = pair.split('=');
            if (!k) continue;
            if (k === 'label') f.label = v;
            if (k === 'width') f.width = Number(v);
            if (k === 'align') f.align = v;
            if (k === 'hideBelow') f.hideBelow = v;
            if (k === 'uppercase') f.uppercase = v === 'true' || v === undefined;
          }
          const pluginCol = collectPluginJson(c);
          if (pluginCol && typeof pluginCol === 'object') Object.assign(f, pluginCol);
          fields.push(f);
        }
      }
      raw = { table: slug, fields };
    }

    const normalized = normalize(raw, slug);
    const outPath = path.join(outDir, `${slug}.table.json`);
    fs.writeFileSync(outPath, JSON.stringify(normalized, null, 2));
    console.log('[figma] wrote', outPath);
  }
}

function normalize(input, slug) {
  if (input && input.table && Array.isArray(input.columns)) return input;
  const table = input.table || input.name || slug;
  const fields = input.columns || input.fields || [];
  const columns = fields.map(f => ({
    label: f.label || f.title || f.name,
    field: f.field || f.key || f.name,
    dbName: f.dbName || f.column || f.name,
    type: f.type || f.kind || undefined,
    nullable: f.nullable ?? f.optional ?? undefined,
    unique: f.unique ?? undefined,
    pk: f.pk ?? f.primaryKey ?? undefined,
    default: f.default ?? undefined,
    visible: f.visible ?? true,
    align: ['left','center','right'].includes(f.align) ? f.align : undefined,
    width: typeof f.width === 'number' ? f.width : undefined,
    hideBelow: ['sm','md','lg'].includes(f.hideBelow) ? f.hideBelow : undefined,
    uppercase: !!f.uppercase,
  }));
  return {
    table,
    model: input.model,
    primaryKey: input.primaryKey || input.pk || ['id'],
    columns,
    ui: input.ui,
    layout: input.layout,
    typography: input.typography,
    colors: input.colors,
    exampleRow: input.exampleRow,
  };
}

main().catch(err => { console.error(err); process.exit(1); });
