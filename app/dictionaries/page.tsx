import Link from "next/link";

export const revalidate = 0;

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
          <li>
            <Link className="text-blue-600 hover:underline" href="/dictionaries/currencies">
              Currencies
            </Link>
          </li>
          <li>
            <Link className="text-blue-600 hover:underline" href="/dictionaries/nbg-rates">
              NBG Exchange Rates
            </Link>
          </li>
          <li>
            <Link className="text-blue-600 hover:underline" href="/admin/financial-codes">
              Financial Codes
            </Link>
          </li>
          <li>
            <Link className="text-blue-600 hover:underline" href="/admin/projects">
              Projects
            </Link>
          </li>
          <li>
            <Link className="text-blue-600 hover:underline" href="/dictionaries/jobs">
              Jobs
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
