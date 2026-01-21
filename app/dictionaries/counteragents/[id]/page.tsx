import { PrismaClient } from "@prisma/client";
import CounteragentForm from "../CounteragentForm";
import { deleteCounteragent } from "../actions";
import DeleteButton from "../DeleteButton";
export const revalidate = 0;

export default async function EditCounteragent({ params }: { params: { id: string }}) {
  const prisma = new PrismaClient();
  const id = Number(params.id);
  const row = await prisma.counteragents.findFirst({ where: { id: BigInt(id) }});
  const countries = await prisma.countries.findMany({ orderBy: { country: "asc" }, select: { country: true }});
  const entityTypes = await prisma.entity_types.findMany({ orderBy: { name_ka: "asc" }, select: { name_ka: true, entity_type_uuid: true }});
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <div className="flex items-center mb-6 gap-3">
        <h1 className="text-2xl font-semibold">Edit Counteragent #{id}</h1>
        <form className="ml-auto">
          <DeleteButton
            className="border rounded px-3 py-2 text-red-700 hover:bg-red-50"
            action={deleteCounteragent.bind(null, String(id))}
            label="Delete"
          />
        </form>
      </div>
      <CounteragentForm
        mode="edit"
        initial={row ? {
          id,
          name: row.name ?? "",
          identification_number: row.identification_number ?? "",
          birth_or_incorporation_date: row.birth_or_incorporation_date ? row.birth_or_incorporation_date.toISOString().slice(0,10) : "",
          entity_type: row.entity_type ?? "",
          entity_type_uuid: row.entity_type_uuid ?? "",
          sex: row.sex ?? "",
          pension_scheme: row.pension_scheme,
          country: row.country ?? "",
          address_line_1: row.address_line_1 ?? "",
          address_line_2: row.address_line_2 ?? "",
          zip_code: row.zip_code ?? "",
          iban: row.iban ?? "",
          swift: row.swift ?? "",
          director: row.director ?? "",
          director_id: row.director_id ?? "",
          email: row.email ?? "",
          phone: row.phone ?? "",
        oris_id: row.oris_id ?? ""
        ,is_emploee: row.is_emploee ?? null
        ,was_emploee: row.was_emploee ?? null
        } : null}
        countries={countries.map(c=>c.country).filter((c): c is string => c !== null)}
        entityTypes={entityTypes}
      />
    </div>
  );
}




