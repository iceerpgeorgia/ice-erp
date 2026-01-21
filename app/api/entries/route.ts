import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Body = z.object({
  project: z.string().min(1).max(200),
  hours: z.number().int().min(0),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
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
    create: { 
      id: crypto.randomUUID(),
      email: session.user.email!, 
      name: session.user.name || undefined 
    },
  });

  await prisma.entry.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      project: parsed.data.project,
      hours: parsed.data.hours,
      updatedAt: new Date(),
    },
  });

  return new Response("ok");
}
