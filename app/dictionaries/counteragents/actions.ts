"use server";

import { prisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteCounteragent(id: string) {
  await prisma.counteragent.delete({ where: { id: BigInt(Number(id)) } });
  revalidatePath("/dictionaries/counteragents");
  redirect("/dictionaries/counteragents");
}

