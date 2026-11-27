import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { parseOrisOrganisations, planOrganisations, type CounteragentRow } from '@/lib/oris-export/organisations';

export const revalidate = 0;
export const maxDuration = 120;

/**
 * Upload the organisations list exported from ORIS (ORGANISATIONS.XLSX) to set counteragents' ORIS IDs.
 * POST multipart: file, dryRun ("true" → only the plan). Counteragents are matched by tax ID.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const dryRun = form.get('dryRun') !== 'false';
    if (!(file instanceof Blob)) return NextResponse.json({ error: 'Choose the ORIS organisations file' }, { status: 400 });

    const book = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    const cells = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]], { header: 1, defval: null, raw: false });
    const { organisations, badCodes } = parseOrisOrganisations(cells);
    if (organisations.length === 0) {
      return NextResponse.json(
        { error: 'No organisations found: column A must hold the ORIS code and column C the name (the ORIS organisations export).' },
        { status: 400 }
      );
    }

    const taxKeys = Array.from(new Set(organisations.flatMap((o) => o.candidates)));
    const codes = Array.from(new Set(organisations.map((o) => o.code)));
    const counteragents = await prisma.$queryRawUnsafe<CounteragentRow[]>(
      `SELECT id, counteragent_uuid::text AS counteragent_uuid, coalesce(counteragent, name, counteragent_uuid::text) AS label,
              nullif(btrim(identification_number), '') AS tax_id, nullif(btrim(oris_id), '') AS oris_id
         FROM counteragents
        WHERE ltrim(upper(btrim(identification_number)), '0') = ANY($1::text[])
           OR btrim(oris_id) = ANY($2::text[])`,
      taxKeys,
      codes
    );
    const plan = planOrganisations(organisations, counteragents);

    let applied = 0;
    if (!dryRun && plan.changes.length > 0) {
      // One statement for all rows (one by one took ~0.7 s each and ran past the time limit), and
      // only while the ORIS ID is still empty: existing ORIS IDs are never changed by this file.
      const saved = await prisma.$queryRawUnsafe<Array<{ id: bigint; oris_id: string }>>(
        `UPDATE counteragents c SET oris_id = v.oris_id
           FROM unnest($1::bigint[], $2::text[]) AS v(id, oris_id)
          WHERE c.id = v.id AND nullif(btrim(c.oris_id), '') IS NULL
         RETURNING c.id, c.oris_id`,
        plan.changes.map((c) => c.counteragentId.toString()),
        plan.changes.map((c) => c.to)
      );
      applied = saved.length;
      if (saved.length > 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "AuditLog" ("table", "record_id", "action", "user_email", "user_id", "changes")
           SELECT 'counteragents', v.id, 'update', $3, $4,
                  jsonb_build_object('oris_id', jsonb_build_object('from', NULL, 'to', v.oris_id), 'source', 'ORIS organisations file')
             FROM unnest($1::bigint[], $2::text[]) AS v(id, oris_id)`,
          saved.map((r) => r.id.toString()),
          saved.map((r) => r.oris_id),
          auth.user.email ?? null,
          auth.user.id ?? null
        );
      }
    }

    return NextResponse.json({
      dryRun,
      organisations: organisations.length,
      badCodeRows: badCodes,
      applied,
      changes: plan.changes.map(({ counteragentId: _id, ...rest }) => rest),
      unchanged: plan.unchanged,
      differs: plan.differs,
      ambiguous: plan.ambiguous,
      conflicts: plan.conflicts,
      noCounteragent: plan.noCounteragent,
      noTaxId: plan.noTaxId,
    });
  } catch (error) {
    console.error('[ORIS-EXPORT] Organisations upload failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}
