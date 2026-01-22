import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { processBOGGEL } from "@/lib/bank-import/bog-gel-processor";
import { getSupabaseClient } from "@/lib/bank-import/db-utils";

/**
 * Bank XML Upload API - TypeScript Implementation
 * Processes BOG GEL XML files on Vercel using TypeScript
 * Equivalent to Python import_bank_xml_data.py
 */
export async function POST(req: NextRequest) {
  const importBatchId = uuidv4();
  let allLogs = "";

  // Capture console.log output
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    allLogs += message + '\n';
    originalLog(...args);
  };

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

    const results = [];
    console.log(`Processing ${files.length} file(s)...\n`);
    console.log(`Import Batch ID: ${importBatchId}\n`);

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileNum = i + 1;
      console.log('\n' + '='.repeat(60));
      console.log(`FILE ${fileNum}/${files.length}: ${file.name}`);
      console.log('='.repeat(60) + '\n');

      try {
        // Read XML content
        const xmlContent = await file.text();
        console.log(`✓ File read: ${file.name} (${xmlContent.length} bytes)\n`);

        // Parse XML to identify account
        const { parseStringPromise } = await import('xml2js');
        const parsed = await parseStringPromise(xmlContent);
        const header = parsed.STATEMENT?.HEADER?.[0];

        if (!header) {
          throw new Error('Invalid BOG GEL XML format - missing HEADER');
        }

        const accountInfoText = header.AcctNo?.[0] || '';
        const accountFull = accountInfoText.split(' ')[0];

        if (accountFull.length <= 3) {
          throw new Error('Invalid account number in XML');
        }

        const currencyCode = accountFull.substring(accountFull.length - 3);
        const accountNumber = accountFull;

        console.log(`📊 Identified Account: ${accountNumber}`);
        console.log(`💱 Currency: ${currencyCode}\n`);

        // Find account UUID in database
        const supabase = getSupabaseClient();
        const { data: accountData, error: accountError } = await supabase
          .from('bank_accounts')
          .select('uuid, parsing_scheme_uuid')
          .eq('account', accountNumber)
          .single();

        if (accountError || !accountData) {
          throw new Error(`Account not found in database: ${accountNumber}`);
        }

        const accountUuid = accountData.uuid;
        console.log(`✅ Account UUID: ${accountUuid}\n`);

        // Determine raw table name (format: bog_gel_raw_XXXXXXXXXX)
        const accountDigits = accountNumber.replace(/\D/g, '').slice(-10);
        const rawTableName = `bog_gel_raw_${accountDigits}`;
        console.log(`📋 Raw Table: ${rawTableName}\n`);

        // Process the XML using TypeScript implementation
        await processBOGGEL(
          xmlContent,
          accountUuid,
          accountNumber,
          currencyCode,
          rawTableName,
          importBatchId
        );

        results.push({
          filename: file.name,
          success: true,
          accountNumber: accountNumber,
          rawTable: rawTableName,
        });

        console.log(`\n✅ Successfully processed ${file.name}`);
      } catch (error: any) {
        console.log(`\n✗ ERROR processing ${file.name}:`);
        console.log(error.message);
        if (error.stack) {
          console.log('\nStack trace:');
          console.log(error.stack);
        }

        results.push({
          filename: file.name,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // Restore original console.log
    console.log = originalLog;

    return NextResponse.json({
      success: failCount === 0,
      message: `Processed ${files.length} file(s): ${successCount} succeeded, ${failCount} failed`,
      results,
      logs: allLogs,
      importBatchId,
      detailedErrors: results.filter(r => !r.success).map(r => ({
        file: r.filename,
        error: r.error,
      })),
    });
  } catch (error: any) {
    // Restore original console.log
    console.log = originalLog;

    console.error("[Upload] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload files", logs: allLogs },
      { status: 500 }
    );
  }
}
