import { readFileSync } from "fs";
import { parseStringPromise } from "xml2js";

const xmlPath = "Statement_212542508.xml";

function parseBOGDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  const normalized = cleaned.length >= 10 ? cleaned.slice(0, 10) : cleaned;

  if (normalized.length === 10 && normalized.includes(".")) {
    const [day, month, year] = normalized.split(".");
    if (!day || !month || !year) return null;
    const date = new Date(`${year}-${month}-${day}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (normalized.length === 10) {
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (normalized.length === 8) {
    const year = normalized.substring(0, 4);
    const month = normalized.substring(4, 6);
    const day = normalized.substring(6, 8);
    const date = new Date(`${year}-${month}-${day}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

async function main() {
  const xmlContent = readFileSync(xmlPath, "utf-8");
  const parsed = await parseStringPromise(xmlContent, {
    tagNameProcessors: [(name) => name.replace(/^[^:]+:/, "")],
  });

  let root: any = parsed.AccountStatement || parsed.STATEMENT || parsed.ROWDATA || parsed;
  if (root && typeof root === "object" && !root.HEADER && !root.DETAILS && !root.DETAIL) {
    const keys = Object.keys(root);
    if (keys.length === 1) {
      root = root[keys[0]];
    }
  }

  const detailsContainer = root.DETAILS?.[0] || root;
  const details = detailsContainer.DETAIL || [];

  const histogram = new Map<string, number>();
  const samples: Array<{ DocKey: string; EntriesId: string; DocValueDate: any }> = [];
  let invalidCount = 0;

  for (const detail of details) {
    const getText = (tag: string) => detail[tag]?.[0] || null;
    const DocKey = getText("DocKey");
    const EntriesId = getText("EntriesId");
    if (!DocKey || !EntriesId) continue;

    const DocValueDate = getText("DocValueDate");
    const parsedDate = parseBOGDate(DocValueDate);
    if (!parsedDate) {
      invalidCount += 1;
      const key = DocValueDate ?? "(null)";
      histogram.set(key, (histogram.get(key) || 0) + 1);
      if (samples.length < 10) {
        samples.push({ DocKey, EntriesId, DocValueDate });
      }
    }
  }

  const top = Array.from(histogram.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log("invalidDateCount", invalidCount);
  console.log("invalidDateSamples", samples);
  console.log("invalidDateHistogram", top);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
