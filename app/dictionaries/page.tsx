import Link from "next/link";

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default function DictionariesIndex() {
  return (
    <div className="w-full">
      <div className="mx-auto max-w-[800px] px-6 py-10">
        <h1 className="text-2xl font-semibold mb-6">Dictionaries</h1>
        <ul className="list-disc ml-6 space-y-2">
          <li>
            <Link className="text-blue-600 hover:underline" href="/dictionaries/countries">
              Countries
            </Link>
          </li>
          <li>
            <Link className="text-blue-600 hover:underline" href="/dictionaries/entity-types">
              Entity Types
            </Link>
          </li>
          <li>
            <Link className="text-blue-600 hover:underline" href="/dictionaries/counteragents">
              Counteragents
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
