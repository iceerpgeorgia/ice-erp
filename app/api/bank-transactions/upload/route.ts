import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { processBOGGELDeconsolidated } from "@/lib/bank-import/import_bank_xml_data_deconsolidated";
import { processTBCGEL } from "@/lib/bank-import/import_bank_xml_data";
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
        const parsed = await parseStringPromise(xmlContent, {
          tagNameProcessors: [
            // Remove namespace prefixes (gemini:AccountStatement -> AccountStatement)
            (name) => name.replace(/^[^:]+:/, '')
          ]
        });
        
        // BOG GEL and TBC GEL XML can have different root elements
        let root = parsed.AccountStatement || parsed.STATEMENT || parsed.ROWDATA || parsed;
        
        // Handle xml2js wrapping
        if (
          root &&
          typeof root === 'object' &&
          !root.HEADER &&
          !root.DETAILS &&
          !root.DETAIL &&
          !root.Head &&
          !root.Record &&
          !root.Records
        ) {
          const keys = Object.keys(root);
          if (keys.length === 1) {
            root = root[keys[0]];
          }
        }

        const bogHeader = root?.HEADER?.[0];
        const tbcHead = root?.Head?.[0];

        if (!bogHeader && !tbcHead) {
          console.log('⚠️ XML parsing failed. Root keys:', Object.keys(root || {}));
          console.log('⚠️ Parsed structure:', JSON.stringify(Object.keys(parsed), null, 2));
          throw new Error('Invalid XML format - missing HEADER/Head');
        }

        const isBog = Boolean(bogHeader);

        let currencyCode = '';
        let accountNumber = '';

        if (isBog) {
          const accountInfoText = bogHeader.AcctNo?.[0] || '';
          const accountFull = accountInfoText.split(' ')[0];

          if (accountFull.length <= 3) {
            throw new Error('Invalid account number in XML');
          }

          currencyCode = accountFull.substring(accountFull.length - 3).trim();
          accountNumber = accountFull.trim().toUpperCase();
        } else {
          const tbcAccountNo = tbcHead.AccountNo?.[0] || '';
          const tbcCurrency = tbcHead.Currency?.[0] || '';

          accountNumber = String(tbcAccountNo).trim().toUpperCase();
          currencyCode = String(tbcCurrency).trim().toUpperCase();

          if (!accountNumber || !currencyCode) {
            throw new Error('Invalid account number or currency in XML');
          }
        }

        console.log(`📊 Identified Account: ${accountNumber}`);
        console.log(`💱 Currency: ${currencyCode}\n`);

        // Find account UUID in database (account_number + currency)
        const supabase = getSupabaseClient();
        const { data: currencyData } = await supabase
          .from('currencies')
          .select('uuid')
          .eq('code', currencyCode)
          .single();

        if (!currencyData) {
          throw new Error(`Currency not found in database: ${currencyCode}`);
        }

        const accountNumberNoCcy = isBog ? accountNumber.slice(0, -3) : accountNumber;

        const { data: accountDataExact, error: accountDataExactError } = await supabase
          .from('bank_accounts')
          .select('uuid, parsing_scheme_uuid, raw_table_name, account_number, currency_uuid')
          .eq('account_number', accountNumber)
          .eq('currency_uuid', currencyData.uuid)
          .maybeSingle();

        if (accountDataExactError) {
          throw accountDataExactError;
        }

        let accountData = accountDataExact;

        if (!accountData && isBog) {
          const { data: accountDataFallback, error: accountDataFallbackError } = await supabase
            .from('bank_accounts')
            .select('uuid, parsing_scheme_uuid, raw_table_name, account_number, currency_uuid')
            .eq('account_number', accountNumberNoCcy)
            .eq('currency_uuid', currencyData.uuid)
            .maybeSingle();

          if (accountDataFallbackError) {
            throw accountDataFallbackError;
          }

          accountData = accountDataFallback || null;
        }

        if (!accountData) {
          throw new Error(
            `Account not found in database: ${accountNumber} (tried without currency: ${accountNumberNoCcy})`
          );
        }

        const accountUuid = accountData.uuid;
        console.log(`✅ Account UUID: ${accountUuid}\n`);

        // Determine raw table name (prefer stored mapping)
        if (isBog) {
          console.log(`📋 Deconsolidated Table: ${accountData.account_number}_BOG_${currencyCode}\n`);
          await processBOGGELDeconsolidated(
            xmlContent,
            accountUuid,
            accountData.account_number,
            currencyCode,
            importBatchId
          );
        } else {
          const accountDigits = accountData.account_number.replace(/\D/g, '').slice(-10);
          const rawTableName = accountData.raw_table_name || `tbc_gel_raw_${accountDigits}`;
          console.log(`📋 Raw Table: ${rawTableName}\n`);
          await processTBCGEL(
            xmlContent,
            accountUuid,
            accountData.account_number,
            currencyCode,
            rawTableName,
            importBatchId
          );
        }

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
