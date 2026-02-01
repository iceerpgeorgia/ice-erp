import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { processBOGGELDeconsolidated } from "@/lib/bank-import/import_bank_xml_data_deconsolidated";
import { getSupabaseClient } from "@/lib/bank-import/db-utils";

/**
 * Bank XML Upload API (Test) - Deconsolidated target table
 */
export async function POST(req: NextRequest) {
  const importBatchId = uuidv4();
  let allLogs = "";

  const originalLog = console.log;
  console.log = (...args: any[]) => {
    const message = args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
      .join(" ");
    allLogs += message + "\n";
    originalLog(...args);
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
        if (root && typeof root === "object" && !root.HEADER && !root.DETAILS && !root.DETAIL) {
          const keys = Object.keys(root);
          if (keys.length === 1) {
            root = root[keys[0]];
          }
        }

        const header = root?.HEADER?.[0];
        if (!header) {
          console.log("⚠️ XML parsing failed. Root keys:", Object.keys(root || {}));
          console.log("⚠️ Parsed structure:", JSON.stringify(Object.keys(parsed), null, 2));
          throw new Error("Invalid BOG GEL XML format - missing HEADER");
        }

        const accountInfoText = header.AcctNo?.[0] || "";
        const accountFull = accountInfoText.split(" ")[0];
        if (accountFull.length <= 3) {
          throw new Error("Invalid account number in XML");
        }

        const currencyCode = accountFull.substring(accountFull.length - 3);
        const accountNumber = accountFull.trim().toUpperCase();
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

        const accountNumberNoCcy = accountNumber.slice(0, -3);

        const { data: accountDataExact } = await supabase
          .from("bank_accounts")
          .select("uuid, parsing_scheme_uuid, raw_table_name, account_number, currency_uuid")
          .eq("account_number", accountNumber)
          .eq("currency_uuid", currencyData.uuid)
          .single();

        let accountData = accountDataExact;

        if (!accountData) {
          const { data: accountDataFallback } = await supabase
            .from("bank_accounts")
            .select("uuid, parsing_scheme_uuid, raw_table_name, account_number, currency_uuid")
            .eq("account_number", accountNumberNoCcy)
            .eq("currency_uuid", currencyData.uuid)
            .single();

          accountData = accountDataFallback || null;
        }

        if (!accountData) {
          throw new Error(
            `Account not found in database: ${accountNumber} (tried without currency: ${accountNumberNoCcy})`
          );
        }

        const accountUuid = accountData.uuid;
        console.log(`✅ Account UUID: ${accountUuid}\n`);

        await processBOGGELDeconsolidated(
          xmlContent,
          accountUuid,
          accountData.account_number,
          currencyCode,
          importBatchId
        );

        results.push({
          filename: file.name,
          success: true,
          accountNumber: accountNumber,
        });

        console.log(`\n✅ Successfully processed ${file.name}`);
      } catch (error: any) {
        console.log(`\n✗ ERROR processing ${file.name}:`);
        console.log(error.message);
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
    console.error("[Upload Test] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload files", logs: allLogs },
      { status: 500 }
    );
  }
}
