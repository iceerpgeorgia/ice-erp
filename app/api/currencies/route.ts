import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function validatePayload(body: any) {
  const errors: Record<string, string> = {};
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;

  if (!code) {
    errors.code = "Currency code is required";
  } else if (!/^[A-Z]{3}$/.test(code)) {
    errors.code = "Must be 3 uppercase letters (e.g., USD, EUR)";
  }
  
  if (!name) {
    errors.name = "Currency name is required";
  }

  return {
    errors,
    payload: {
      code,
      name,
      is_active,
    },
  } as const;
}

export async function GET() {
  try {
    const rows = await prisma.currency.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        uuid: true,
        code: true,
        name: true,
        is_active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`[API] Currencies fetched: ${rows.length}`);

    function formatDate(date: string | Date | undefined): string {
      if (!date) return "";
      const d = new Date(date);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    const camelRows = rows.map(row => ({
      id: typeof row.id === 'bigint' ? Number(row.id) : row.id,
      uuid: row.uuid,
      code: row.code,
      currencyCode: row.code,
      name: row.name,
      is_active: row.is_active,
      createdAt: formatDate(row.created_at),
      updatedAt: formatDate(row.updated_at),
    }));

    return NextResponse.json({ data: camelRows });
  } catch (error: any) {
    console.error("[currencies] GET error", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { errors, payload } = validatePayload(body);
    
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    // Check for duplicate code
    const existing = await prisma.currency.findUnique({
      where: { code: payload.code },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Validation failed", details: { code: "Currency code already exists" } },
        { status: 400 }
      );
    }

    const created = await prisma.currency.create({
      data: {
        code: payload.code,
        name: payload.name,
        is_active: payload.is_active,
      },
      select: {
        id: true,
        uuid: true,
        code: true,
        name: true,
        is_active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const recordId = typeof created.id === "bigint" ? created.id : BigInt(created.id);
    await logAudit({ table: "currencies", recordId, action: "create" });

    function formatDate(date: string | Date | undefined): string {
      if (!date) return "";
      const d = new Date(date);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    return NextResponse.json({
      id: Number(recordId),
      uuid: created.uuid,
      code: created.code,
      name: created.name,
      is_active: created.isActive,
      createdAt: formatDate(created.createdAt),
      updatedAt: formatDate(created.updatedAt),
    }, { status: 201 });
  } catch (error: any) {
    console.error("[currencies] POST error", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    
    if (!idParam) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    
    const body = await req.json().catch(() => ({} as any));
    
    // If only toggling active status
    if (body.active !== undefined && Object.keys(body).length === 1) {
      const active = typeof body.active === "boolean" ? body.active : true;
      await prisma.currency.update({ 
        where: { id: BigInt(Number(idParam)) }, 
        data: { is_active: active } 
      });
      await logAudit({ 
        table: "currencies", 
        recordId: BigInt(Number(idParam)), 
        action: active ? "activate" : "deactivate" 
      });
      return NextResponse.json({ id: Number(idParam) });
    }
    
    // Full update
    const { errors, payload } = validatePayload(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    // Get existing record
    const existing = await prisma.currency.findUnique({
      where: { id: BigInt(Number(idParam)) },
    });

    if (!existing) {
      return NextResponse.json({ error: "Currency not found" }, { status: 404 });
    }

    // Check for code conflicts (if code changed)
    if (payload.code !== existing.code) {
      const duplicate = await prisma.currency.findUnique({
        where: { code: payload.code },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Validation failed", details: { code: "Currency code already exists" } },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.currency.update({
      where: { id: BigInt(Number(idParam)) },
      data: {
        code: payload.code,
        name: payload.name,
        is_active: payload.is_active,
      },
      select: {
        id: true,
        uuid: true,
        code: true,
        name: true,
        is_active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAudit({ 
      table: "currencies", 
      recordId: BigInt(Number(idParam)), 
      action: "update"
    });

    function formatDate(date: string | Date | undefined): string {
      if (!date) return "";
      const d = new Date(date);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    return NextResponse.json({
      id: typeof updated.id === 'bigint' ? Number(updated.id) : updated.id,
      uuid: updated.uuid,
      code: updated.code,
      name: updated.name,
      is_active: updated.isActive,
      createdAt: formatDate(updated.createdAt),
      updatedAt: formatDate(updated.updatedAt),
    });
  } catch (e: any) {
    console.error("[currencies] PATCH error", e);
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    
    if (!idParam) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    
    await prisma.currency.update({ 
      where: { id: BigInt(Number(idParam)) }, 
      data: { is_active: false } 
    });
    
    await logAudit({ 
      table: "currencies", 
      recordId: BigInt(Number(idParam)), 
      action: "deactivate" 
    });
    
    return NextResponse.json({ id: Number(idParam) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Server error" }, { status: 500 });
  }
}


