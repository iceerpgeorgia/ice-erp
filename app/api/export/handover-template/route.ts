import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/export/handover-template
 * Exports handover template file as-is without modifications
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName } = body;

    if (!fileName) {
      return Response.json(
        { error: 'Missing required field: fileName' },
        { status: 400 }
      );
    }

    // Load template - check root first, then public
    let templatePath = path.join(process.cwd(), 'handover template.xlsx');
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), 'public', 'handover template.xlsx');
    }
    if (!fs.existsSync(templatePath)) {
      return Response.json(
        { error: `Handover template not found` },
        { status: 404 }
      );
    }

    const templateBuffer = fs.readFileSync(templatePath);

    // Return file as-is without any modifications
    console.log('[Export Handover] Returning template file as-is, size:', templateBuffer.length);

    return new Response(new Uint8Array(templateBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Content-Length': templateBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Export Handover] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}
