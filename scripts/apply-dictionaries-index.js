// scripts/apply-dictionaries-index.js
// Usage:
//   node scripts/apply-dictionaries-index.js
// (optionally add an npm script "apply:dictionaries-index": "node scripts/apply-dictionaries-index.js")

const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
  console.log("✓ wrote", path.relative(process.cwd(), p));
}

const dir = path.join("app", "dictionaries");
const pagePath = path.join(dir, "page.tsx");

const pageTsx = `import Link from "next/link";

export const revalidate = 0;

export default function DictionariesIndex() {
  const items = [
    { href: "/dictionaries/countries", title: "Countries", desc: "ISO codes, names, trigger-filled country label" },
    { href: "/dictionaries/entity-types", title: "Entity Types", desc: "Codes, names, active flag" },
  ];

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1200px] px-6 py-10">
        <h1 className="text-2xl font-semibold mb-6">Dictionaries</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="rounded-2xl border p-6 hover:shadow transition"
            >
              <div className="text-lg font-medium">{it.title}</div>
              <div className="text-sm text-gray-500 mt-1">{it.desc}</div>
              <div className="text-sm text-blue-600 mt-3">Open →</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

writeFile(pagePath, pageTsx);
console.log("\n✅ Dictionaries index applied at /dictionaries");
