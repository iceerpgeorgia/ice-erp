import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { PrismaClient } from '@prisma/client';
import { toGenitiveCase } from '@/lib/georgian-genitive';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

/**
 * POST /api/export/handover-template
 * Uses JSZip to preserve Handover sheet formulas exactly as-is.
 * Only updates Placeholders sheet values via XML manipulation.
 * 
 * Required body fields:
 * - fileName: output filename
 * - projectUuid: project UUID to load data for
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, projectUuid } = body;

    if (!fileName || !projectUuid) {
      return Response.json(
        { error: 'Missing required fields: fileName, projectUuid' },
        { status: 400 }
      );
    }

    console.log('[Export Handover] Starting export with JSZip approach for project:', projectUuid);

    // Try to fetch template from database attachments first (preferred), then fall back to file system
    let templateBuffer: Buffer | null = null;
    let templateSource = 'none';
    
    // Step 1: Try to fetch active handover template from templates table
    try {
      console.log('[Export Handover] Attempting to load template from templates table...');
      
      const activeTemplate = await prisma.templates.findFirst({
        where: {
          operation_type: 'handover',
          is_active: true,
        },
      });

      if (activeTemplate) {
        console.log('[Export Handover] Found active template:', activeTemplate.file_name);
        console.log('[Export Handover] Template storage_path:', activeTemplate.storage_path);
        console.log('[Export Handover] Template UUID:', activeTemplate.uuid);
        
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (supabaseUrl && supabaseKey) {
            // storage_path already includes bucket name (e.g., "templates/handover/...")
            // Use public endpoint for fetching (no auth needed for public buckets)
            // URL encode the path to handle spaces and special characters
            const encodedPath = activeTemplate.storage_path
              .split('/')
              .map(part => encodeURIComponent(part))
              .join('/');
            const fileUrl = `${supabaseUrl}/storage/v1/object/public/${encodedPath}`;

            console.log('[Export Handover] Fetching template from Supabase storage (public)...');
            console.log('[Export Handover] Encoded URL:', fileUrl);

            const fetchRes = await fetch(fileUrl, {
              cache: 'no-store',
            });

            console.log('[Export Handover] Supabase fetch response status:', fetchRes.status, fetchRes.statusText);

            if (fetchRes.ok) {
              templateBuffer = Buffer.from(await fetchRes.arrayBuffer());
              templateSource = 'templates-table';
              console.log('[Export Handover] ✓ SUCCESS: Template loaded from Supabase, file size:', templateBuffer.length, 'bytes');
            } else {
              const errorText = await fetchRes.text();
              console.warn('[Export Handover] ✗ FAILED: Supabase fetch returned', fetchRes.status, '-', errorText.substring(0, 200));
              console.warn('[Export Handover] Will fall back to file system template');
            }
          } else {
            console.warn('[Export Handover] Supabase credentials not configured - will use file system fallback');
          }
        } catch (dbErr) {
          console.error('[Export Handover] ✗ FAILED: Supabase fetch error:', dbErr);
          console.warn('[Export Handover] Will fall back to file system template');
        }
      } else {
        console.log('[Export Handover] No active template found in templates table, will use file system fallback');
      }
    } catch (dbErr) {
      console.warn('[Export Handover] Templates query failed:', dbErr, '- will use file system fallback');
    }

    // Step 2: Fallback to file system if database retrieval failed
    if (templateSource === 'none') {
      try {
        const templatePath = join(process.cwd(), 'public', 'Handover Tamplate New.xlsx');
        console.log('[Export Handover] ⚠ FALLBACK: Reading template from file system:', templatePath);
        
        templateBuffer = readFileSync(templatePath);
        templateSource = 'filesystem';
        console.log('[Export Handover] ✓ Template loaded from FILE SYSTEM, file size:', templateBuffer.length, 'bytes');
        console.log('[Export Handover] ⚠ NOTE: File system template may not have latest formulas - consider uploading to Supabase via Admin > Templates');
      } catch (fileErr) {
        console.error('[Export Handover] Failed to load template from both Supabase and file system:', fileErr);
        return Response.json(
          { error: `Handover template not found. Please upload a template via Admin > Templates or ensure Handover Tamplate New.xlsx exists in public folder.` },
          { status: 500 }
        );
      }
    }

    // Query project and all related data
    console.log('[Export Handover] Querying database for project:', projectUuid);

    const project = await prisma.projects.findUnique({
      where: { project_uuid: projectUuid },
    });

    if (!project) {
      console.error('[Export Handover] Project not found:', projectUuid);
      return Response.json(
        { error: `Project not found: ${projectUuid}` },
        { status: 404 }
      );
    }

    // Query counteragent (supplier/contractor)
    const counteragent = await prisma.counteragents.findUnique({
      where: { counteragent_uuid: project.counteragent_uuid },
    });

    // Query insider (our company)
    const insider = await prisma.counteragents.findUnique({
      where: { counteragent_uuid: project.insider_uuid },
    });

    // Query currency
    const currency = await prisma.currencies.findUnique({
      where: { uuid: project.currency_uuid },
    });

    // Query jobs for this project via job_projects junction table
    const jobProjectLinks = await prisma.job_projects.findMany({
      where: { project_uuid: projectUuid },
      select: { job_uuid: true },
    });

    const jobUuids = jobProjectLinks.map((jp) => jp.job_uuid);

    const jobs = await prisma.jobs.findMany({
      where: { job_uuid: { in: jobUuids } },
      select: {
        job_uuid: true,
        job_name: true,
        factory_no: true,
        floors: true,
        weight: true,
        selling_price: true,
        is_ff: true,
        brands: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log('[Export Handover] Data loaded - project:', project.project_name, 'counteragent:', counteragent?.name, 'insider:', insider?.name, 'jobs:', jobs.length);

    // Convert date to Excel serial
    const dateToExcelSerial = (date: Date | string | null): number => {
      if (!date) return 0;
      const d = typeof date === 'string' ? new Date(date) : date;
      return Math.floor((d.getTime() - new Date(1900, 0, 1).getTime()) / (24 * 60 * 60 * 1000)) + 2;
    };

    // Build VLOOKUP lookup table: Column A = labels, Column B = values
    // VLOOKUP formulas in Handover sheet reference: VLOOKUP("Label_Name", Placeholders!A:B, 2, FALSE)
    const placeholderData = {
      // Row 1: Project_Department
      'A1': 'Project_Department',
      'B1': project.department || '',
      // Row 2: Handover_Date
      'A2': 'Handover_Date',
      'B2': dateToExcelSerial(project.date),
      // Row 3: Project_Counteragent_Entity_Type
      'A3': 'Project_Counteragent_Entity_Type',
      'B3': counteragent?.entity_type || '',
      // Row 4: Project_Counteragent_Name
      'A4': 'Project_Counteragent_Name',
      'B4': counteragent?.name || '',
      // Row 5: Project_Counteragent_Director_Genitive
      'A5': 'Project_Counteragent_Director_Genitive',
      'B5': toGenitiveCase(counteragent?.director),
      // Row 6: Project_Counteragent_Director
      'A6': 'Project_Counteragent_Director',
      'B6': counteragent?.director || '',
      // Row 7: Project_Counteragent_Address_Line_1
      'A7': 'Project_Counteragent_Address_Line_1',
      'B7': counteragent?.address_line_1 || '',
      // Row 8: Project_Counteragent_Address_Line_2
      'A8': 'Project_Counteragent_Address_Line_2',
      'B8': counteragent?.address_line_2 || '',
      // Row 9: Project_Counteragent_ID
      'A9': 'Project_Counteragent_ID',
      'B9': counteragent?.identification_number || '',
      // Row 10: Project_Address
      'A10': 'Project_Address',
      'B10': project.address || '',
      // Row 11: Project_Insider_Entity_Type
      'A11': 'Project_Insider_Entity_Type',
      'B11': insider?.entity_type || '',
      // Row 12: Project_Insider_Name
      'A12': 'Project_Insider_Name',
      'B12': insider?.name || '',
      // Row 13: Project_Insider_ID
      'A13': 'Project_Insider_ID',
      'B13': insider?.identification_number || '',
      // Row 14: Project_Insider_Address_Line1
      'A14': 'Project_Insider_Address_Line1',
      'B14': insider?.address_line_1 || '',
      // Row 15: Project_Insider_Address_Line2
      'A15': 'Project_Insider_Address_Line2',
      'B15': insider?.address_line_2 || '',
      // Row 16: Project_Insider_Director_Genitive
      'A16': 'Project_Insider_Director_Genitive',
      'B16': toGenitiveCase(insider?.director),
      // Row 17: Project_Insider_Director
      'A17': 'Project_Insider_Director',
      'B17': insider?.director || '',
      // Row 18: Contract_Date
      'A18': 'Contract_Date',
      'B18': dateToExcelSerial(project.date),
      // Row 19: Project_Currency
      'A19': 'Project_Currency',
      'B19': currency?.code || '',
    };

    console.log('[Export Handover] Placeholder data prepared (with VLOOKUP labels in A, values in B), updating via JSZip...');

    // Verify template was loaded
    if (!templateBuffer || templateBuffer.length === 0) {
      console.error('[Export Handover] ERROR: Template buffer is empty or undefined');
      return Response.json(
        { error: 'Failed to load template - buffer is empty' },
        { status: 500 }
      );
    }

    // Use JSZip to work with the Excel file directly
    const originalZip = new JSZip();
    await originalZip.loadAsync(templateBuffer);

    console.log('[Export Handover] Template loaded into JSZip, analyzing structure...');
    console.log('[Export Handover] Template source:', templateSource);

    // Verify template sheet structure
    const sheetFiles = originalZip.folder('xl/worksheets')?.file(/.+\.xml$/);
    const sheetFilesList = (sheetFiles || []).map(f => f.name);
    console.log('[Export Handover] Template sheets found:', sheetFilesList);
    console.log('[Export Handover] Number of sheets:', sheetFilesList.length);

    // NOTE: We do NOT manipulate sheet1.xml (Handover sheet) at all.
    // The formulas in it will recalculate automatically when Excel opens the file
    // because we're changing the Placeholders sheet data it references.
    // No cached value clearing is needed - Excel handles this automatically.

    console.log('[Export Handover] Skipping sheet1.xml manipulation (formulas will auto-recalculate)');

    // Extract and modify the Placeholders sheet XML (sheet2.xml in new template)
    let placeholdersXml = await originalZip.file('xl/worksheets/sheet2.xml')?.async('string');
    if (!placeholdersXml) {
      console.error('[Export Handover] ERROR: Placeholders sheet (sheet2.xml) not found!');
      return Response.json(
        { error: 'Placeholders sheet not found in template' },
        { status: 500 }
      );
    }

    // At this point, TypeScript knows placeholdersXml is a string (after null check)
    // Redefine as const string to enforce type safety in the loop
    const initialXml: string = placeholdersXml;
    let modifiedXml: string = initialXml;

    console.log('[Export Handover] Placeholders XML loaded, size:', modifiedXml.length);

    // Update placeholder cells with proper Excel formatting
    Object.entries(placeholderData).forEach(([cellRef, value]) => {
      const stringValue = String(value);
      
      // Date cells (B2, B18) use number type, others use inlineStr
      const isDateCell = cellRef === 'B2' || cellRef === 'B18';
      
      // Escape XML for text content
      const escapedValue = stringValue
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      console.log(`[Export Handover]   Processing ${cellRef} = ${escapedValue.substring(0, 50)}`);

      let cellContent: string;
      if (isDateCell) {
        // Number cell: <c r="B2" t="n"><v>44719</v></c>
        cellContent = `<c r="${cellRef}" t="n"><v>${escapedValue}</v></c>`;
      } else {
        // Inline string cell: <c r="B1"><is><t>value</t></is></c>
        // Note: removed t="s" and use inlineStr format instead
        cellContent = `<c r="${cellRef}"><is><t>${escapedValue}</t></is></c>`;
      }

      let updated = false;

      // Pattern 2a: Replace self-closing empty cell FIRST - e.g., <c r="B1"/>
      // (Must check this before Pattern 1 to avoid cross-row matching with .*?</c>)
      const emptyPattern = new RegExp(`<c r="${cellRef}"[^>]*/>`);
      if (emptyPattern.test(modifiedXml)) {
        modifiedXml = modifiedXml.replace(emptyPattern, cellContent);
        console.log(`[Export Handover]     ✓ Replaced empty self-closing cell ${cellRef}`);
        updated = true;
      }

      // Pattern 1: Replace existing cell with any content (including nested <v>, <is>, etc.)
      // Match from <c r="X"> to first </c>, handling any child elements
      // Use [\s\S]*? to match any character including newlines, minimal
      // But add a check to not cross row boundaries
      if (!updated) {
        const cellPattern = new RegExp(`<c r="${cellRef}"[^>]*>[\\s\\S]*?</c>`);
        const match = cellPattern.exec(modifiedXml);
        if (match) {
          // Check if match contains </row> (crossing boundary)
          if (!match[0].includes('</row>')) {
            modifiedXml = modifiedXml.replace(cellPattern, cellContent);
            console.log(`[Export Handover]     ✓ Replaced existing cell ${cellRef}`);
            updated = true;
          }
        }
      }

      // Pattern 3: Insert in existing row if cell doesn't exist
      if (!updated && !modifiedXml.includes(`<c r="${cellRef}"`)) {
        const rowNum = parseInt(cellRef.match(/\d+/)?.[0] || '0');
        const rowPattern = new RegExp(`(<row r="${rowNum}"[^>]*>)`);
        
        if (rowPattern.test(modifiedXml)) {
          modifiedXml = modifiedXml.replace(
            rowPattern,
            `$1${cellContent}`
          );
          console.log(`[Export Handover]     ✓ Inserted ${cellRef} into existing row ${rowNum}`);
          updated = true;
        }
      }

      if (!updated) {
        console.log(`[Export Handover]     ⚠ WARNING: Could not update ${cellRef}`);
      }
    });

    console.log('[Export Handover] Updating sheet2.xml in ZIP...');

    // Update sheet2.xml in the original ZIP
    originalZip.file('xl/worksheets/sheet2.xml', modifiedXml);

    // ── Create/Update jobs sheet ───────────────────────────────────────────
    if (jobs.length > 0) {
      console.log('[Export Handover] Processing jobs sheet with', jobs.length, 'jobs...');
      
      // Check if Jobs sheet already exists in template
      let jobsSheetNum: number | null = null;
      const sheetFilesArray = Array.from(originalZip.folder('xl/worksheets')?.file(/.+\.xml$/) || []);
      
      for (const file of sheetFilesArray) {
        if (file.name.includes('Jobs') || file.name === 'xl/worksheets/sheet3.xml') {
          const match = file.name.match(/sheet(\d+)\.xml$/);
          if (match) {
            jobsSheetNum = parseInt(match[1]);
            console.log('[Export Handover] Found existing Jobs sheet at sheet', jobsSheetNum);
            break;
          }
        }
      }

      // Create/update jobs sheet
      const jobsWorkbook = XLSX.utils.book_new();
      
      // Transform jobs to sheet format
      const jobsData = jobs.map(job => ({
        'Job Name': job.job_name || '',
        'Factory No': job.factory_no || '',
        'Brand Name': job.brands?.name || '',
        'Floors': job.floors ?? '',
        'Weight (kg)': job.weight ?? '',
        'Selling Price': job.selling_price ?? 0,
        'Type': job.is_ff ? 'FF' : 'NOT FF',
      }));
      
      const jobsSheet = XLSX.utils.json_to_sheet(jobsData);
      XLSX.utils.book_append_sheet(jobsWorkbook, jobsSheet, 'Jobs');
      
      // Generate jobs workbook as buffer
      const jobsBuffer = XLSX.write(jobsWorkbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Load jobs workbook to extract sheet
      const jobsZip = new JSZip();
      await jobsZip.loadAsync(jobsBuffer);
      
      // Get the jobs sheet XML
      const jobsSheetXml = await jobsZip.file('xl/worksheets/sheet1.xml')?.async('string');
      const jobsSheetRels = await jobsZip.file('xl/worksheets/_rels/sheet1.xml.rels')?.async('string');
      
      if (jobsSheetXml) {
        if (jobsSheetNum === null) {
          // Jobs sheet doesn't exist in template - find next available sheet number
          let maxSheetNum = 2;
          for (const file of sheetFilesArray) {
            const match = file.name.match(/sheet(\d+)\.xml$/);
            if (match) {
              const num = parseInt(match[1]);
              if (num > maxSheetNum) maxSheetNum = num;
            }
          }
          
          jobsSheetNum = maxSheetNum + 1;
          console.log('[Export Handover] Creating new Jobs sheet at sheet', jobsSheetNum);
        } else {
          console.log('[Export Handover] Updating existing Jobs sheet');
        }
        
        const newRelId = `rId${jobsSheetNum + 1}`;
        
        // Add/replace jobs sheet in ZIP
        originalZip.file(`xl/worksheets/sheet${jobsSheetNum}.xml`, jobsSheetXml);
        if (jobsSheetRels) {
          originalZip.file(`xl/worksheets/_rels/sheet${jobsSheetNum}.xml.rels`, jobsSheetRels);
        }
        
        // Update workbook.xml.rels if needed (only for new sheets)
        let workbookRels = await originalZip.file('xl/_rels/workbook.xml.rels')?.async('string');
        if (workbookRels) {
          // Check if rel already exists
          if (!workbookRels.includes(`worksheets/sheet${jobsSheetNum}.xml`)) {
            const newRel = `<Relationship Id="${newRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${jobsSheetNum}.xml"/>`;
            workbookRels = workbookRels.replace('</Relationships>', newRel + '</Relationships>');
            originalZip.file('xl/_rels/workbook.xml.rels', workbookRels);
            console.log('[Export Handover] Added relationship for sheet', jobsSheetNum);
          }
        }
        
        // Update workbook.xml if needed
        let workbookXml = await originalZip.file('xl/workbook.xml')?.async('string');
        if (workbookXml) {
          // Check if sheet entry already exists
          if (!workbookXml.includes(`sheet${jobsSheetNum}`)) {
            const newSheet = `<sheet name="Jobs" sheetId="${jobsSheetNum}" r:id="${newRelId}"/>`;
            workbookXml = workbookXml.replace('</sheets>', newSheet + '</sheets>');
            originalZip.file('xl/workbook.xml', workbookXml);
            console.log('[Export Handover] Added Jobs sheet reference to workbook');
          }
        }
        
        console.log('[Export Handover] Jobs sheet processed - sheet', jobsSheetNum);
      }
    }

    console.log('[Export Handover] All modifications complete, verifying final structure...');

    // Verify final sheet structure - CRITICAL: sheet1.xml must still be there
    const finalSheetFiles = originalZip.folder('xl/worksheets')?.file(/.+\.xml$/);
    const finalSheetsList = (finalSheetFiles || []).map(f => f.name);
    console.log('[Export Handover] Final sheets in export:', finalSheetsList);
    
    // Verify sheet1.xml is still present
    const finalHandoverXml = await originalZip.file('xl/worksheets/sheet1.xml')?.async('string');
    if (!finalHandoverXml) {
      console.error('[Export Handover] ✗ CRITICAL ERROR: Handover sheet disappeared during processing!');
      return Response.json(
        { error: 'ERROR: Handover sheet was lost during export processing' },
        { status: 500 }
      );
    }
    console.log('[Export Handover] ✓ Handover sheet confirmed present in final output, size:', finalHandoverXml.length, 'bytes');

    // Generate the modified Excel file, preserving original structure and compression
    const outputBuffer = await originalZip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    console.log('[Export Handover] ✓ Export complete, final file size:', outputBuffer.length, 'bytes');
    console.log('[Export Handover] SUMMARY: Template source =', templateSource, '| Final sheets =', finalSheetsList.length);

    return new Response(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Content-Length': outputBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Export Handover] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
