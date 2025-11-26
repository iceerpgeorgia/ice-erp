// app/countries-list.tsx
import { prisma } from "@/lib/prisma";

export default async function CountriesList() {
  const countries = await prisma.countries.findMany({
    orderBy: { created_at: "desc" },
    take: 20,
  });

  if (!countries.length) {
    return <p className="text-gray-500">No countries yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {countries.map((c) => (
        <li key={c.id} className="border rounded p-3">
          <div className="font-medium">
            {c.name_ka} ({c.iso3})
          </div>
          <div className="text-sm text-gray-500">{c.name_en}</div>
        </li>
      ))}
    </ul>
  );
}
