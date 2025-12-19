import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

// GET all projects or filter by query params
// Updated: 2025-12-19 - Fixed project_employees join
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
            'employeeName', c.name
          )
        ) FILTER (WHERE pe.employee_uuid IS NOT NULL) as employees
      FROM projects p
      LEFT JOIN project_employees pe ON p.project_uuid = pe.project_uuid
      LEFT JOIN counteragents c ON pe.employee_uuid = c.counteragent_uuid
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
        await prisma.$queryRaw`
          INSERT INTO project_employees (project_uuid, employee_uuid)
          VALUES (${project.project_uuid}::uuid, ${employeeUuid}::uuid)
        `;
      }
    }

    await logAudit({
      table: 'projects',
      recordId: project.id,
      action: 'create',
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

// PATCH update existing project
export async function PATCH(req: NextRequest) {
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
      counteragent_uuid,
      financial_code_uuid,
      currency_uuid,
      state_uuid,
      employees
    } = body;

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

    // Update project
    const result = await prisma.$queryRaw`
      UPDATE projects 
      SET 
        project_name = COALESCE(${project_name}, project_name),
        date = COALESCE(${date ? new Date(date) : null}::date, date),
        value = COALESCE(${value ? parseFloat(value) : null}::decimal, value),
        oris_1630 = COALESCE(${oris_1630}, oris_1630),
        counteragent_uuid = COALESCE(${counteragent_uuid}::uuid, counteragent_uuid),
        financial_code_uuid = COALESCE(${financial_code_uuid}::uuid, financial_code_uuid),
        currency_uuid = COALESCE(${currency_uuid}::uuid, currency_uuid),
        state_uuid = COALESCE(${state_uuid}::uuid, state_uuid),
        updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    const project: any = Array.isArray(result) ? result[0] : result;

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

    await logAudit({
      table: 'projects',
      recordId: parseInt(id),
      action: 'update',
    });

    return NextResponse.json(project);
  } catch (error: any) {
    console.error('PATCH /projects error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update project' },
      { status: 500 }
    );
  }
}
