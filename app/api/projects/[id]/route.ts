import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

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
      action: 'UPDATE',
    });

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

    await prisma.$queryRaw`
      DELETE FROM projects WHERE id = ${id}
    `;

    await logAudit({
      table: 'projects',
      recordId: id,
      action: 'DELETE',
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
