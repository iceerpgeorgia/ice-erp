import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

// Helper to serialize BigInt to string for JSON
function serializeFinancialCode(code: any) {
  return {
    ...code,
    id: String(code.id),
    // parentUuid is already a string, no conversion needed
  };
}

// GET /api/financial-codes
// Query params:
//   - root: string (optional) - Get subtree starting from this code
//   - code: string (optional) - Get single code details
//   - type: 'pl' | 'cf' (optional) - Filter by statement type
//   - excludeFormulas: 'true' | 'false' (default 'true') - Exclude formula codes
//   - leafOnly: 'true' | 'false' (default 'false') - Only return leaf nodes (codes without children)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const singleCode = searchParams.get('code');
    const statementType = searchParams.get('type');
    const leafOnly = searchParams.get('leafOnly') === 'true';

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
      where.applies_to_pl = true;
    } else if (statementType === 'cf') {
      where.applies_to_cf = true;
    }

    // Filter by isIncome
    const isIncomeFilter = searchParams.get('isIncome');
    if (isIncomeFilter === 'true') {
      where.is_income = true;
    } else if (isIncomeFilter === 'false') {
      where.is_income = false;
    }

    // Get all codes matching filters, ordered by depth and sort_order
    const codes = await prisma.financial_codes.findMany({
      where,
      orderBy: [
        { depth: 'asc' },
        { sort_order: 'asc' },
      ],
    });

    // If leafOnly is true, filter out codes that have children and sort properly
    let finalCodes = codes;
    if (leafOnly) {
      // First, build the tree structure
      const buildTree = (parentUuid: string | null = null): any[] => {
        return codes
          .filter(c => c.parent_uuid === parentUuid)
          .sort((a, b) => {
            if (a.sort_order !== b.sort_order) {
              return a.sort_order - b.sort_order;
            }
            
            // Custom sort: codes starting with "0" should come after "9"
            const aStartsWith0 = a.code.startsWith('0');
            const bStartsWith0 = b.code.startsWith('0');
            
            if (aStartsWith0 && !bStartsWith0) return 1;
            if (!aStartsWith0 && bStartsWith0) return -1;
            
            // Split codes by dots and compare each part as integer
            const aParts = a.code.split('.').map(p => parseInt(p, 10) || 0);
            const bParts = b.code.split('.').map(p => parseInt(p, 10) || 0);
            
            const maxLen = Math.max(aParts.length, bParts.length);
            for (let i = 0; i < maxLen; i++) {
              const aVal = aParts[i] || 0;
              const bVal = bParts[i] || 0;
              if (aVal !== bVal) return aVal - bVal;
            }
            
            return 0;
          })
          .map(node => ({
            ...node,
            children: buildTree(node.uuid)
          }));
      };

      // Flatten tree in display order (depth-first traversal)
      const flattenInDisplayOrder = (nodes: any[]): any[] => {
        const result: any[] = [];
        for (const node of nodes) {
          result.push(node);
          if (node.children && node.children.length > 0) {
            result.push(...flattenInDisplayOrder(node.children));
          }
        }
        return result;
      };

      const tree = buildTree(null);
      const flattened = flattenInDisplayOrder(tree);
      
      // Filter to only leaf nodes (those without children)
      finalCodes = flattened.filter(code => {
        const hasChildren = codes.some(c => c.parent_uuid === code.uuid);
        return !hasChildren;
      });
    }

    return NextResponse.json(finalCodes.map(serializeFinancialCode));
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
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : true;
  
  // Validate parentUuid format if provided
  let parentUuid: string | null = null;
  if (body?.parentUuid && typeof body.parentUuid === "string") {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(body.parentUuid)) {
      parentUuid = body.parentUuid;
    } else {
      errors.parentUuid = "Invalid parent UUID format";
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
      isActive,
      parentUuid,
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

    // Calculate sortOrder: find max sort_order for siblings and increment
    let sortOrder = 1;
    if (payload.parentUuid) {
      const siblings = await prisma.financial_codes.findMany({
        where: { parent_uuid: payload.parentUuid },
        orderBy: { sort_order: 'desc' },
        take: 1,
      });
      if (siblings.length > 0) {
        sortOrder = (siblings[0].sort_order || 0) + 1;
      }
    } else {
      // Root level - find max sort_order among roots
      const roots = await prisma.financial_codes.findMany({
        where: { parent_uuid: null },
        orderBy: { sort_order: 'desc' },
        take: 1,
      });
      if (roots.length > 0) {
        sortOrder = (roots[0].sort_order || 0) + 1;
      }
    }

    const created = await prisma.financial_codes.create({
      data: {
        code: payload.code,
        name: payload.name,
        ...(payload.description && { description: payload.description }),
        ...(payload.validation && { validation: payload.validation }),
        is_income: payload.isIncome,
        applies_to_pl: payload.appliesToPL,
        applies_to_cf: payload.appliesToCF,
        isActive: payload.isActive,
        ...(payload.parentUuid && { parent_uuid: payload.parentUuid }),
        depth,
        sort_order: sortOrder,
      },
    });

    // Use uuid as recordId for audit logging
    await logAudit({
      table: "financial_codes",
      recordId: created.uuid,
      action: "create",
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
    if (existingAny.isActive !== payload.isActive) changes.isActive = { from: existingAny.isActive, to: payload.isActive };
    if (existingAny.parentUuid !== payload.parentUuid) changes.parentUuid = { from: existingAny.parentUuid, to: payload.parentUuid };

    // Calculate depth if code changed
    let updateData: any = {
      name: payload.name,
      description: payload.description,
      validation: payload.validation,
      is_income: payload.isIncome,
      applies_to_pl: payload.appliesToPL,
      applies_to_cf: payload.appliesToCF,
      isActive: payload.isActive,
      parent_uuid: payload.parentUuid,
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
        action: "update",
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
      data: { isActive: false },
    });

    await logAudit({
      table: "financial_codes",
      recordId: updated.uuid,
      action: "delete",
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

