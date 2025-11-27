import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    // Save file to temp directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = join(tmpdir(), `${randomUUID()}-${file.name}`);
    await writeFile(tempFilePath, buffer);

    // Run the import script
    const projectRoot = process.cwd();
    const { stdout, stderr } = await execPromise(
      `cd ${projectRoot} && node scripts/import_projects.js "${tempFilePath}"`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );

    // Parse the output to extract statistics
    const output = stdout + stderr;
    const createdMatch = output.match(/Created:\s+(\d+)/);
    const updatedMatch = output.match(/Updated:\s+(\d+)/);
    const failedMatch = output.match(/Failed:\s+(\d+)/);

    const result = {
      created: createdMatch ? parseInt(createdMatch[1]) : 0,
      updated: updatedMatch ? parseInt(updatedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      output: output
    };

    // Clean up temp file (optional, OS will handle it)
    try {
      const { unlink } = await import('fs/promises');
      await unlink(tempFilePath);
    } catch (e) {
      // Ignore cleanup errors
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
