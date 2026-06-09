import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { PrismaClient } from '@prisma/client';
import { toGenitiveCase } from '@/lib/georgian-genitive';

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

    // Fetch template from public folder
    let templateBuffer: Buffer;
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    const templateUrl = `${protocol}://${host}/handover%20template.xlsx`;

    console.log('[Export Handover] Fetching template from:', templateUrl);

    try {
      const fetchRes = await fetch(templateUrl, { cache: 'no-store' });
      if (!fetchRes.ok) {
        console.error(`[Export Handover] Failed to fetch template: ${fetchRes.status} ${fetchRes.statusText}`);
        return Response.json(
          { error: `Template fetch failed (${fetchRes.status})` },
          { status: 404 }
        );
      }
      templateBuffer = Buffer.from(await fetchRes.arrayBuffer());
      console.log('[Export Handover] Template fetched, size:', templateBuffer.length);
    } catch (fetchErr) {
      console.error('[Export Handover] Template fetch error:', fetchErr);
      return Response.json(
        { error: `Failed to fetch template: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown error'}` },
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

    // Query jobs for the project with brands
    const jobs = await prisma.jobs.findMany({
      where: { 
        project_uuid: projectUuid,
        is_active: true
      },
      include: {
        brands: true,
      },
      orderBy: { created_at: 'asc' }
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
    const placeholdersXmlMaybe = await originalZip.file('xl/worksheets/sheet2.xml')?.async('string');
    if (!placeholdersXmlMaybe) {
      console.error('[Export Handover] ERROR: Placeholders sheet (sheet2.xml) not found!');
      return Response.json(
        { error: 'Placeholders sheet not found in template' },
        { status: 500 }
      );
    }

    // TypeScript type assertion: we've confirmed it's not undefined
    let placeholdersXml: string = placeholdersXmlMaybe;
    console.log('[Export Handover] Placeholders XML loaded, size:', placeholdersXml.length);

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
      if (pattern1.test(placeholdersXml)) {
        placeholdersXml = placeholdersXml.replace(pattern1, `$1<v>${escapedValue}</v>`);
        console.log(`[Export Handover]     ✓ Updated existing value in ${cellRef}`);
        updated = true;
      }

      // Pattern 2: Empty cell <c r="B2" s="13"/>
      if (!updated) {
        const pattern2 = new RegExp(`<c r="${cellRef}"([^>]*?)\\s*/>`, 's');
        if (pattern2.test(placeholdersXml)) {
          placeholdersXml = placeholdersXml.replace(
            pattern2,
            `<c r="${cellRef}"$1><v>${escapedValue}</v></c>`
          );
          console.log(`[Export Handover]     ✓ Converted empty cell ${cellRef}`);
          updated = true;
        }
      }

      // Pattern 3: Cell doesn't exist - create it in the appropriate row
      if (!updated && !placeholdersXml.includes(`<c r="${cellRef}"`)) {
        const rowNum = parseInt(cellRef.match(/\d+/)?.[0] || '0');
        const rowOpenTag = new RegExp(`<row r="${rowNum}"([^>]*)>`, 's');
        
        if (rowOpenTag.test(placeholdersXml)) {
          // Row exists, insert cell after row opening tag
          const newCell = `<c r="${cellRef}" t="${cellType}"><v>${escapedValue}</v></c>`;
          placeholdersXml = placeholdersXml.replace(
            rowOpenTag,
            `<row r="${rowNum}"$1>${newCell}`
          );
          console.log(`[Export Handover]     ✓ Created ${cellRef} in existing row`);
          updated = true;
        } else {
          // Row doesn't exist - create it
          const newRowCell = `<row r="${rowNum}" spans="1:5"><c r="${cellRef}" t="${cellType}"><v>${escapedValue}</v></c></row>`;
          if (placeholdersXml.includes('</sheetData>')) {
            placeholdersXml = placeholdersXml.replace('</sheetData>', newRowCell + '</sheetData>');
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
    originalZip.file('xl/worksheets/sheet2.xml', placeholdersXml);

    // Populate Jobs sheet (sheet1.xml) if jobs exist
    if (jobs.length > 0) {
      console.log('[Export Handover] Populating Jobs sheet with', jobs.length, 'job(s)...');
      
      // Try to get sheet1.xml - this is typically the first data sheet (could be Jobs, Handover, or main sheet)
      const jobsSheetFile = originalZip.file('xl/worksheets/sheet1.xml');
      if (jobsSheetFile) {
        let jobsXml = await jobsSheetFile.async('string');
        console.log('[Export Handover]   Jobs sheet XML loaded, size:', jobsXml.length);

        // Process each job and add/update rows starting from row 2
        jobs.forEach((job, idx) => {
          const rowNum = idx + 2;
          const jobName = job.job_name || '';
          const factoryNo = job.factory_no || '';
          const brandName = job.brands?.name || '';
          const floors = job.floors || '';

          console.log(`[Export Handover]   Adding job row ${rowNum}: ${jobName} | ${brandName}`);

          // Create cells for the row: A=jobName, B=factoryNo, C=brandName, D=floors
          const cells = [
            { col: 'A', val: jobName, type: 's' },
            { col: 'B', val: factoryNo, type: 's' },
            { col: 'C', val: brandName, type: 's' },
            { col: 'D', val: floors ? String(floors) : '', type: floors ? 'n' : 's' },
          ];

          // Try to update or create cells in the row
          let rowExists = jobsXml.includes(`<row r="${rowNum}"`);

          if (rowExists) {
            // Row exists, update cells
            cells.forEach(({ col, val, type }) => {
              const cellRef = `${col}${rowNum}`;
              const escapedVal = String(val)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

              const cellPattern = new RegExp(`(<c r="${cellRef}"[^>]*>.*?)<v>[^<]*</v>`, 's');
              if (cellPattern.test(jobsXml)) {
                jobsXml = jobsXml.replace(cellPattern, `$1<v>${escapedVal}</v>`);
              } else {
                // Cell doesn't exist in the row, try creating it
                const emptyPattern = new RegExp(`(<c r="${cellRef}"[^>]*?)\\s*/>`, 's');
                if (emptyPattern.test(jobsXml)) {
                  jobsXml = jobsXml.replace(emptyPattern, `$1><v>${escapedVal}</v></c>`);
                }
              }
            });
          } else {
            // Row doesn't exist, create new row with cells
            const cellsXml = cells.map(({ col, val, type }) => {
              const cellRef = `${col}${rowNum}`;
              const escapedVal = String(val)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
              return `<c r="${cellRef}" t="${type}"><v>${escapedVal}</v></c>`;
            }).join('');

            const newRow = `<row r="${rowNum}" spans="1:4">${cellsXml}</row>`;
            if (jobsXml.includes('</sheetData>')) {
              jobsXml = jobsXml.replace('</sheetData>', newRow + '</sheetData>');
            }
          }
        });

        // Update the sheet dimensions
        const lastRow = jobs.length + 1;
        const dimensionPattern = /<dimension ref="([^"]+)"/;
        if (dimensionPattern.test(jobsXml)) {
          jobsXml = jobsXml.replace(dimensionPattern, `<dimension ref="A1:D${lastRow}"`);
        }

        originalZip.file('xl/worksheets/sheet1.xml', jobsXml);
        console.log('[Export Handover] Jobs sheet updated');
      } else {
        console.log('[Export Handover] ⚠ Jobs sheet (sheet1.xml) not found in template');
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
