import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

// Force dynamic rendering for cron endpoint
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log('[CRON] Starting Google Sheets sync...');

    // Check if required env vars are set
    if (!process.env.SPREADSHEET_ID) {
      throw new Error("SPREADSHEET_ID not configured");
    }

    // Handle service account credentials
    let serviceAccountFile = process.env.SERVICE_ACCOUNT_FILE || 'bybit-458010-ac7999bfd4c8.json';
    
    // If SERVICE_ACCOUNT_JSON is provided (Vercel), write it to a temp file
    if (process.env.SERVICE_ACCOUNT_JSON) {
      const fs = require('fs');
      const os = require('os');
      const tempFile = path.join(os.tmpdir(), 'service-account.json');
      fs.writeFileSync(tempFile, process.env.SERVICE_ACCOUNT_JSON);
      serviceAccountFile = tempFile;
      console.log('[CRON] Using SERVICE_ACCOUNT_JSON from environment');
    }

    // Path to the Python script
    const scriptPath = path.join(process.cwd(), 'scripts', 'sync-nbg-to-google-sheets.py');
    
    // Set environment variables for the Python script
    const env = {
      ...process.env,
      SPREADSHEET_ID: process.env.SPREADSHEET_ID,
      SHEET_NAME: process.env.SHEET_NAME || 'Copy of NBG',
      SERVICE_ACCOUNT_FILE: serviceAccountFile,
      REMOTE_DATABASE_URL: process.env.DATABASE_URL, // Use Vercel's DATABASE_URL
    };

    console.log('[CRON] Executing Python sync script...');
    
    // Execute the Python script
    const output = execSync(`python3 "${scriptPath}"`, {
      env,
      encoding: 'utf-8',
      timeout: 120000, // 2 minutes timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    console.log('[CRON] Python script output:', output);

    // Parse the output to extract summary
    const lines = output.split('\n');
    const insertedMatch = lines.find(l => l.includes('Inserted'))?.match(/(\d+)/);
    const insertedRows = insertedMatch ? parseInt(insertedMatch[1]) : 0;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      insertedRows,
      output: output.substring(0, 1000) // First 1000 chars of output
    });

  } catch (error: any) {
    console.error("[CRON] Google Sheets sync error", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error?.message || "Failed to sync to Google Sheets",
        output: error?.stdout || error?.stderr || '',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
