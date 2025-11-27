import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

// Helper to serialize BigInt to string for JSON
function serializeFinancialCode(code: any) {
  return {
    ...code,
    id: String(code.id),
    // parent_uuid is already a string, no conversion needed
  };
}

// GET /api/financial-codes
// Query params:
//   - root: string (optional) - Get subtree starting from this code
//   - code: string (optional) - Get single code details
//   - type: 'pl' | 'cf' (optional) - Filter by statement type
//   - excludeFormulas: 'true' | 'false' (default 'true') - Exclude formula codes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const singleCode = searchParams.get('code');
    const statementType = searchParams.get('type');

    // Get single code details
    if (singleCode) {
      const code = await prisma.financial_codes.findUnique({
        where: { code: singleCode },
      });

      if (!code) {
        return NextResponse.json(
          { error: 'Financial code not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(serializeFinancialCode(code));
    }

    // Build filter conditions
    const where: any = {};

    if (statementType === 'pl') {
      where.appliesToPL = true;
    } else if (statementType === 'cf') {
      where.appliesToCF = true;
    }

    // Get all codes matching filters, ordered by code and sort_order
    const codes = await prisma.financial_codes.findMany({
      where,
      orderBy: [
        { depth: 'asc' },
        { sort_order: 'asc' },
        { code: 'asc' },
      ],
    });

    return NextResponse.json(codes.map(serializeFinancialCode));
  } catch (error: any) {
    console.error('Error fetching financial codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial codes', details: error.message },
      { status: 500 }
    );
  }
}

function validatePayload(body: any) {
  const errors: Record<string, string> = {};
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const isIncome = typeof body?.isIncome === "boolean" ? body.isIncome : false;
  const appliesToPL = typeof body?.appliesToPL === "boolean" ? body.appliesToPL : false;
  const appliesToCF = typeof body?.appliesToCF === "boolean" ? body.appliesToCF : false;
  const is_active = typeof body?.is_active === "boolean" ? body.is_active : true;
  
  // Validate parent_uuid format if provided
  let parent_uuid: string | null = null;
  if (body?.parent_uuid && typeof body.parent_uuid === "string") {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(body.parent_uuid)) {
      parent_uuid = body.parent_uuid;
    } else {
      errors.parent_uuid = "Invalid parent UUID format";
    }
  }

  if (!code) {
    errors.code = "Code is required";
  } else {
    // Validate that code parts are integers only
    const parts = code.split(".");
    const allIntegers = parts.every((part: string) => /^\d+$/.test(part));
    if (!allIntegers) {
      errors.code = "Code must contain only integers separated by periods (e.g., 1.2.3)";
    }
  }
  
  if (!name) errors.name = "Name is required";

  // Auto-generate validation field: code. + " (+) " or " (-) " + name
  const incomeIndicator = isIncome ? " (+) " : " (-) ";
  const validation = code + "." + incomeIndicator + name;

  return {
    errors,
    payload: {
      code,
      name,
      description: description || null,
      validation,
      isIncome,
      appliesToPL,
      appliesToCF,
      is_active,
      parent_uuid,
    },
  } as const;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[API POST] Received payload:', body);
    
    const { errors, payload } = validatePayload(body);

    if (Object.keys(errors).length > 0) {
      console.log('[API POST] Validation errors:', errors);
      return NextResponse.json({ errors }, { status: 400 });
    }

    console.log('[API POST] Validated payload:', payload);

    // Check for duplicate code
    const existing = await prisma.financial_codes.findUnique({
      where: { code: payload.code },
    });

    if (existing) {
      console.log('[API POST] Duplicate code found:', payload.code);
      return NextResponse.json(
        { errors: { code: "Code already exists" } },
        { status: 409 }
      );
    }

    // Calculate depth from code
    const depth = payload.code.split(".").length;

    // Calculate sort_order: find max sort_order for siblings and increment
    let sort_order = 1;
    if (payload.parent_uuid) {
      const siblings = await prisma.financial_codes.findMany({
        where: { parent_uuid: payload.parent_uuid },
        orderBy: { sort_order: 'desc' },
        take: 1,
      });
      if (siblings.length > 0) {
        sort_order = (siblings[0].sort_order || 0) + 1;
      }
    } else {
      // Root level - find max sort_order among roots
      const roots = await prisma.financial_codes.findMany({
        where: { parent_uuid: null },
        orderBy: { sort_order: 'desc' },
        take: 1,
      });
      if (roots.length > 0) {
        sort_order = (roots[0].sort_order || 0) + 1;
      }
    }

    const created = await prisma.financial_codes.create({
      data: {
        code: payload.code,
        name: payload.name,
        ...(payload.description && { description: payload.description }),
        ...(payload.validation && { validation: payload.validation }),
        isIncome: payload.isIncome,
        appliesToPL: payload.appliesToPL,
        appliesToCF: payload.appliesToCF,
        is_active: payload.is_active,
        ...(payload.parent_uuid && { parent_uuid: payload.parent_uuid }),
        depth,
        sort_order,
      },
    });

    // Use uuid as recordId for audit logging
    await logAudit({
      table: "financial_codes",
      recordId: created.uuid,
      action: "CREATE",
    });

    console.log(`[API POST] Financial code created:`, serializeFinancialCode(created));

    return NextResponse.json(serializeFinancialCode(created));
  } catch (error: any) {
    console.error("[API POST] Error creating financial code:", error);
    return NextResponse.json(
      { errors: { _form: error.message || "Failed to create financial code" } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const idString = body.id;

    if (!idString) {
      return NextResponse.json({ errors: { id: "ID is required" } }, { status: 400 });
    }

    const id = BigInt(idString);

    if (!id) {
      return NextResponse.json({ errors: { id: "ID is required" } }, { status: 400 });
    }

    const { errors, payload } = validatePayload(body);

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Fetch existing record
    const existing = await prisma.financial_codes.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ errors: { id: "Financial code not found" } }, { status: 404 });
    }

    // Check for code conflicts (if code changed)
    if (payload.code !== existing.code) {
      const duplicate = await prisma.financial_codes.findUnique({
        where: { code: payload.code },
      });
      if (duplicate) {
        return NextResponse.json(
          { errors: { code: "Code already exists" } },
          { status: 409 }
        );
      }
    }

    // Track changes (using type assertion to access new fields)
    const existingAny = existing as any;
    const changes: Record<string, { from: any; to: any }> = {};
    
    if (existing.code !== payload.code) changes.code = { from: existing.code, to: payload.code };
    if (existing.name !== payload.name) changes.name = { from: existing.name, to: payload.name };
    if (existingAny.description !== payload.description) changes.description = { from: existingAny.description, to: payload.description };
    if (existingAny.validation !== payload.validation) changes.validation = { from: existingAny.validation, to: payload.validation };
    if (existingAny.isIncome !== payload.isIncome) changes.isIncome = { from: existingAny.isIncome, to: payload.isIncome };
    if (existingAny.appliesToPL !== payload.appliesToPL) changes.appliesToPL = { from: existingAny.appliesToPL, to: payload.appliesToPL };
    if (existingAny.appliesToCF !== payload.appliesToCF) changes.appliesToCF = { from: existingAny.appliesToCF, to: payload.appliesToCF };
    if (existingAny.is_active !== payload.is_active) changes.is_active = { from: existingAny.is_active, to: payload.is_active };
    if (existingAny.parent_uuid !== payload.parent_uuid) changes.parent_uuid = { from: existingAny.parent_uuid, to: payload.parent_uuid };

    // Calculate depth if code changed
    let updateData: any = {
      name: payload.name,
      description: payload.description,
      validation: payload.validation,
      isIncome: payload.isIncome,
      appliesToPL: payload.appliesToPL,
      appliesToCF: payload.appliesToCF,
      is_active: payload.is_active,
      parent_uuid: payload.parent_uuid,
    };

    if (payload.code !== existing.code) {
      updateData.code = payload.code;
      updateData.depth = payload.code.split(".").length;
    }

    const updated = await prisma.financial_codes.update({
      where: { id },
      data: updateData,
    });

    // Log audit only if there are changes
    if (Object.keys(changes).length > 0) {
      await logAudit({
        table: "financial_codes",
        recordId: updated.uuid,
        action: "UPDATE",
        changes,
      });
      console.log(`[API] Financial code updated with changes:`, changes);
    }

    return NextResponse.json(serializeFinancialCode(updated));
  } catch (error: any) {
    console.error("[API] Error updating financial code:", error);
    return NextResponse.json(
      { errors: { _form: error.message || "Failed to update financial code" } },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idString = searchParams.get("id");

    if (!idString) {
      return NextResponse.json({ errors: { id: "ID is required" } }, { status: 400 });
    }

    const id = BigInt(idString);

    const existing = await prisma.financial_codes.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ errors: { id: "Financial code not found" } }, { status: 404 });
    }

    // Soft delete by setting is_active to false
    const updated = await prisma.financial_codes.update({
      where: { id },
      data: { is_active: false },
    });

    await logAudit({
      table: "financial_codes",
      recordId: updated.uuid,
      action: "DELETE",
    });

    console.log(`[API] Financial code deleted: ${updated.code}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Error deleting financial code:", error);
    return NextResponse.json(
      { errors: { _form: error.message || "Failed to delete financial code" } },
      { status: 500 }
    );
  }
}
