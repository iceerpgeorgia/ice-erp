import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await prisma.entityType.findMany({
    orderBy: { name_en: "asc" },
    select: { entity_type_uuid: true, code: true, name_en: true, name_ka: true },
  });
  return NextResponse.json(rows);
}