import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xml')) {
      return NextResponse.json(
        { error: "Only XML files are accepted" },
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

    // Save the file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const timestamp = new Date().getTime();
    const filename = `bog_${timestamp}_${file.name}`;
    const filepath = join(uploadsDir, filename);
    
    await writeFile(filepath, buffer);
    console.log(`[Upload] Saved file: ${filepath}`);

    // Run the XML parser script
    try {
      console.log(`[Upload] Running XML parser for ${filename}...`);
      const { stdout, stderr } = await execPromise(
        `python parse-bog-xml.py "${filepath}"`,
        { cwd: process.cwd() }
      );
      
      if (stderr) {
        console.error(`[Upload] Parser stderr:`, stderr);
      }
      console.log(`[Upload] Parser output:`, stdout);

      // Run the consolidation script
      console.log(`[Upload] Running consolidation process...`);
      const { stdout: stdout2, stderr: stderr2 } = await execPromise(
        `python process-raw-to-consolidated.py`,
        { cwd: process.cwd() }
      );
      
      if (stderr2) {
        console.error(`[Upload] Consolidation stderr:`, stderr2);
      }
      console.log(`[Upload] Consolidation output:`, stdout2);

      return NextResponse.json({
        success: true,
        message: "File uploaded and processed successfully",
        filename,
        parserOutput: stdout,
        consolidationOutput: stdout2
      });
    } catch (error: any) {
      console.error(`[Upload] Processing error:`, error);
      return NextResponse.json(
        { 
          error: "Failed to process file", 
          details: error.message,
          stdout: error.stdout,
          stderr: error.stderr
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[Upload] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
