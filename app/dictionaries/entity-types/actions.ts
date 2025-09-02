"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function s(v: FormDataEntryValue | null, len?: number) {
  const t = (v ?? "").toString().trim();
  return len ? t.slice(0, len) : t;
}

export async function updateEntityType(id: string, formData: FormData) {
  const code = s(formData.get("code"));
  const name_en = s(formData.get("name_en"));
  const name_ka = s(formData.get("name_ka"));
  const is_active = formData.get("is_active") ? true : false;

  await prisma.entityType.update({
    where: { id: Number(id) },
    data: { code: code || null, name_en, name_ka, is_active },
  });

  revalidatePath("/dictionaries/entity-types");
  redirect("/dictionaries/entity-types");
}

export async function createEntityType(formData: FormData) {
  const code = s(formData.get("code"));
  const name_en = s(formData.get("name_en"));
  const name_ka = s(formData.get("name_ka"));
  const is_active = formData.get("is_active") ? true : false;

  await prisma.entityType.create({
    data: { code: code || null, name_en, name_ka, is_active },
  });

  revalidatePath("/dictionaries/entity-types");
  redirect("/dictionaries/entity-types");
}

export async function deleteEntityType(id: string) {
  await prisma.entityType.update({ where: { id: Number(id) }, data: { is_active: false } });
  revalidatePath("/dictionaries/entity-types");
  redirect("/dictionaries/entity-types");
}
