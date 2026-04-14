import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { reparseByPaymentId } from '@/lib/bank-import/reparse';

// PUT update project
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await req.json();
    const {
      projectName,
      date,
      value,
      oris1630,
      counteragentUuid,
      financialCodeUuid,
      currencyUuid,
      stateUuid,
      employees // Array of employee UUIDs
    } = body;

    // Validation
    if (projectName && !/^[a-zA-Z0-9\s]+$/.test(projectName)) {
      return NextResponse.json(
        { error: 'Project name must contain only English letters and numbers' },
        { status: 400 }
      );
    }

    if (value && parseFloat(value) <= 0) {
      return NextResponse.json(
        { error: 'Value must be greater than 0' },
        { status: 400 }
      );
    }

    // Update project
    await prisma.$queryRaw`
      UPDATE projects
      SET
        project_name = ${projectName},
        date = ${new Date(date)}::date,
        value = ${parseFloat(value)}::decimal,
        oris_1630 = ${oris1630 || null},
        counteragent_uuid = ${counteragentUuid}::uuid,
        financial_code_uuid = ${financialCodeUuid}::uuid,
        currency_uuid = ${currencyUuid}::uuid,
        state_uuid = ${stateUuid}::uuid,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    // Update employees: delete all and re-insert
    if (employees && Array.isArray(employees)) {
      // Delete existing
      await prisma.$queryRaw`
        DELETE FROM project_employees WHERE project_id = ${id}
      `;

      // Insert new
      for (const employeeUuid of employees) {
        const employeeData: any = await prisma.$queryRaw`
          SELECT name FROM counteragents WHERE counteragent_uuid = ${employeeUuid}::uuid
        `;
        const employeeName = employeeData[0]?.name || null;

        await prisma.$queryRaw`
          INSERT INTO project_employees (project_id, employee_uuid, employee_name)
          VALUES (${id}, ${employeeUuid}::uuid, ${employeeName})
        `;
      }
    }

    // Get updated project
    const updated: any = await prisma.$queryRaw`
      SELECT * FROM projects WHERE id = ${id}
    `;

    await logAudit({
      table: 'projects',
      recordId: id,
      action: 'update',
    });

    // Sync project-derived payment with updated project fields
    const proj = updated[0];
    try {
      // Check if the financial code has automated_payment_id enabled
      const fcRows = await prisma.$queryRawUnsafe<Array<{ automated_payment_id: boolean; is_bundle: boolean }>>(
        `SELECT automated_payment_id, is_bundle FROM financial_codes WHERE uuid = $1::uuid LIMIT 1`,
        proj.financial_code_uuid
      );
      const autoPaymentEnabled = fcRows.length > 0 && fcRows[0].automated_payment_id === true;
      const isBundleFC = fcRows.length > 0 && fcRows[0].is_bundle === true;

      const derivedPayments = await prisma.$queryRawUnsafe<Array<{ id: bigint; payment_id: string; counteragent_uuid: string; financial_code_uuid: string; currency_uuid: string }>>(
        `SELECT id, payment_id, counteragent_uuid, financial_code_uuid, currency_uuid
         FROM payments
         WHERE project_uuid = $1::uuid AND is_project_derived = true AND financial_code_uuid = $2::uuid
         LIMIT 1`,
        proj.project_uuid,
        proj.financial_code_uuid
      );

      if (derivedPayments.length > 0 && autoPaymentEnabled) {
        const dp = derivedPayments[0];
        const changed =
          dp.counteragent_uuid !== proj.counteragent_uuid ||
          dp.financial_code_uuid !== proj.financial_code_uuid ||
          dp.currency_uuid !== proj.currency_uuid;

        if (changed) {
          await prisma.$queryRawUnsafe(
            `UPDATE payments
             SET counteragent_uuid = $1::uuid,
                 financial_code_uuid = $2::uuid,
                 currency_uuid = $3::uuid,
                 updated_at = NOW()
             WHERE id = $4`,
            proj.counteragent_uuid,
            proj.financial_code_uuid,
            proj.currency_uuid,
            dp.id
          );

          if (dp.payment_id) {
            await reparseByPaymentId(dp.payment_id);
          }
        }
      } else if (derivedPayments.length > 0 && !autoPaymentEnabled) {
        // Financial code no longer has auto-payment flag — deactivate derived payment
        await prisma.$queryRawUnsafe(
          `UPDATE payments SET is_active = false, updated_at = NOW() WHERE id = $1`,
          derivedPayments[0].id
        );
      } else if (derivedPayments.length === 0 && autoPaymentEnabled) {
        // No derived payment yet but FC now has auto-payment — create one
        await prisma.$queryRawUnsafe(
          `INSERT INTO payments (
            project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax,
            currency_uuid, payment_id, record_uuid, is_project_derived, updated_at
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', true, NOW())`,
          proj.project_uuid,
          proj.counteragent_uuid,
          proj.financial_code_uuid,
          proj.currency_uuid
        );
      }

      // Bundle payments
      if (isBundleFC) {
        const childFCs = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
          `SELECT uuid FROM financial_codes WHERE parent_uuid = $1::uuid AND is_active = true`,
          proj.financial_code_uuid
        );
        for (const childFC of childFCs) {
          const existingBundle = await prisma.$queryRawUnsafe<Array<{ id: bigint; counteragent_uuid: string; currency_uuid: string }>>(
            `SELECT id, counteragent_uuid, currency_uuid FROM payments WHERE project_uuid = $1::uuid AND is_project_derived = true AND financial_code_uuid = $2::uuid LIMIT 1`,
            proj.project_uuid, childFC.uuid
          );
          if (existingBundle.length > 0) {
            const bp = existingBundle[0];
            if (bp.counteragent_uuid !== proj.counteragent_uuid || bp.currency_uuid !== proj.currency_uuid) {
              await prisma.$queryRawUnsafe(`UPDATE payments SET counteragent_uuid = $1::uuid, currency_uuid = $2::uuid, updated_at = NOW() WHERE id = $3`, proj.counteragent_uuid, proj.currency_uuid, bp.id);
            }
          } else {
            try {
              await prisma.$queryRawUnsafe(`INSERT INTO payments (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid, payment_id, record_uuid, is_project_derived, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', true, NOW())`, proj.project_uuid, proj.counteragent_uuid, childFC.uuid, proj.currency_uuid);
            } catch (bundleErr: any) { console.warn('Bundle sync skipped (PUT):', bundleErr?.message); }
          }
        }
      } else {
        await prisma.$queryRawUnsafe(`UPDATE payments SET is_active = false, updated_at = NOW() WHERE project_uuid = $1::uuid AND is_project_derived = true AND financial_code_uuid != $2::uuid`, proj.project_uuid, proj.financial_code_uuid);
      }
    } catch (syncError: any) {
      console.warn('Project-derived payment sync error (PUT):', syncError?.message);
    }

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error(`PUT /projects/${params.id} error:`, error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE project
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    // Get project_uuid before deletion
    const projectRows = await prisma.$queryRawUnsafe<Array<{ project_uuid: string }>>(
      `SELECT project_uuid FROM projects WHERE id = $1 LIMIT 1`,
      id
    );

    if (!projectRows.length) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectUuid = projectRows[0].project_uuid;

    // Check if any payment linked to this project has ledger entries, adjustments, or bank transactions
    const attachedChecks = await prisma.$queryRawUnsafe<Array<{ block_reason: string }>>(
      `SELECT block_reason FROM (
        SELECT 'Payment has ledger entries' AS block_reason
        FROM payments p
        JOIN payments_ledger pl ON pl.payment_id = p.payment_id
        WHERE p.project_uuid = $1::uuid
          AND p.is_active = true
          AND (pl.is_deleted = false OR pl.is_deleted IS NULL)
          AND (COALESCE(pl.accrual, 0) <> 0 OR COALESCE(pl."order", 0) <> 0)
        LIMIT 1
      ) t1

      UNION ALL

      SELECT block_reason FROM (
        SELECT 'Payment has adjustments' AS block_reason
        FROM payments p
        JOIN payment_adjustments pa ON pa.payment_id = p.payment_id
        WHERE p.project_uuid = $1::uuid
          AND p.is_active = true
          AND (pa.is_deleted = false OR pa.is_deleted IS NULL)
        LIMIT 1
      ) t2

      UNION ALL

      SELECT block_reason FROM (
        SELECT 'Payment has bank transactions' AS block_reason
        FROM payments p
        WHERE p.project_uuid = $1::uuid
          AND p.is_active = true
          AND (
            EXISTS (
              SELECT 1 FROM "GE78BG0000000893486000_BOG_GEL" r
              WHERE r.payment_id = p.payment_id
            )
            OR EXISTS (
              SELECT 1 FROM "GE65TB7856036050100002_TBC_GEL" r
              WHERE r.payment_id = p.payment_id
            )
            OR EXISTS (
              SELECT 1 FROM bank_transaction_batches btb
              WHERE btb.payment_id = p.payment_id
            )
          )
        LIMIT 1
      ) t3`,
      projectUuid
    );

    if (attachedChecks.length > 0) {
      const reasons = attachedChecks.map((r) => r.block_reason);
      return NextResponse.json(
        {
          error: 'Cannot delete project: it has attached transactions that must be removed first.',
          reasons,
        },
        { status: 409 }
      );
    }

    await prisma.$queryRaw`
      DELETE FROM projects WHERE id = ${id}
    `;

    // Deactivate project-derived payment
    try {
      await prisma.$queryRawUnsafe(
        `UPDATE payments SET is_active = false, updated_at = NOW()
         WHERE project_uuid = $1::uuid AND is_project_derived = true`,
        projectUuid
      );
    } catch (e: any) {
      console.warn('Failed to deactivate project-derived payment:', e?.message);
    }

    await logAudit({
      table: 'projects',
      recordId: id,
      action: 'delete',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`DELETE /projects/${params.id} error:`, error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete project' },
      { status: 500 }
    );
  }
}
