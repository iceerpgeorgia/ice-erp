import { PrismaClient } from "@prisma/client";
import CountriesTable from "./CountriesTable";

export const revalidate = 0;

export default async function CountriesPage() {
  const prisma = new PrismaClient();

  const countries = await prisma.country.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      ts: true,
      country_uuid: true,
      name_en: true,
      name_ka: true,
      iso2: true,
      iso3: true,
      un_code: true,
      country: true, // <- important
      is_active: true,
    },
  });

  // SERVER-SIDE DEBUG (renders in the page AND logs to server console)
  const total = countries.length;
  const withCountry = countries.filter((c) => (c.country ?? "").trim() !== "").length;
  const sample = countries.slice(0, 5).map((c) => ({
    id: Number(c.id),
    iso2: c.iso2,
    name_en: c.name_en,
    country: c.country,
  }));

  // Also log to the server console you run `npm run dev` in
  console.log("[CountriesPage] total rows:", total);
  console.log("[CountriesPage] with country (non-empty):", withCountry);
  console.log("[CountriesPage] sample:", sample);

  // Serialize BigInt & Date for client
  const data = countries.map((c) => ({
    ...c,
    id: Number(c.id),
    createdAt: c.createdAt?.toISOString() ?? null,
    updatedAt: c.updatedAt?.toISOString() ?? null,
    ts: c.ts?.toISOString() ?? null,
  }));

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        <h1 className="text-2xl font-semibold mb-4">Countries</h1>
        <p className="text-sm text-gray-500 mb-6">
          Wide table, header filters, rows-per-page, export, and debug helpers.
        </p>

        {/* Inline server-side debug so you can SEE counts on page */}
        <div className="mb-4 rounded border bg-amber-50 p-3 text-amber-900">
          <div className="font-medium">Server Debug</div>
          <ul className="text-sm list-disc pl-5">
            <li>Total rows from Prisma: <b>{total}</b></li>
            <li>Rows with non-empty <code>country</code>: <b>{withCountry}</b></li>
          </ul>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm underline">Sample rows (first 5)</summary>
            <pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(sample, null, 2)}</pre>
          </details>
        </div>

        <CountriesTable rows={data} />
      </div>
    </div>
  );
}
