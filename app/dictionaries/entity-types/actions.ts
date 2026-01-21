"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

function s(v: FormDataEntryValue | null, len?: number) {
  const t = (v ?? "").toString().trim();
  return len ? t.slice(0, len) : t;
}

export async function updateEntityType(id: string, formData: FormData) {
  const code = s(formData.get("code"));
  const name_en = s(formData.get("name_en"));
  const name_ka = s(formData.get("name_ka"));
  const is_active = formData.get("is_active") ? true : false;

  await prisma.entity_types.update({
    where: { id: BigInt(Number(id)) },
    data: { code, name_en, name_ka, is_active },
  });
  await logAudit({ table: "entity_types", recordId: BigInt(Number(id)), action: "update" });

  revalidatePath("/dictionaries/entity-types");
  redirect("/dictionaries/entity-types");
}

export async function createEntityType(formData: FormData) {
  const code = s(formData.get("code"));
  const name_en = s(formData.get("name_en"));
  const name_ka = s(formData.get("name_ka"));
  const is_active = formData.get("is_active") ? true : false;

  const created = await prisma.entity_types.create({
    data: { 
      entity_type_uuid: randomUUID(),
      code, 
      name_en, 
      name_ka, 
      is_active,
      updated_at: new Date(),
    },
    select: { id: true },
  });
  await logAudit({ table: "entity_types", recordId: BigInt(created.id), action: "create" });

  revalidatePath("/dictionaries/entity-types");
  redirect("/dictionaries/entity-types");
}

export async function deleteEntityType(id: string) {
  await prisma.entity_types.update({ where: { id: BigInt(Number(id)) }, data: { is_active: false } });
  await logAudit({ table: "entity_types", recordId: BigInt(Number(id)), action: "deactivate" });
  revalidatePath("/dictionaries/entity-types");
  redirect("/dictionaries/entity-types");
}
