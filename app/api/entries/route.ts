import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Body = z.object({
  project: z.string().min(1).max(200),
  hours: z.number().int().min(0),
});

export async function POST(request: Request) {
  // TODO: Entry model needs to be added to schema.prisma
  return new Response("Entry model not yet implemented", { status: 501 });
  
  /* const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const json = await request.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new Response(parsed.error.message, { status: 400 });
  }

  // Upsert user into our own table (we use JWT sessions, not PrismaAdapter)
  const user = await prisma.user.upsert({
    where: { email: session.user.email! },
    update: { name: session.user.name || undefined },
    create: { email: session.user.email!, name: session.user.name || undefined },
  });

  await prisma.entry.create({
    data: {
      userId: user.id,
      project: parsed.data.project,
      hours: parsed.data.hours,
    },
  });

  return new Response("ok"); */
}
