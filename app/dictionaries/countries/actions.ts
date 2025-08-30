"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// tiny helper to coerce/clean inputs
function s(v: FormDataEntryValue | null, len?: number) {
  const t = (v ?? "").toString().trim();
  return len ? t.slice(0, len) : t;
}

export async function createCountry(formData: FormData) {
  const name_en = s(formData.get("name_en"));
  const name_ka = s(formData.get("name_ka"));
  const iso2 = s(formData.get("iso2"), 2).toUpperCase();
  const iso3 = s(formData.get("iso3"), 3).toUpperCase();
  const un_code_raw = s(formData.get("un_code"));
  const un_code = un_code_raw ? Number(un_code_raw) : null;

  await prisma.country.create({
    data: { name_en, name_ka, iso2, iso3, un_code: un_code ?? undefined },
  });

  revalidatePath("/dictionaries/countries");
  redirect("/dictionaries/countries");
}

export async function updateCountry(id: string, formData: FormData) {
  const name_en = s(formData.get("name_en"));
  const name_ka = s(formData.get("name_ka"));
  const iso2 = s(formData.get("iso2"), 2).toUpperCase();
  const iso3 = s(formData.get("iso3"), 3).toUpperCase();
  const un_code_raw = s(formData.get("un_code"));
  const un_code = un_code_raw ? Number(un_code_raw) : null;

  await prisma.country.update({
    where: { id: Number(id) }, // id is BIGINT in DB
    data: { name_en, name_ka, iso2, iso3, un_code: un_code ?? undefined },
  });

  revalidatePath("/dictionaries/countries");
  redirect("/dictionaries/countries");
}
