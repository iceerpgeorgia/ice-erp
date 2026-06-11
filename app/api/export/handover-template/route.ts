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

    // Read template from public folder using filesystem
    let templateBuffer: Buffer;
    
    try {
      const templatePath = join(process.cwd(), 'public', 'handover template.xlsx');
      console.log('[Export Handover] Reading template from:', templatePath);
      
      templateBuffer = readFileSync(templatePath);
      console.log('[Export Handover] Template loaded, size:', templateBuffer.length);
    } catch (fileErr) {
      console.error('[Export Handover] Failed to load template file:', fileErr);
      return Response.json(
        { error: `Failed to load template: ${fileErr instanceof Error ? fileErr.message : 'Unknown error'}` },
        { status: 500 }
      );
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

    const placeholderData = {
      'B1': project.department || '', // Project_Department
      'B2': dateToExcelSerial(project.date), // Handover_Date
      'B3': counteragent?.entity_type || '', // Project_Counteragent_Entity_Type
      'B4': counteragent?.name || '', // Project_Counteragent_Name
      'B5': toGenitiveCase(counteragent?.director), // Project_Counteragent_Director_Genitive
      'B6': counteragent?.director || '', // Project_Counteragent_Director
      'B7': counteragent?.address_line_1 || '', // Project_Counteragent_Address_Line_1
      'B8': counteragent?.address_line_2 || '', // Project_Counteragent_Address_Line_2
      'B9': counteragent?.identification_number || '', // Project_Counteragent_ID
      'B10': project.address || '', // Project_Address
      'B11': insider?.entity_type || '', // Project_Insider_Entity_Type
      'B12': insider?.name || '', // Project_Insider_Name
      'B13': insider?.identification_number || '', // Project_Insider_ID
      'B14': insider?.address_line_1 || '', // Project_Insider_Address_Line1
      'B15': insider?.address_line_2 || '', // Project_Insider_Address_Line2
      'B16': toGenitiveCase(insider?.director), // Project_Insider_Director_Genitive
      'B17': insider?.director || '', // Project_Insider_Director_Normative
      'B18': dateToExcelSerial(project.date), // Contract_Date
      'B19': currency?.code || '', // Project_Currency
    };

    console.log('[Export Handover] Placeholder data prepared, updating via JSZip...');

    // Use JSZip to work with the Excel file directly
    const originalZip = new JSZip();
    await originalZip.loadAsync(templateBuffer);

    // Extract and modify the Placeholders sheet XML
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

    // B5 and B16 have genitive formulas - skip them (let them compute from B6 and B17)
    const SKIP_CELLS = ['B5', 'B16'];
    
    Object.entries(placeholderData).forEach(([cellRef, value]) => {
      if (SKIP_CELLS.includes(cellRef)) {
        console.log(`[Export Handover]   Skipping ${cellRef} (has genitive formula)`);
        return;
      }

      const escapedValue = String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      const isDateCell = cellRef === 'B2' || cellRef === 'B18';
      const cellType = isDateCell ? 'n' : 's';

      console.log(`[Export Handover]   Processing ${cellRef} = ${escapedValue}`);

      // Try to update or create the cell in the XML
      let updated = false;

      // Pattern 1: Cell has existing value <c r="B1" ...><v>old</v></c>
      const pattern1 = new RegExp(`(<c r="${cellRef}"[^>]*>.*?)<v>[^<]*</v>`, 's');
      if (pattern1.test(modifiedXml)) {
        modifiedXml = modifiedXml.replace(pattern1, `$1<v>${escapedValue}</v>`);
        console.log(`[Export Handover]     ✓ Updated existing value in ${cellRef}`);
        updated = true;
      }

      // Pattern 2: Empty cell <c r="B2" s="13"/>
      if (!updated) {
        const pattern2 = new RegExp(`<c r="${cellRef}"([^>]*?)\\s*/>`, 's');
        if (pattern2.test(modifiedXml)) {
          modifiedXml = modifiedXml.replace(
            pattern2,
            `<c r="${cellRef}"$1><v>${escapedValue}</v></c>`
          );
          console.log(`[Export Handover]     ✓ Converted empty cell ${cellRef}`);
          updated = true;
        }
      }

      // Pattern 3: Cell doesn't exist - create it in the appropriate row
      if (!updated && !modifiedXml.includes(`<c r="${cellRef}"`)) {
        const rowNum = parseInt(cellRef.match(/\d+/)?.[0] || '0');
        const rowOpenTag = new RegExp(`<row r="${rowNum}"([^>]*)>`, 's');
        
        if (rowOpenTag.test(modifiedXml)) {
          // Row exists, insert cell after row opening tag
          const newCell = `<c r="${cellRef}" t="${cellType}"><v>${escapedValue}</v></c>`;
          modifiedXml = modifiedXml.replace(
            rowOpenTag,
            `<row r="${rowNum}"$1>${newCell}`
          );
          console.log(`[Export Handover]     ✓ Created ${cellRef} in existing row`);
          updated = true;
        } else {
          // Row doesn't exist - create it
          const newRowCell = `<row r="${rowNum}" spans="1:5"><c r="${cellRef}" t="${cellType}"><v>${escapedValue}</v></c></row>`;
          if (modifiedXml.includes('</sheetData>')) {
            modifiedXml = modifiedXml.replace('</sheetData>', newRowCell + '</sheetData>');
            console.log(`[Export Handover]     ✓ Created row ${rowNum} with ${cellRef}`);
            updated = true;
          }
        }
      }

      if (!updated) {
        console.log(`[Export Handover]     ⚠ Could not update ${cellRef}`);
      }
    });

    console.log('[Export Handover] Updating sheet2.xml in ZIP...');

    // Update sheet2.xml in the original ZIP
    originalZip.file('xl/worksheets/sheet2.xml', modifiedXml);

    // ── Create jobs sheet if jobs exist ───────────────────────────────────────
    if (jobs.length > 0) {
      console.log('[Export Handover] Creating jobs sheet with', jobs.length, 'jobs...');
      
      // Create workbook to generate the jobs sheet
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
      
      // Get the jobs sheet XML (sheet1.xml from the newly generated workbook)
      const jobsSheetXml = await jobsZip.file('xl/worksheets/sheet1.xml')?.async('string');
      const jobsSheetRels = await jobsZip.file('xl/worksheets/_rels/sheet1.xml.rels')?.async('string');
      const jobsStyles = await jobsZip.file('xl/styles.xml')?.async('string');
      const jobsSharedStrings = await jobsZip.file('xl/sharedStrings.xml')?.async('string');
      
      if (jobsSheetXml) {
        // Find the highest sheet number in the template
        let maxSheetNum = 2;
        const sheetFiles = originalZip.folder('xl/worksheets')?.file(/.+\.xml$/);
        if (sheetFiles && sheetFiles.length > 0) {
          sheetFiles.forEach(file => {
            const match = file.name.match(/sheet(\d+)\.xml$/);
            if (match) {
              const num = parseInt(match[1]);
              if (num > maxSheetNum) maxSheetNum = num;
            }
          });
        }
        
        const newSheetNum = maxSheetNum + 1;
        
        // Add jobs sheet to ZIP
        originalZip.file(`xl/worksheets/sheet${newSheetNum}.xml`, jobsSheetXml);
        if (jobsSheetRels) {
          originalZip.file(`xl/worksheets/_rels/sheet${newSheetNum}.xml.rels`, jobsSheetRels);
        }
        
        // Update workbook.xml.rels to reference the new sheet
        let workbookRels = await originalZip.file('xl/_rels/workbook.xml.rels')?.async('string');
        if (workbookRels) {
          const newRelId = `rId${maxSheetNum + 2}`;
          const newRel = `<Relationship Id="${newRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${newSheetNum}.xml"/>`;
          
          // Insert before closing tag
          workbookRels = workbookRels.replace('</Relationships>', newRel + '</Relationships>');
          originalZip.file('xl/_rels/workbook.xml.rels', workbookRels);
        }
        
        // Update workbook.xml to add the sheet
        let workbookXml = await originalZip.file('xl/workbook.xml')?.async('string');
        if (workbookXml) {
          const newSheet = `<sheet name="Jobs" sheetId="${newSheetNum}" r:id="${newRelId}"/>`;
          workbookXml = workbookXml.replace('</sheets>', newSheet + '</sheets>');
          originalZip.file('xl/workbook.xml', workbookXml);
        }
        
        console.log('[Export Handover] Jobs sheet added as sheet', newSheetNum);
      }
    }

    console.log('[Export Handover] JSZip modifications complete, generating output...');

    // Generate the modified Excel file, preserving original structure and compression
    const outputBuffer = await originalZip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    console.log('[Export Handover] Export complete, file size:', outputBuffer.length);

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
