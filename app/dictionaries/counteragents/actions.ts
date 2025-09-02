"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteCounteragent(id: string) {
  await prisma.counteragent.update({ where: { id: BigInt(Number(id)) }, data: { is_active: false } });
  revalidatePath("/dictionaries/counteragents");
  redirect("/dictionaries/counteragents");
}
