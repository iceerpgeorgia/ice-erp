import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  config: z.record(z.unknown()),
  isDefault: z.boolean().optional().default(false),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const views = await prisma.projectReportView.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { uuid: true, name: true, config: true, isDefault: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(views);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { name, config, isDefault } = parsed.data;
  if (isDefault) {
    await prisma.projectReportView.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }
  const view = await prisma.projectReportView.create({
    data: { userId: user.id, name, config: config as Prisma.InputJsonValue, isDefault },
    select: { uuid: true, name: true, config: true, isDefault: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(view, { status: 201 });
}