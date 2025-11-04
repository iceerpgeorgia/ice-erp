import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/financial-codes
// Query params:
//   - root: string (optional) - Get subtree starting from this code
//   - code: string (optional) - Get single code details
//   - type: 'pl' | 'cf' (optional) - Filter by statement type
//   - excludeFormulas: 'true' | 'false' (default 'true') - Exclude formula codes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rootCode = searchParams.get('root');
    const singleCode = searchParams.get('code');
    const statementType = searchParams.get('type');
    const excludeFormulas = searchParams.get('excludeFormulas') !== 'false';

    // Get single code details
    if (singleCode) {
      const code = await prisma.financialCode.findUnique({
        where: { code: singleCode },
      });

      if (!code) {
        return NextResponse.json(
          { error: 'Financial code not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(code);
    }

    // Build filter conditions
    const where: any = {};
    
    if (excludeFormulas) {
      where.isFormula = false;
    }

    if (statementType === 'pl') {
      where.appliesToPL = true;
    } else if (statementType === 'cf') {
      where.appliesToCF = true;
    }

    // Get subtree or all codes
    let codes;
    
    if (rootCode) {
      // Find the root code
      const root = await prisma.financialCode.findUnique({
        where: { code: rootCode },
      });

      if (!root) {
        return NextResponse.json(
          { error: 'Root code not found' },
          { status: 404 }
        );
      }

      // Get all descendants using closure table
      const descendants = await prisma.financialCodePath.findMany({
        where: {
          ancestorId: root.id,
        },
        include: {
          descendant: true,
        },
      });

      codes = descendants
        .map(d => d.descendant)
        .filter(code => {
          if (excludeFormulas && code.isFormula) return false;
          if (statementType === 'pl' && !code.appliesToPL) return false;
          if (statementType === 'cf' && !code.appliesToCF) return false;
          return true;
        });
    } else {
      // Get all codes matching filters
      codes = await prisma.financialCode.findMany({
        where,
        orderBy: [
          { level1: 'asc' },
          { level2: 'asc' },
          { level3: 'asc' },
          { level4: 'asc' },
        ],
      });
    }

    return NextResponse.json(codes);
  } catch (error: any) {
    console.error('Error fetching financial codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial codes', details: error.message },
      { status: 500 }
    );
  }
}
