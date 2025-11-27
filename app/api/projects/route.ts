import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

// GET all projects or filter by query params
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectUuid = searchParams.get('uuid');

    if (projectUuid) {
      const project = await prisma.$queryRaw`
        SELECT * FROM projects WHERE project_uuid = ${projectUuid}::uuid
      `;
      return NextResponse.json(project);
    }

    const projects = await prisma.$queryRaw`
      SELECT 
        p.*,
        ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'employeeUuid', pe.employee_uuid,
            'employeeName', pe.employee_name
          )
        ) FILTER (WHERE pe.employee_uuid IS NOT NULL) as employees
      FROM projects p
      LEFT JOIN project_employees pe ON p.id = pe.project_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;

    return NextResponse.json(projects);
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
  try {
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
        counteragent_uuid,
        financial_code_uuid,
        currency_uuid,
        state_uuid
      ) VALUES (
        ${projectName},
        ${new Date(date)}::date,
        ${parseFloat(value)}::decimal,
        ${oris1630 || null},
        ${counteragentUuid}::uuid,
        ${financialCodeUuid}::uuid,
        ${currencyUuid}::uuid,
        ${stateUuid}::uuid
      )
      RETURNING *
    `;

    const project: any = Array.isArray(result) ? result[0] : result;

    // Insert employees if provided
    if (employees && Array.isArray(employees) && employees.length > 0) {
      for (const employeeUuid of employees) {
        // Get employee name
        const employeeData: any = await prisma.$queryRaw`
          SELECT name FROM counteragents WHERE counteragent_uuid = ${employeeUuid}::uuid
        `;
        const employeeName = employeeData[0]?.name || null;

        await prisma.$queryRaw`
          INSERT INTO project_employees (project_id, employee_uuid, employee_name)
          VALUES (${project.id}, ${employeeUuid}::uuid, ${employeeName})
        `;
      }
    }

    await logAudit({
      table: 'projects',
      recordId: project.id,
      action: 'CREATE',
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    console.error('POST /projects error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create project' },
      { status: 500 }
    );
  }
}
