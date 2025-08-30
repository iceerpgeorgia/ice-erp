// app/dictionaries/countries/new/page.tsx
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createCountry } from "../actions";
import Link from "next/link";

export default async function NewCountryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/api/auth/signin");

  return (
    <>
      <h1>New country</h1>
      <form action={createCountry} style={{display:"grid", gap:12, maxWidth:420}}>
        <label>
          Name (EN)
          <input name="name_en" required />
        </label>
        <label>
          Name (KA)
          <input name="name_ka" required />
        </label>
        <label>
          ISO2
          <input name="iso2" required maxLength={2} />
        </label>
        <label>
          ISO3
          <input name="iso3" required maxLength={3} />
        </label>
        <label>
          UN code
          <input name="un_code" type="number" />
        </label>
        <div style={{display:"flex", gap:8}}>
          <button type="submit">Save</button>
          <Link href="/dictionaries/countries">Cancel</Link>
        </div>
      </form>
    </>
  );
}
