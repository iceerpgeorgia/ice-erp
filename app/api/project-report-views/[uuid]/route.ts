import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: { uuid: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const view = await prisma.projectReportView.findUnique({ where: { uuid: params.uuid } });
  if (!view || view.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { name, config, isDefault } = parsed.data;
  if (isDefault) {
    await prisma.projectReportView.updateMany({ where: { userId: user.id, uuid: { not: params.uuid } }, data: { isDefault: false } });
  }
  const updated = await prisma.projectReportView.update({
    where: { uuid: params.uuid },
    data: {
      ...(name !== undefined && { name }),
      ...(config !== undefined && { config: config as Prisma.InputJsonValue }),
      ...(isDefault !== undefined && { isDefault }),
    },
    select: { uuid: true, name: true, config: true, isDefault: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { uuid: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const view = await prisma.projectReportView.findUnique({ where: { uuid: params.uuid } });
  if (!view || view.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.projectReportView.delete({ where: { uuid: params.uuid } });
  return NextResponse.json({ ok: true });
}