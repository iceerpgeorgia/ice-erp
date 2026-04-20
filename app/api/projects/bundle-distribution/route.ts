import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const projectUuid = req.nextUrl.searchParams.get('projectUuid');

  if (!projectUuid) {
    return NextResponse.json({ error: 'projectUuid is required' }, { status: 400 });
  }

  // Get the project's bundle FC and value
  const projects = await prisma.$queryRawUnsafe<Array<{
    financial_code_uuid: string;
    value: number;
  }>>(
    `SELECT financial_code_uuid::text, value::numeric FROM projects WHERE project_uuid = $1::uuid LIMIT 1`,
    projectUuid
  );

  if (projects.length === 0) {
    return NextResponse.json([]);
  }

  const project = projects[0];

  // Get child FCs with their existing payment info
  const rows = await prisma.$queryRawUnsafe<Array<{
    financial_code_uuid: string;
    financial_code_name: string;
    financial_code_code: string;
    payment_id: string | null;
  }>>(
    `SELECT
       fc.uuid::text AS financial_code_uuid,
       fc.name AS financial_code_name,
       fc.code AS financial_code_code,
       p.payment_id
     FROM financial_codes fc
     LEFT JOIN payments p
       ON p.project_uuid = $1::uuid
       AND p.financial_code_uuid = fc.uuid
       AND p.is_bundle_payment = true
     WHERE fc.parent_uuid = $2::uuid AND fc.is_active = true
     ORDER BY fc.sort_order, fc.code`,
    projectUuid,
    project.financial_code_uuid
  );

  const distribution = rows.map(row => ({
    financialCodeUuid: row.financial_code_uuid,
    financialCodeName: `${row.financial_code_code} - ${row.financial_code_name}`,
    percentage: '',
    amount: '',
    paymentId: row.payment_id || null,
  }));

  return NextResponse.json(distribution);
}
