import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { getInsiderOptions, resolveInsiderSelection, sqlUuidInList } from '@/lib/insider-selection';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { reparseByPaymentId } from '@/lib/bank-import/reparse';

const SOURCE_TABLES = [
  "GE78BG0000000893486000_BOG_GEL",
  "GE65TB7856036050100002_TBC_GEL",
];

const UNION_SQL = SOURCE_TABLES.map((table) => (
  `SELECT
     raw_record_uuid::text as raw_record_uuid,
     payment_id::text as payment_id,
     nominal_amount::numeric as nominal_amount,
     account_currency_amount::numeric as account_currency_amount
   FROM "${table}"`
)).join(' UNION ALL ');


// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET all projects or filter by query params
// Updated: 2025-12-19 22:00 - Fixed project_employees join using project_uuid
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectUuid = searchParams.get('uuid');
    const selection = await resolveInsiderSelection(req);
    const insiderUuidListSql = sqlUuidInList(selection.selectedUuids);

    if (projectUuid) {
      const project = await withRetry(() => prisma.$queryRawUnsafe(
        `SELECT 
          p.*,
          COALESCE(insider_ca.insider, false) as is_insider,
          COALESCE(insider_ca.insider_name, insider_ca.counteragent, insider_ca.name, p.insider_uuid::text) as insider_name,
          p.insider_uuid as effective_insider_uuid,
          COALESCE(pp.total_payment, 0) as total_payments,
          (p.value - COALESCE(pp.total_payment, 0)) as balance
        FROM projects p
        LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
        LEFT JOIN counteragents insider_ca ON p.insider_uuid = insider_ca.counteragent_uuid
        LEFT JOIN (
          SELECT
            p.project_uuid,
            p.counteragent_uuid,
            SUM(ABS(COALESCE(bank_agg.total_payment, 0))) as total_payment
          FROM payments p
          LEFT JOIN (
            SELECT
              payment_id,
              SUM(nominal_amount) as total_payment
            FROM (
              SELECT
                cba.payment_id,
                cba.nominal_amount,
                cba.raw_record_uuid,
                cba.account_currency_amount
              FROM (
                ${UNION_SQL}
              ) cba
              WHERE NOT EXISTS (
                SELECT 1 FROM bank_transaction_batches btb
                WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
              )

              UNION ALL

              SELECT
                btb.payment_id,
                (COALESCE(NULLIF(btb.nominal_amount, 0), btb.partition_amount) * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount,
                cba.raw_record_uuid,
                cba.account_currency_amount
              FROM (
                ${UNION_SQL}
              ) cba
              JOIN bank_transaction_batches btb
                ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
            ) combined
            WHERE payment_id IS NOT NULL
            GROUP BY payment_id
          ) bank_agg ON p.payment_id = bank_agg.payment_id
          WHERE p.is_active = true
          GROUP BY p.project_uuid, p.counteragent_uuid
        ) pp ON p.project_uuid = pp.project_uuid AND p.counteragent_uuid = pp.counteragent_uuid
        WHERE p.project_uuid = $1::uuid
          AND p.insider_uuid IN (${insiderUuidListSql})
        `,
        projectUuid
      ));
      const serialized = (project as any[]).map((p: any) => ({
        ...p,
        id: Number(p.id),
        insider_uuid: p.insider_uuid ?? p.effective_insider_uuid ?? null,
        is_insider: p.is_insider ?? false,
        insider_name: p.insider_name ?? null,
      }));
      return NextResponse.json(serialized, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // Query uses project_uuid (not project_id) to join with project_employees table
    const projects = await withRetry(() => prisma.$queryRawUnsafe(`
      SELECT 
        p.*,
        MAX(COALESCE(insider_ca.insider, false)::int)::boolean as is_insider,
        MAX(COALESCE(insider_ca.insider_name, insider_ca.counteragent, insider_ca.name, p.insider_uuid::text)) as insider_name,
        MAX(p.insider_uuid::text) as effective_insider_uuid,
        ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'employeeUuid', pe.employee_uuid,
            'employeeName', c.name
          )
        ) FILTER (WHERE pe.employee_uuid IS NOT NULL) as employees
        ,COALESCE(MAX(pp.total_payment), 0) as total_payments
        ,(p.value - COALESCE(MAX(pp.total_payment), 0)) as balance
      FROM projects p
      LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
      LEFT JOIN counteragents insider_ca ON p.insider_uuid = insider_ca.counteragent_uuid
      LEFT JOIN project_employees pe ON p.project_uuid = pe.project_uuid
      LEFT JOIN counteragents c ON pe.employee_uuid = c.counteragent_uuid
      LEFT JOIN (
        SELECT
          p.project_uuid,
          p.counteragent_uuid,
          SUM(ABS(COALESCE(bank_agg.total_payment, 0))) as total_payment
        FROM payments p
        LEFT JOIN (
          SELECT
            payment_id,
            SUM(nominal_amount) as total_payment
          FROM (
            SELECT
              cba.payment_id,
              cba.nominal_amount,
              cba.raw_record_uuid,
              cba.account_currency_amount
            FROM (
              ${UNION_SQL}
            ) cba
            WHERE NOT EXISTS (
              SELECT 1 FROM bank_transaction_batches btb
              WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
            )

            UNION ALL

            SELECT
              btb.payment_id,
              (COALESCE(NULLIF(btb.nominal_amount, 0), btb.partition_amount) * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount,
              cba.raw_record_uuid,
              cba.account_currency_amount
            FROM (
              ${UNION_SQL}
            ) cba
            JOIN bank_transaction_batches btb
              ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
          ) combined
          WHERE payment_id IS NOT NULL
          GROUP BY payment_id
        ) bank_agg ON p.payment_id = bank_agg.payment_id
        WHERE p.is_active = true
        GROUP BY p.project_uuid, p.counteragent_uuid
      ) pp ON p.project_uuid = pp.project_uuid AND p.counteragent_uuid = pp.counteragent_uuid
      WHERE p.insider_uuid IN (${insiderUuidListSql})
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `));

    // Convert BigInt to Number for JSON serialization
    const serialized = (projects as any[]).map((project: any) => ({
      ...project,
      id: Number(project.id),
      insider_uuid: project.insider_uuid ?? project.effective_insider_uuid ?? null,
      is_insider: project.is_insider ?? false,
      insider_name: project.insider_name ?? null,
    }));

    return NextResponse.json(serialized, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error('GET /projects error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST create new project
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const body = await req.json();
    const {
      projectName,
      date,
      value,
      oris1630,
      address,
      department,
      serviceState,
      counteragentUuid,
      financialCodeUuid,
      currencyUuid,
      stateUuid,
      insiderUuid,
      employees, // Array of employee UUIDs
      bundleDistribution
    } = body;
    const selection = await resolveInsiderSelection(req);
    const insiderOptions = await getInsiderOptions();
    const insiderOptionSet = new Set(insiderOptions.map((option) => option.insiderUuid.toLowerCase()));

    const requestedInsiderUuid = insiderUuid ? String(insiderUuid).trim() : null;
    if (requestedInsiderUuid && !insiderOptionSet.has(requestedInsiderUuid.toLowerCase())) {
      return NextResponse.json(
        { error: 'Selected insider is invalid' },
        { status: 400 }
      );
    }

    const effectiveInsiderUuid = requestedInsiderUuid || selection.primaryInsider?.insiderUuid || null;

    if (!effectiveInsiderUuid) {
      return NextResponse.json(
        { error: 'Insider is required' },
        { status: 400 }
      );
    }

    // Validation
    if (!projectName || !/^[a-zA-Z0-9\s]+$/.test(projectName)) {
      return NextResponse.json(
        { error: 'Project name must contain only English letters and numbers' },
        { status: 400 }
      );
    }

    if (!date || isNaN(new Date(date).getTime())) {
      return NextResponse.json(
        { error: 'Valid date is required' },
        { status: 400 }
      );
    }

    if (!value || parseFloat(value) <= 0) {
      return NextResponse.json(
        { error: 'Value must be greater than 0' },
        { status: 400 }
      );
    }

    if (!counteragentUuid || !financialCodeUuid || !currencyUuid || !stateUuid) {
      return NextResponse.json(
        { error: 'All required UUIDs must be provided' },
        { status: 400 }
      );
    }

    // Insert project (triggers will handle lookups and computed fields)
    const result = await prisma.$queryRaw`
      INSERT INTO projects (
        project_name,
        date,
        value,
        oris_1630,
        address,
        department,
        service_state,
        counteragent_uuid,
        financial_code_uuid,
        currency_uuid,
        state_uuid,
        insider_uuid
      ) VALUES (
        ${projectName},
        ${new Date(date)}::date,
        ${parseFloat(value)}::decimal,
        ${oris1630 || null},
        ${address || null},
        ${department || null},
        ${serviceState || null},
        ${counteragentUuid}::uuid,
        ${financialCodeUuid}::uuid,
        ${currencyUuid}::uuid,
        ${stateUuid}::uuid,
        ${effectiveInsiderUuid}::uuid
      )
      RETURNING *
    `;

    const project: any = Array.isArray(result) ? result[0] : result;

    // Insert employees if provided
    if (employees && Array.isArray(employees) && employees.length > 0) {
      for (const employeeUuid of employees) {
        await prisma.$queryRaw`
          INSERT INTO project_employees (project_uuid, employee_uuid)
          VALUES (${project.project_uuid}::uuid, ${employeeUuid}::uuid)
        `;
      }
    }

    // Auto-create project-derived payment only if financial code has automated_payment_id=true
    try {
      const fcRows = await prisma.$queryRawUnsafe<Array<{ automated_payment_id: boolean; is_bundle: boolean }>>(
        `SELECT automated_payment_id, is_bundle FROM financial_codes WHERE uuid = $1::uuid LIMIT 1`,
        financialCodeUuid
      );
      const autoPaymentEnabled = fcRows.length > 0 && fcRows[0].automated_payment_id === true;
      const isBundleFC = fcRows.length > 0 && fcRows[0].is_bundle === true;

      // Only create parent payment if NOT a bundle FC
      // Bundle child payments will be created on-demand via bundleDistribution
      if (autoPaymentEnabled && !isBundleFC) {
        await prisma.$queryRaw`
          INSERT INTO payments (
            project_uuid,
            counteragent_uuid,
            financial_code_uuid,
            job_uuid,
            income_tax,
            currency_uuid,
            payment_id,
            record_uuid,
            insider_uuid,
            is_project_derived,
            updated_at
          ) VALUES (
            ${project.project_uuid}::uuid,
            ${counteragentUuid}::uuid,
            ${financialCodeUuid}::uuid,
            NULL,
            false,
          ${currencyUuid}::uuid,
          '',
          '',
          ${effectiveInsiderUuid}::uuid,
          true,
          NOW()
        )
      `;
      }

      // Bundle child payments are NOT auto-created
      // They are created on-demand when user enters distribution data
    } catch (paymentError: any) {
      // Log but don't fail project creation if payment already exists (composite unique conflict)
      console.warn('Auto-create project-derived payment skipped:', paymentError?.message);
    }

    // Handle bundle distribution - create or update payment IDs for bundle child payments (POST)
    if (bundleDistribution && Array.isArray(bundleDistribution) && bundleDistribution.length > 0) {
      for (const distRow of bundleDistribution) {
        if (!distRow.financialCodeUuid) continue;
        
        // Skip rows with no amount/percentage (not distributed)
        const distributedAmount = distRow.amount && parseFloat(distRow.amount) > 0 ? parseFloat(distRow.amount) : 0;
        const hasDistribution = distributedAmount > 0 || (distRow.percentage && parseFloat(distRow.percentage) > 0);
        if (!hasDistribution) continue;

        // Find the bundle payment for this child FC (regardless of is_project_derived flag)
        const bundlePayments = await prisma.$queryRawUnsafe<Array<{ id: bigint; payment_id: string }>>(
          `SELECT id, payment_id
           FROM payments
           WHERE project_uuid = $1::uuid 
             AND is_bundle_payment = true
             AND financial_code_uuid = $2::uuid
           LIMIT 1`,
          project.project_uuid,
          distRow.financialCodeUuid
        );

        let paymentIdToUse = '';
        let oldPaymentId = '';

        if (bundlePayments.length > 0) {
          // Payment exists - update it
          const newPaymentId = distRow.paymentId || '';
          oldPaymentId = bundlePayments[0].payment_id || '';
          paymentIdToUse = oldPaymentId;
          
          if (newPaymentId && oldPaymentId !== newPaymentId) {
            await prisma.$queryRawUnsafe(
              `UPDATE payments 
               SET payment_id = $1, 
                   record_uuid = $2,
                   updated_at = NOW() 
               WHERE id = $3`,
              newPaymentId,
              newPaymentId,
              bundlePayments[0].id
            );
            paymentIdToUse = newPaymentId;

            // Reparse bank transactions if payment_id was set
            await reparseByPaymentId(newPaymentId);
          }
        } else {
          // Payment doesn't exist - create it
          try {
            const newPaymentId = distRow.paymentId || '';
            paymentIdToUse = newPaymentId;
            oldPaymentId = '';
            await prisma.$queryRawUnsafe(
              `INSERT INTO payments (
                project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax,
                currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, is_bundle_payment, updated_at
              ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, $5, $6, $7::uuid, false, true, NOW())`,
              project.project_uuid, counteragentUuid, distRow.financialCodeUuid, currencyUuid, 
              newPaymentId, newPaymentId, effectiveInsiderUuid
            );

            // Reparse if payment_id was set
            if (newPaymentId) {
              await reparseByPaymentId(newPaymentId);
            }
          } catch (createErr: any) {
            console.warn('Bundle child payment creation skipped:', createErr?.message);
          }
        }

        // Upsert payments_ledger: find existing auto-managed entry, update in place; insert if none
        if (distributedAmount > 0 && paymentIdToUse) {
          try {
            // Parse date from dd.mm.yyyy format, use current date if empty or invalid
            const dateParts = (distRow.distributionDate || '').split('.');
            let effectiveDate = new Date();
            if (dateParts.length === 3) {
              const [day, month, year] = dateParts;
              effectiveDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }

            const comment = `Bundle distribution: ${distRow.financialCodeName}`;

            // Find all auto-managed ledger entries for this payment (NULL or Bundle distribution comment)
            // Search both new and old payment_id to handle payment_id changes
            const existingLedger = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
              `SELECT id FROM payments_ledger
               WHERE (comment IS NULL OR comment LIKE 'Bundle distribution:%')
                 AND (payment_id = $1 OR ($2 <> '' AND payment_id = $2))
               ORDER BY id ASC`,
              paymentIdToUse,
              oldPaymentId
            );

            if (existingLedger.length > 0) {
              // Update the oldest matching row in place
              const keepId = existingLedger[0].id;
              await prisma.$queryRawUnsafe(
                `UPDATE payments_ledger
                 SET payment_id = $1, effective_date = $2, accrual = $3, "order" = $3,
                     comment = $4, insider_uuid = $5::uuid, user_email = $6, updated_at = NOW()
                 WHERE id = $7`,
                paymentIdToUse, effectiveDate, distributedAmount, comment,
                effectiveInsiderUuid, auth.user?.email || 'system', keepId
              );
              // Delete any extra duplicate rows
              if (existingLedger.length > 1) {
                const extraIds = existingLedger.slice(1).map(r => r.id.toString()).join(',');
                await prisma.$queryRawUnsafe(
                  `DELETE FROM payments_ledger WHERE id IN (${extraIds})`
                );
              }
            } else {
              await prisma.$queryRawUnsafe(
                `INSERT INTO payments_ledger (
                  payment_id, effective_date, accrual, "order", user_email, comment, insider_uuid
                ) VALUES ($1, $2, $3, $3, $4, $5, $6::uuid)`,
                paymentIdToUse,
                effectiveDate,
                distributedAmount,
                auth.user?.email || 'system',
                comment,
                effectiveInsiderUuid
              );
            }
          } catch (ledgerErr: any) {
            console.warn('Bundle ledger upsert skipped:', ledgerErr?.message);
          }
        }
      }
    }

    await logAudit({
      table: 'projects',
      recordId: Number(project.id),
      action: 'create',
    });

    // Serialize BigInt values for JSON response
    const serializedProject = {
      ...project,
      id: Number(project.id),
    };

    return NextResponse.json(serializedProject, { status: 201 });
  } catch (error: any) {
    console.error('POST /projects error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create project' },
      { status: 500 }
    );
  }
}

// PATCH update existing project
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      project_name,
      date,
      value,
      oris_1630,
      address,
      department,
      service_state,
      counteragent_uuid,
      financial_code_uuid,
      currency_uuid,
      state_uuid,
      insider_uuid,
      employees,
      bundleDistribution,
      deconfirmBeforeScale
    } = body;
    const selection = await resolveInsiderSelection(req);
    const insiderOptions = await getInsiderOptions();
    const insiderOptionSet = new Set(insiderOptions.map((option) => option.insiderUuid.toLowerCase()));

    const requestedInsiderUuid = insider_uuid ? String(insider_uuid).trim() : null;
    if (requestedInsiderUuid && !insiderOptionSet.has(requestedInsiderUuid.toLowerCase())) {
      // Allow keeping the existing project insider_uuid even if the counteragent is no
      // longer flagged insider=true (the option may have been removed). Only reject if
      // the user is changing to a UUID that is neither the existing one nor in the options.
      const existingInsiderRows = await prisma.$queryRawUnsafe<Array<{ insider_uuid: string | null }>>(
        `SELECT insider_uuid::text FROM projects WHERE id = $1 LIMIT 1`,
        parseInt(id)
      );
      const existingInsiderUuid = existingInsiderRows[0]?.insider_uuid || null;
      if (!existingInsiderUuid || existingInsiderUuid.toLowerCase() !== requestedInsiderUuid.toLowerCase()) {
        return NextResponse.json(
          { error: 'Selected insider is invalid' },
          { status: 400 }
        );
      }
    }

    const effectiveInsiderUuid = requestedInsiderUuid || selection.primaryInsider?.insiderUuid || null;

    // Validation
    if (project_name && !/^[a-zA-Z0-9\s]+$/.test(project_name)) {
      return NextResponse.json(
        { error: 'Project name must contain only English letters and numbers' },
        { status: 400 }
      );
    }

    if (date && isNaN(new Date(date).getTime())) {
      return NextResponse.json(
        { error: 'Valid date is required' },
        { status: 400 }
      );
    }

    if (value && parseFloat(value) <= 0) {
      return NextResponse.json(
        { error: 'Value must be greater than 0' },
        { status: 400 }
      );
    }

    // Fetch current project value before update so we can scale ledger entries proportionally
    const currentProjectRows = await prisma.$queryRawUnsafe<Array<{ project_uuid: string; value: any }>>(
      `SELECT project_uuid, value FROM projects WHERE id = $1 LIMIT 1`,
      parseInt(id)
    );
    const oldProjectValue = currentProjectRows.length > 0 ? parseFloat(currentProjectRows[0].value) : null;
    const oldProjectUuid = currentProjectRows.length > 0 ? currentProjectRows[0].project_uuid : null;

    // Update project
    const result = await prisma.$queryRaw`
      UPDATE projects 
      SET 
        project_name = COALESCE(${project_name}, project_name),
        date = COALESCE(${date ? new Date(date) : null}::date, date),
        value = COALESCE(${value ? parseFloat(value) : null}::decimal, value),
        oris_1630 = COALESCE(${oris_1630}, oris_1630),
        address = COALESCE(${address}, address),
        department = COALESCE(${department}, department),
        service_state = COALESCE(${service_state}, service_state),
        counteragent_uuid = COALESCE(${counteragent_uuid}::uuid, counteragent_uuid),
        financial_code_uuid = COALESCE(${financial_code_uuid}::uuid, financial_code_uuid),
        currency_uuid = COALESCE(${currency_uuid}::uuid, currency_uuid),
        state_uuid = COALESCE(${state_uuid}::uuid, state_uuid),
        insider_uuid = COALESCE(${effectiveInsiderUuid}::uuid, insider_uuid),
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    const project: any = Array.isArray(result) ? result[0] : result;

    // If value changed, proportionally scale auto-generated payment ledger entries for this project
    // (is_project_derived = true: main project payment; is_bundle_payment = true: bundle child payments)
    if (value && oldProjectValue && oldProjectValue > 0 && oldProjectUuid) {
      const newProjectValue = parseFloat(value);
      if (Math.abs(newProjectValue - oldProjectValue) > 0.001) {
        const scaleFactor = newProjectValue / oldProjectValue;

        // If requested, deconfirm auto-generated ledger entries first so the scale UPDATE can reach them
        if (deconfirmBeforeScale) {
          await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.allow_deconfirm', 'true', true)`,
            prisma.$executeRawUnsafe(
              `UPDATE payments_ledger pl
               SET confirmed = false
               WHERE pl.payment_id IN (
                 SELECT payment_id FROM payments
                 WHERE project_uuid = $1::uuid
                   AND (is_project_derived = true OR is_bundle_payment = true)
               )
               AND (pl.is_deleted = false OR pl.is_deleted IS NULL)`,
              oldProjectUuid
            ),
          ]);
        }

        await prisma.$queryRawUnsafe(
          `UPDATE payments_ledger pl
           SET accrual = ROUND(pl.accrual * $1::numeric, 2),
               "order" = ROUND(pl."order" * $1::numeric, 2),
               updated_at = NOW()
           WHERE pl.payment_id IN (
             SELECT payment_id FROM payments
             WHERE project_uuid = $2::uuid
               AND (is_project_derived = true OR is_bundle_payment = true)
           )
           AND (pl.is_deleted = false OR pl.is_deleted IS NULL)
           AND (pl.confirmed IS NULL OR pl.confirmed = false)`,
          scaleFactor,
          oldProjectUuid
        );
      }
    }

    // Update employees if provided
    if (employees && Array.isArray(employees)) {
      // Get project_uuid from id
      const projectData: any = await prisma.$queryRaw`
        SELECT project_uuid FROM projects WHERE id = ${parseInt(id)}
      `;
      const projectUuid = projectData[0]?.project_uuid;

      // Delete existing employees
      await prisma.$queryRaw`
        DELETE FROM project_employees WHERE project_uuid = ${projectUuid}::uuid
      `;

      // Insert new employees
      for (const employeeUuid of employees) {
        await prisma.$queryRaw`
          INSERT INTO project_employees (project_uuid, employee_uuid)
          VALUES (${projectUuid}::uuid, ${employeeUuid}::uuid)
        `;
      }
    }

    // Handle bundle distribution - create or update payment IDs for bundle child payments (PATCH)
    if (bundleDistribution && Array.isArray(bundleDistribution) && bundleDistribution.length > 0) {
      for (const distRow of bundleDistribution) {
        if (!distRow.financialCodeUuid) continue;
        
        // Skip rows with no amount/percentage (not distributed)
        const distributedAmount = distRow.amount && parseFloat(distRow.amount) > 0 ? parseFloat(distRow.amount) : 0;
        const hasDistribution = distributedAmount > 0 || (distRow.percentage && parseFloat(distRow.percentage) > 0);
        if (!hasDistribution) continue;

        // Find the bundle payment for this child FC (regardless of is_project_derived flag)
        const bundlePayments = await prisma.$queryRawUnsafe<Array<{ id: bigint; payment_id: string }>>(
          `SELECT id, payment_id
           FROM payments
           WHERE project_uuid = $1::uuid 
             AND is_bundle_payment = true
             AND financial_code_uuid = $2::uuid
           LIMIT 1`,
          project.project_uuid,
          distRow.financialCodeUuid
        );

        let paymentIdToUse = '';

        if (bundlePayments.length > 0) {
          // Payment exists - update it
          const bundlePayment = bundlePayments[0];
          const newPaymentId = distRow.paymentId || '';
          const oldPaymentId = bundlePayment.payment_id || '';
          paymentIdToUse = oldPaymentId;

          // Only update if payment_id changed
          if (oldPaymentId !== newPaymentId) {
            await prisma.$queryRawUnsafe(
              `UPDATE payments 
               SET payment_id = $1, 
                   record_uuid = $2,
                   updated_at = NOW() 
               WHERE id = $3`,
              newPaymentId,
              newPaymentId,
              bundlePayment.id
            );
            paymentIdToUse = newPaymentId || oldPaymentId;

            // Reparse bank transactions if payment_id was added or changed
            if (newPaymentId) {
              await reparseByPaymentId(newPaymentId);
            }
          }

          // Create/update payments_ledger entry
          if (distributedAmount > 0 && paymentIdToUse) {
            try {
              // Parse date from dd.mm.yyyy format, use current date if empty or invalid
              const dateParts = (distRow.distributionDate || '').split('.');
              let effectiveDate = new Date();
              if (dateParts.length === 3) {
                const [day, month, year] = dateParts;
                effectiveDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              }

              // Get insider_uuid from project
              const projectInsider = await prisma.$queryRawUnsafe<Array<{ insider_uuid: string | null }>>(
                `SELECT insider_uuid FROM projects WHERE project_uuid = $1::uuid LIMIT 1`,
                project.project_uuid
              );
              const insiderUuid = projectInsider[0]?.insider_uuid || null;

              const comment = `Bundle distribution: ${distRow.financialCodeName}`;

              // Find existing auto-managed bundle ledger entries (match on NULL comment OR Bundle distribution prefix)
              const existingLedger = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
                `SELECT id FROM payments_ledger
                 WHERE (comment IS NULL OR comment LIKE 'Bundle distribution:%')
                   AND (payment_id = $1 OR ($2 <> '' AND payment_id = $2))
                 ORDER BY id ASC`,
                paymentIdToUse,
                oldPaymentId
              );

              if (existingLedger.length > 0) {
                const keepId = existingLedger[0].id;
                await prisma.$queryRawUnsafe(
                  `UPDATE payments_ledger
                   SET payment_id = $1, effective_date = $2, accrual = $3, "order" = $3,
                       comment = $4, insider_uuid = $5::uuid, user_email = $6, updated_at = NOW()
                   WHERE id = $7`,
                  paymentIdToUse, effectiveDate, distributedAmount, comment,
                  insiderUuid, auth.user?.email || 'system', keepId
                );
                if (existingLedger.length > 1) {
                  const extraIds = existingLedger.slice(1).map(r => r.id.toString()).join(',');
                  await prisma.$queryRawUnsafe(
                    `DELETE FROM payments_ledger WHERE id IN (${extraIds})`
                  );
                }
              } else {
                await prisma.$queryRawUnsafe(
                  `INSERT INTO payments_ledger (
                    payment_id, effective_date, accrual, "order", user_email, comment, insider_uuid
                  ) VALUES ($1, $2, $3, $3, $4, $5, $6::uuid)`,
                  paymentIdToUse,
                  effectiveDate,
                  distributedAmount,
                  auth.user?.email || 'system',
                  comment,
                  insiderUuid
                );
              }
            } catch (ledgerErr: any) {
              console.warn('Bundle ledger upsert skipped:', ledgerErr?.message);
            }
          }
        } else {
          // Payment doesn't exist - create it
          try {
            const newPaymentId = distRow.paymentId || '';
            paymentIdToUse = newPaymentId;
            // Need to get counteragent and currency from the project
            const projectData = await prisma.$queryRawUnsafe<Array<{ counteragent_uuid: string; currency_uuid: string; insider_uuid: string | null }>>(
              `SELECT counteragent_uuid, currency_uuid, insider_uuid FROM projects WHERE project_uuid = $1::uuid LIMIT 1`,
              project.project_uuid
            );
            if (projectData.length === 0) continue;
            
            const { counteragent_uuid, currency_uuid, insider_uuid } = projectData[0];
            
            await prisma.$queryRawUnsafe(
              `INSERT INTO payments (
                project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax,
                currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, is_bundle_payment, updated_at
              ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, $5, $6, $7::uuid, false, true, NOW())`,
              project.project_uuid, counteragent_uuid, distRow.financialCodeUuid, currency_uuid, 
              newPaymentId, newPaymentId, insider_uuid
            );

            // Reparse if payment_id was set
            if (newPaymentId) {
              await reparseByPaymentId(newPaymentId);
            }

            // Create ledger entry for the newly created payment
            if (distributedAmount > 0 && newPaymentId) {
              try {
                const dateParts = (distRow.distributionDate || '').split('.');
                let effectiveDate = new Date();
                if (dateParts.length === 3) {
                  const [day, month, year] = dateParts;
                  effectiveDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                }
                const comment = `Bundle distribution: ${distRow.financialCodeName}`;
                const existingLedger = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
                  `SELECT id FROM payments_ledger
                   WHERE payment_id = $1
                     AND (comment IS NULL OR comment LIKE 'Bundle distribution:%')
                   ORDER BY id ASC`,
                  newPaymentId
                );
                if (existingLedger.length > 0) {
                  const keepId = existingLedger[0].id;
                  await prisma.$queryRawUnsafe(
                    `UPDATE payments_ledger
                     SET effective_date = $1, accrual = $2, "order" = $2,
                         comment = $3, insider_uuid = $4::uuid, user_email = $5, updated_at = NOW()
                     WHERE id = $6`,
                    effectiveDate, distributedAmount, comment, insider_uuid,
                    auth.user?.email || 'system', keepId
                  );
                  if (existingLedger.length > 1) {
                    const extraIds = existingLedger.slice(1).map(r => r.id.toString()).join(',');
                    await prisma.$queryRawUnsafe(
                      `DELETE FROM payments_ledger WHERE id IN (${extraIds})`
                    );
                  }
                } else {
                  await prisma.$queryRawUnsafe(
                    `INSERT INTO payments_ledger (
                      payment_id, effective_date, accrual, "order", user_email, comment, insider_uuid
                    ) VALUES ($1, $2, $3, $3, $4, $5, $6::uuid)`,
                    newPaymentId,
                    effectiveDate,
                    distributedAmount,
                    auth.user?.email || 'system',
                    comment,
                    insider_uuid
                  );
                }
              } catch (ledgerErr: any) {
                console.warn('Bundle ledger insert (new payment) skipped:', ledgerErr?.message);
              }
            }
          } catch (createErr: any) {
            console.warn('Bundle child payment creation skipped:', createErr?.message);
          }
        }
      }
    }

    await logAudit({
      table: 'projects',
      recordId: parseInt(id),
      action: 'update',
    });

    // Sync project-derived payment with updated project fields
    try {
      // Check if the financial code has automated_payment_id enabled
      const fcRows = await prisma.$queryRawUnsafe<Array<{ automated_payment_id: boolean; is_bundle: boolean }>>(
        `SELECT automated_payment_id, is_bundle FROM financial_codes WHERE uuid = $1::uuid LIMIT 1`,
        project.financial_code_uuid
      );
      const autoPaymentEnabled = fcRows.length > 0 && fcRows[0].automated_payment_id === true;
      const isBundleFC = fcRows.length > 0 && fcRows[0].is_bundle === true;

      const derivedPayments = await prisma.$queryRawUnsafe<Array<{ id: bigint; payment_id: string; counteragent_uuid: string; financial_code_uuid: string; currency_uuid: string; insider_uuid: string | null }>>(
        `SELECT id, payment_id, counteragent_uuid, financial_code_uuid, currency_uuid, insider_uuid
         FROM payments
         WHERE project_uuid = $1::uuid AND is_project_derived = true AND financial_code_uuid = $2::uuid
         LIMIT 1`,
        project.project_uuid,
        project.financial_code_uuid
      );

      if (derivedPayments.length > 0 && autoPaymentEnabled) {
        // Sync existing derived payment
        const dp = derivedPayments[0];
        const newCa = project.counteragent_uuid;
        const newFc = project.financial_code_uuid;
        const newCur = project.currency_uuid;
        const newInsider = project.insider_uuid;
        const changed =
          dp.counteragent_uuid !== newCa ||
          dp.financial_code_uuid !== newFc ||
          dp.currency_uuid !== newCur ||
          dp.insider_uuid !== newInsider;

        if (changed) {
          await prisma.$queryRawUnsafe(
            `UPDATE payments
             SET counteragent_uuid = $1::uuid,
                 financial_code_uuid = $2::uuid,
                 currency_uuid = $3::uuid,
                 insider_uuid = $4::uuid,
                 updated_at = NOW()
             WHERE id = $5`,
            newCa,
            newFc,
            newCur,
            newInsider,
            dp.id
          );

          // Reparse bank transactions attached to this payment
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
            currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, updated_at
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, NOW())`,
          project.project_uuid,
          project.counteragent_uuid,
          project.financial_code_uuid,
          project.currency_uuid,
          project.insider_uuid
        );
      }

      // Bundle payments: one per active child FC of the project's FC
      if (isBundleFC) {
        const childFCs = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
          `SELECT uuid FROM financial_codes WHERE parent_uuid = $1::uuid AND is_active = true`,
          project.financial_code_uuid
        );
        for (const childFC of childFCs) {
          const existingBundle = await prisma.$queryRawUnsafe<Array<{ id: bigint; counteragent_uuid: string; currency_uuid: string; insider_uuid: string | null }>>(
            `SELECT id, counteragent_uuid, currency_uuid, insider_uuid
             FROM payments
             WHERE project_uuid = $1::uuid AND is_bundle_payment = true AND financial_code_uuid = $2::uuid
             LIMIT 1`,
            project.project_uuid, childFC.uuid
          );
          if (existingBundle.length > 0) {
            const bp = existingBundle[0];
            const changed = bp.counteragent_uuid !== project.counteragent_uuid || bp.currency_uuid !== project.currency_uuid || bp.insider_uuid !== project.insider_uuid;
            if (changed) {
              await prisma.$queryRawUnsafe(
                `UPDATE payments SET counteragent_uuid = $1::uuid, currency_uuid = $2::uuid, insider_uuid = $3::uuid, updated_at = NOW() WHERE id = $4`,
                project.counteragent_uuid, project.currency_uuid, project.insider_uuid, bp.id
              );
            }
          } else {
            try {
              await prisma.$queryRawUnsafe(
                `INSERT INTO payments (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, is_bundle_payment, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, false, true, NOW())`,
                project.project_uuid, project.counteragent_uuid, childFC.uuid, project.currency_uuid, project.insider_uuid
              );
            } catch (bundleErr: any) { console.warn('Bundle sync skipped:', bundleErr?.message); }
          }
        }
      } else {
        await prisma.$queryRawUnsafe(
          `UPDATE payments SET is_active = false, updated_at = NOW() WHERE project_uuid = $1::uuid AND is_project_derived = true AND financial_code_uuid != $2::uuid`,
          project.project_uuid, project.financial_code_uuid
        );
      }
    } catch (syncError: any) {
      console.warn('Project-derived payment sync error:', syncError?.message);
    }

    // Serialize BigInt values for JSON response
    const serializedProject = {
      ...project,
      id: Number(project.id),
    };

    return NextResponse.json(serializedProject);
  } catch (error: any) {
    console.error('PATCH /projects error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update project' },
      { status: 500 }
    );
  }
}
