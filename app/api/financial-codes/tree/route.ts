import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface TreeNode {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  sign: string;
  nodeType: string;
  depth: number;
  appliesToPL: boolean;
  appliesToCF: boolean;
  isFormula: boolean;
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  children: TreeNode[];
}

function buildTree(codes: any[]): TreeNode[] {
  // Create a map for quick lookup
  const codeMap = new Map<string, TreeNode>();
  
  // Initialize all nodes
  codes.forEach(code => {
    codeMap.set(code.id, {
      id: code.id,
      code: code.code,
      name: code.name,
      nameEn: code.nameEn,
      sign: code.sign,
      nodeType: code.nodeType,
      depth: code.depth,
      appliesToPL: code.appliesToPL,
      appliesToCF: code.appliesToCF,
      isFormula: code.isFormula,
      level1: code.level1,
      level2: code.level2,
      level3: code.level3,
      level4: code.level4,
      children: [],
    });
  });

  // Build parent-child relationships
  const rootNodes: TreeNode[] = [];
  
  codes.forEach(code => {
    const node = codeMap.get(code.id)!;
    
    // Find parent based on hierarchy levels
    let parentNode: TreeNode | undefined;
    
    if (code.depth === 1) {
      // Root level node
      rootNodes.push(node);
    } else if (code.depth === 2) {
      // Find level 1 parent
      const parent = codes.find(c => 
        c.level1 === code.level1 && 
        c.level2 === 0 && 
        c.depth === 1
      );
      parentNode = parent ? codeMap.get(parent.id) : undefined;
    } else if (code.depth === 3) {
      // Find level 2 parent
      const parent = codes.find(c =>
        c.level1 === code.level1 &&
        c.level2 === code.level2 &&
        c.level3 === 0 &&
        c.depth === 2
      );
      parentNode = parent ? codeMap.get(parent.id) : undefined;
    } else if (code.depth === 4) {
      // Find level 3 parent
      const parent = codes.find(c =>
        c.level1 === code.level1 &&
        c.level2 === code.level2 &&
        c.level3 === code.level3 &&
        c.level4 === 0 &&
        c.depth === 3
      );
      parentNode = parent ? codeMap.get(parent.id) : undefined;
    }

    if (parentNode) {
      parentNode.children.push(node);
    } else if (code.depth > 1) {
      // Orphaned node - add to root
      rootNodes.push(node);
    }
  });

  return rootNodes;
}

// GET /api/financial-codes/tree
// Query params:
//   - type: 'pl' | 'cf' (optional) - Filter by statement type
//   - excludeFormulas: 'true' | 'false' (default 'true')
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statementType = searchParams.get('type');
    const excludeFormulas = searchParams.get('excludeFormulas') !== 'false';

    // Build filter
    const where: any = {};
    
    if (excludeFormulas) {
      where.isFormula = false;
    }

    if (statementType === 'pl') {
      where.appliesToPL = true;
    } else if (statementType === 'cf') {
      where.appliesToCF = true;
    }

    // Get all codes
    const codes = await prisma.financialCode.findMany({
      where,
      orderBy: {
        code: 'asc',
      },
    });

    // Build tree structure
    const tree = buildTree(codes);

    return NextResponse.json({
      total: codes.length,
      tree,
    });
  } catch (error: any) {
    console.error('Error building financial codes tree:', error);
    return NextResponse.json(
      { error: 'Failed to build tree', details: error.message },
      { status: 500 }
    );
  }
}
