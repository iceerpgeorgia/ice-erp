import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { processBOGGELDeconsolidated } from "@/lib/bank-import/import_bank_xml_data_deconsolidated";
import { processTBCGEL } from "@/lib/bank-import/import_bank_xml_data";
import { getSupabaseClient } from "@/lib/bank-import/db-utils";

/**
 * Bank XML Upload API (Test) - Deconsolidated target table
 */
export async function POST(req: NextRequest) {
  const importBatchId = uuidv4();
  let allLogs = "";

  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: any[]) => {
    const message = args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
      .join(" ");
    allLogs += message + "\n";
    originalLog(...args);
  };
  console.error = (...args: any[]) => {
    const message = args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
      .join(" ");
    allLogs += message + "\n";
    originalError(...args);
  };

  try {
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const invalidFiles = files.filter((f) => !f.name.toLowerCase().endsWith(".xml"));
    if (invalidFiles.length > 0) {
      return NextResponse.json(
        { error: `Only XML files are accepted. Invalid files: ${invalidFiles.map((f) => f.name).join(", ")}` },
        { status: 400 }
      );
    }

    const results = [];
    console.log(`Processing ${files.length} file(s)...\n`);
    console.log(`Import Batch ID: ${importBatchId}\n`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileNum = i + 1;
      console.log("\n" + "=".repeat(60));
      console.log(`FILE ${fileNum}/${files.length}: ${file.name}`);
      console.log("=".repeat(60) + "\n");

      try {
        const xmlContent = await file.text();
        console.log(`✓ File read: ${file.name} (${xmlContent.length} bytes)\n`);

        const { parseStringPromise } = await import("xml2js");
        const parsed = await parseStringPromise(xmlContent, {
          tagNameProcessors: [(name) => name.replace(/^[^:]+:/, "")],
        });

        let root = parsed.AccountStatement || parsed.STATEMENT || parsed.ROWDATA || parsed;
        if (
          root &&
          typeof root === "object" &&
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
          console.log("⚠️ XML parsing failed. Root keys:", Object.keys(root || {}));
          console.log("⚠️ Parsed structure:", JSON.stringify(Object.keys(parsed), null, 2));
          throw new Error("Invalid XML format - missing HEADER/Head");
        }

        const isBog = Boolean(bogHeader);
        let currencyCode = "";
        let accountNumber = "";

        if (isBog) {
          const accountInfoText = bogHeader.AcctNo?.[0] || "";
          const accountFull = accountInfoText.split(" ")[0];
          if (accountFull.length <= 3) {
            throw new Error("Invalid account number in XML");
          }
          currencyCode = accountFull.substring(accountFull.length - 3).trim();
          accountNumber = accountFull.trim().toUpperCase();
        } else {
          const tbcAccountNo = tbcHead.AccountNo?.[0] || "";
          const tbcCurrency = tbcHead.Currency?.[0] || "";
          accountNumber = String(tbcAccountNo).trim().toUpperCase();
          currencyCode = String(tbcCurrency).trim().toUpperCase();
          if (!accountNumber || !currencyCode) {
            throw new Error("Invalid account number or currency in XML");
          }
        }
        console.log(`📊 Identified Account: ${accountNumber}`);
        console.log(`💱 Currency: ${currencyCode}\n`);

        const supabase = getSupabaseClient();
        const { data: currencyData } = await supabase
          .from("currencies")
          .select("uuid")
          .eq("code", currencyCode)
          .single();

        if (!currencyData) {
          throw new Error(`Currency not found in database: ${currencyCode}`);
        }

        const accountNumberNoCcy = isBog ? accountNumber.slice(0, -3) : accountNumber;

        const { data: accountDataExact, error: accountDataExactError } = await supabase
          .from("bank_accounts")
          .select("uuid, parsing_scheme_uuid, raw_table_name, account_number, currency_uuid")
          .eq("account_number", accountNumber)
          .eq("currency_uuid", currencyData.uuid)
          .maybeSingle();

        if (accountDataExactError) {
          throw accountDataExactError;
        }

        let accountData = accountDataExact;

        if (!accountData) {
          const { data: accountDataFallback, error: accountDataFallbackError } = await supabase
            .from("bank_accounts")
            .select("uuid, parsing_scheme_uuid, raw_table_name, account_number, currency_uuid")
            .eq("account_number", accountNumberNoCcy)
            .eq("currency_uuid", currencyData.uuid)
            .maybeSingle();

          if (accountDataFallbackError) {
            throw accountDataFallbackError;
          }

          accountData = isBog ? (accountDataFallback || null) : null;
        }

        if (!accountData) {
          throw new Error(
            `Account not found in database: ${accountNumber} (tried without currency: ${accountNumberNoCcy})`
          );
        }

        const accountUuid = accountData.uuid;
        console.log(`✅ Account UUID: ${accountUuid}\n`);

        if (isBog) {
          await processBOGGELDeconsolidated(
            xmlContent,
            accountUuid,
            accountData.account_number,
            currencyCode,
            importBatchId
          );
        } else {
          const accountDigits = accountData.account_number.replace(/\D/g, "").slice(-10);
          const rawTableName = accountData.raw_table_name || `tbc_gel_raw_${accountDigits}`;
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
        });

        console.log(`\n✅ Successfully processed ${file.name}`);
      } catch (error: any) {
        console.log(`\n✗ ERROR processing ${file.name}:`);
        console.log(error.message);
        console.error('✗ ERROR details:', {
          name: error?.name,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          status: error?.status,
          stack: error?.stack,
        });
        if (error.stack) {
          console.log("\nStack trace:");
          console.log(error.stack);
        }

        results.push({
          filename: file.name,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log = originalLog;
    console.error = originalError;

    return NextResponse.json({
      success: failCount === 0,
      message: `Processed ${files.length} file(s): ${successCount} succeeded, ${failCount} failed`,
      results,
      logs: allLogs,
      importBatchId,
      detailedErrors: results.filter((r) => !r.success).map((r: any) => ({
        file: r.filename,
        error: r.error,
      })),
    });
  } catch (error: any) {
    console.log = originalLog;
    console.error = originalError;
    console.error("[Upload Test] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload files", logs: allLogs },
      { status: 500 }
    );
  }
}
