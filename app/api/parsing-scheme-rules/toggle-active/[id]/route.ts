import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const client = await pool.connect();

  try {
    const { active } = await request.json();

    if (typeof active !== 'boolean') {
      return NextResponse.json(
        { error: 'Active status must be a boolean' },
        { status: 400 }
      );
    }

    const result = await client.query(
      'UPDATE parsing_scheme_rules SET active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [active, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling rule active status:', error);
    return NextResponse.json(
      { error: 'Failed to toggle rule active status' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
