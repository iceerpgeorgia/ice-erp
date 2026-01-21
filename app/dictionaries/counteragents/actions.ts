"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";

export async function deleteCounteragent(id: string) {
  await prisma.counteragents.update({ where: { id: BigInt(Number(id)) }, data: { is_active: false } });
  await logAudit({ table: "counteragents", recordId: BigInt(Number(id)), action: "deactivate" });
  revalidatePath("/dictionaries/counteragents");
  redirect("/dictionaries/counteragents");
}
