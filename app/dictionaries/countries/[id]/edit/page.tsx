// app/dictionaries/countries/[id]/edit/page.tsx
import { getServerSession } from "next-auth/next";
import { authOptions, prisma } from "@/lib/auth";
import { redirect } from "next/navigation";
import { updateCountry, deleteCountry } from "../../actions";
import DeleteButton from "../../DeleteButton";
import Link from "next/link";

export default async function EditCountryPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/api/auth/signin");

  const idNum = Number(params.id);
  const id = BigInt(idNum);
  const c = await prisma.countries.findUnique({ where: { id } });
  if (!c) redirect("/dictionaries/countries");

  return (
    <>
      <h1>Edit country #{c.id.toString()}</h1>
      <form action={updateCountry.bind(null, params.id)} style={{display:"grid", gap:12, maxWidth:420}}>
        <label>
          Name (EN)
          <input name="name_en" defaultValue={c.name_en} required />
        </label>
        <label>
          Name (KA)
          <input name="name_ka" defaultValue={c.name_ka} required />
        </label>
        <label>
          ISO2
          <input name="iso2" defaultValue={c.iso2} required maxLength={2} />
        </label>
        <label>
          ISO3
          <input name="iso3" defaultValue={c.iso3} required maxLength={3} />
        </label>
        <label>
          UN code
          <input name="un_code" type="number" defaultValue={c.un_code ?? undefined} />
        </label>
        <div style={{display:"flex", gap:8, alignItems: "center"}}>
          <button type="submit">Save</button>
          <Link href="/dictionaries/countries">Cancel</Link>
          <DeleteButton
            action={deleteCountry.bind(null, params.id)}
            label="Delete"
            confirmMessage="Delete this country?"
            className="ml-auto"
          />
        </div>
      </form>
      <p style={{marginTop:12, color:"#666"}}>
        <b>Label</b> (read-only, maintained by trigger): {c.country ?? ""}
      </p>
    </>
  );
}



