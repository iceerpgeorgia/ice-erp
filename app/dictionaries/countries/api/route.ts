import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function GET() {
  const rows = await prisma.country.findMany({
    orderBy: { name_en: "asc" },
    select: { country_uuid: true, country: true, name_en: true, iso2: true },
  });
  return NextResponse.json(rows);
}