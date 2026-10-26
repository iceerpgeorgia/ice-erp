import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getJobLiftCertInfo } from '@/lib/attachments';
import { v4 as uuid } from 'uuid';

function toDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * POST /api/handovers/emit
 * Emit (finalize and lock) all non-emitted distributions for a project.
 *
 * Supports multiple emissions per project:
 * - Each call creates a new handover_emissions record with unique UUID
 * - Only targets records where emission_uuid IS NULL (non-emitted)
 * - After emission, new distributions can be added and emitted again
 * - All emissions remain in audit trail permanently
 * - UI should display the most recent emission by emission_date
 *
 * Request body: { projectUuid: string, certDate?: string, certDates?: string[] }
 * Response: { success: true, emission: {...}, emitted_count: number, records: [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectUuid, certDate, certDates } = body;

    if (!projectUuid) {
      return NextResponse.json(
        { error: 'projectUuid is required' },
        { status: 400 }
      );
    }

    const requestedDates = Array.from(
      new Set(
        [
          ...(Array.isArray(certDates) ? certDates : []),
          ...(typeof certDate === 'string' && certDate ? [certDate] : []),
        ]
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean),
      ),
    );

    if (requestedDates.some((value) => !isIsoDate(value))) {
      return NextResponse.json(
        { error: 'certDates must use YYYY-MM-DD format' },
        { status: 400 },
      );
    }

    const emitWhere: any = {
      project_uuid: projectUuid,
      emission_uuid: null,
    };

    if (requestedDates.length > 0) {
      const nonEmittedJobs = await prisma.payments_jobs.findMany({
        where: {
          project_uuid: projectUuid,
          emission_uuid: null,
        },
        select: { job_uuid: true },
        distinct: ['job_uuid'],
      });

      const candidateJobUuids = nonEmittedJobs.map((row) => row.job_uuid);
      if (candidateJobUuids.length === 0) {
        return NextResponse.json(
          { error: 'No non-emitted distributions found for this project' },
          { status: 400 },
        );
      }

      const liftInfo = await getJobLiftCertInfo(candidateJobUuids);
      const selectedDateSet = new Set(requestedDates);

      const scopedJobUuids = candidateJobUuids.filter((jobUuid) => {
        const dateKey = toDateKey(liftInfo[jobUuid]?.date ?? null);
        return Boolean(dateKey && selectedDateSet.has(dateKey));
      });

      if (scopedJobUuids.length === 0) {
        return NextResponse.json(
          { error: 'No non-emitted distributions found for selected cert date(s)' },
          { status: 400 },
        );
      }

      emitWhere.job_uuid = { in: scopedJobUuids };
    }

    // Get scoped non-emitted distributions for this project.
    // Multiple emissions are supported: each emission locks the current non-emitted records,
    // and new distributions can be added and emitted again later.
    const nonEmittedRecords = await prisma.payments_jobs.findMany({
      where: emitWhere,
      include: {
        payment: true,
        job: true,
        project: true,
      },
    });

    if (nonEmittedRecords.length === 0) {
      return NextResponse.json(
        { error: 'No non-emitted distributions found for this project' },
        { status: 400 }
      );
    }

    // Create a new handover emission record
    const emissionUuid = uuid();
    const emissionDate = new Date();

    const emission = await prisma.handover_emissions.create({
      data: {
        uuid: emissionUuid,
        created_by: session.user.email,
        description:
          requestedDates.length > 0
            ? `Handover emission for project ${projectUuid} (cert dates: ${requestedDates.join(', ')})`
            : `Handover emission for project ${projectUuid}`,
      },
    });

    // Update all non-emitted records with emission UUID and date
    const updated = await prisma.payments_jobs.updateMany({
      where: emitWhere,
      data: {
        emission_uuid: emissionUuid,
        emission_date: emissionDate,
        updated_by: session.user.email,
      },
    });

    return NextResponse.json(
      {
        success: true,
        emission: {
          uuid: emission.uuid,
          created_at: emission.created_at,
          created_by: emission.created_by,
        },
        cert_dates: requestedDates,
        emitted_count: updated.count,
        records: nonEmittedRecords.map(r => ({
          uuid: r.uuid,
          payment_uuid: r.payment_uuid,
          job_uuid: r.job_uuid,
          project_uuid: r.project_uuid,
          amount: r.amount,
          allocation_type: r.allocation_type,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Handovers Emit]', error);
    return NextResponse.json(
      { error: 'Failed to emit handover' },
      { status: 500 }
    );
  }
}
