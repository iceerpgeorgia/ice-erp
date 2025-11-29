import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    console.log("[exchange-rates/update] Starting NBG rate update via Python script");

    // Execute the Python script
    const { stdout, stderr } = await execAsync('python scripts/update-nbg-rates.py', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || process.env.REMOTE_DATABASE_URL,
      },
    });

    if (stderr && !stderr.includes('warning')) {
      console.error("[exchange-rates/update] Python stderr:", stderr);
    }

    console.log("[exchange-rates/update] Python stdout:", stdout);

    // Check if the script succeeded (exit code is 0 when execAsync succeeds)
    if (stdout.includes('✅')) {
      return NextResponse.json({
        success: true,
        message: "Successfully updated NBG rates",
        output: stdout,
      });
    } else {
      throw new Error("Python script did not complete successfully");
    }
  } catch (error: any) {
    console.error("[exchange-rates/update] Error:", error);
    return NextResponse.json(
      { 
        error: error?.message || "Failed to update from NBG API",
        details: error?.stderr || error?.stdout,
      },
      { status: 500 }
    );
  }
}
