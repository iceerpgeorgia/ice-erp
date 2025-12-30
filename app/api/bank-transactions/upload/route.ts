import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Validate all files are XML
    const invalidFiles = files.filter(f => !f.name.toLowerCase().endsWith('.xml'));
    if (invalidFiles.length > 0) {
      return NextResponse.json(
        { error: `Only XML files are accepted. Invalid files: ${invalidFiles.map(f => f.name).join(', ')}` },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "uploads");
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    const results = [];
    let allLogs = `Processing ${files.length} file(s)...\n\n`;

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileNum = i + 1;
      allLogs += `\n${'='.repeat(60)}\n`;
      allLogs += `FILE ${fileNum}/${files.length}: ${file.name}\n`;
      allLogs += `${'='.repeat(60)}\n\n`;

      try {
        // Save the file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const timestamp = new Date().getTime();
        const filename = `bog_${timestamp}_${file.name}`;
        const filepath = join(uploadsDir, filename);
        
        await writeFile(filepath, buffer);
        allLogs += `✓ File saved: ${filename}\n\n`;

        // Run the XML parser script
        allLogs += `Running XML parser...\n`;
        const { stdout, stderr } = await execPromise(
          `python parse-bog-xml.py "${filepath}"`,
          { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }
        );
        
        allLogs += stdout;
        if (stderr) {
          allLogs += `\nWarnings/Errors:\n${stderr}\n`;
        }

        results.push({
          filename: file.name,
          success: true,
          savedAs: filename
        });
      } catch (error: any) {
        allLogs += `\n✗ ERROR processing ${file.name}:\n${error.message}\n`;
        if (error.stdout) allLogs += `\nOutput:\n${error.stdout}\n`;
        if (error.stderr) allLogs += `\nError details:\n${error.stderr}\n`;
        
        results.push({
          filename: file.name,
          success: false,
          error: error.message
        });
      }
    }

    // Run consolidation once after all files
    allLogs += `\n${'='.repeat(60)}\n`;
    allLogs += `CONSOLIDATION PROCESS\n`;
    allLogs += `${'='.repeat(60)}\n\n`;

    try {
      const { stdout: stdout2, stderr: stderr2 } = await execPromise(
        `python process-raw-to-consolidated.py`,
        { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }
      );
      
      allLogs += stdout2;
      if (stderr2) {
        allLogs += `\nWarnings/Errors:\n${stderr2}\n`;
      }
    } catch (error: any) {
      allLogs += `\n✗ CONSOLIDATION ERROR:\n${error.message}\n`;
      if (error.stdout) allLogs += `\nOutput:\n${error.stdout}\n`;
      if (error.stderr) allLogs += `\nError details:\n${error.stderr}\n`;
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      message: `Processed ${files.length} file(s): ${successCount} succeeded, ${failCount} failed`,
      results,
      logs: allLogs
    });
  } catch (error: any) {
    console.error("[Upload] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload files" },
      { status: 500 }
    );
  }
}
