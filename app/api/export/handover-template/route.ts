import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { prisma, withRetry } from '@/lib/prisma';
import { toGenitiveCase } from '@/lib/georgian-genitive';

// Utility to escape XML special characters
function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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

    // Fetch template from database attachment, with fallback to public folder
    let templateBuffer: Buffer | null = null;

    // Try to fetch from database first (with retry for pool exhaustion)
    const templateAttachment = await withRetry(() =>
      prisma.attachments.findFirst({
        where: {
          file_name: {
            contains: 'handover',
          },
          is_active: true,
          storage_provider: 'supabase',
        },
        orderBy: { created_at: 'desc' },
      })
    );

    console.log('[Export Handover] Template attachment lookup:', templateAttachment ? 'found' : 'not found');

    if (templateAttachment) {
      // Fetch from Supabase storage
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Missing Supabase configuration');
        }

        const bucket = templateAttachment.storage_bucket || 'attachments';
        const fileUrl = `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${templateAttachment.storage_path}`;

        console.log('[Export Handover] Fetching template from Supabase:', fileUrl.replace(/Bearer.*/, 'Bearer [hidden]'));

        const fetchRes = await fetch(fileUrl, {
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
          },
          cache: 'no-store',
        });

        if (fetchRes.ok) {
          templateBuffer = Buffer.from(await fetchRes.arrayBuffer());
          console.log('[Export Handover] Template fetched from Supabase, size:', templateBuffer.length);
        } else {
          console.warn(`[Export Handover] Supabase fetch failed (${fetchRes.status}), falling back to public folder`);
        }
      } catch (err) {
        console.warn('[Export Handover] Supabase fetch error, falling back to public folder:', err);
      }
    }

    // Fallback: fetch from public folder if not found in database or Supabase failed
    if (!templateBuffer) {
      console.log('[Export Handover] Falling back to template from public folder');
      const host = req.headers.get('host') || 'localhost:3000';
      const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
      const templateUrl = `${protocol}://${host}/handover%20template.xlsx`;

      console.log('[Export Handover] Fetching from:', templateUrl);

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
        console.log('[Export Handover] Template fetched from public folder, size:', templateBuffer.length);
      } catch (fetchErr) {
        console.error('[Export Handover] Template fetch error:', fetchErr);
        return Response.json(
          { error: `Failed to fetch template: ${fetchErr instanceof Error ? fetchErr.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
    }

    if (!templateBuffer) {
      console.error('[Export Handover] No template could be fetched from any source');
      return Response.json(
        { error: 'Failed to load template from any source' },
        { status: 500 }
      );
    }

    // Query project and all related data with retry for pool exhaustion
    console.log('[Export Handover] Querying database for project:', projectUuid);

    const project = await withRetry(() =>
      prisma.projects.findUnique({
        where: { project_uuid: projectUuid },
      })
    );

    if (!project) {
      console.error('[Export Handover] Project not found:', projectUuid);
      return Response.json(
        { error: `Project not found: ${projectUuid}` },
        { status: 404 }
      );
    }

    // Query counteragent, insider, and currency in parallel with retries
    const [counteragent, insider, currency, jobs] = await Promise.all([
      withRetry(() =>
        prisma.counteragents.findUnique({
          where: { counteragent_uuid: project.counteragent_uuid },
        })
      ),
      withRetry(() =>
        prisma.counteragents.findUnique({
          where: { counteragent_uuid: project.insider_uuid },
        })
      ),
      withRetry(() =>
        prisma.currencies.findUnique({
          where: { uuid: project.currency_uuid },
        })
      ),
      withRetry(() =>
        prisma.jobs.findMany({
          where: { project_uuid: projectUuid, is_active: true },
          select: {
            job_uuid: true,
            job_name: true,
            factory_no: true,
            floors: true,
            weight: true,
            selling_price: true,
          },
          orderBy: { job_name: 'asc' },
        })
      ),
    ]);

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
    const placeholdersXml = await originalZip.file('xl/worksheets/sheet2.xml')?.async('string');
    if (!placeholdersXml) {
      console.error('[Export Handover] ERROR: Placeholders sheet (sheet2.xml) not found!');
      return Response.json(
        { error: 'Placeholders sheet not found in template' },
        { status: 500 }
      );
    }

    console.log('[Export Handover] Placeholders XML loaded, size:', placeholdersXml.length);

    // Parse XML and update cell values
    let modifiedXml = placeholdersXml;

    // Process each placeholder
    Object.entries(placeholderData).forEach(([cellRef, value]) => {
      // Skip formula cells - they compute their own values from other cells
      const formulaCells = ['B5', 'B16'];
      if (formulaCells.includes(cellRef)) {
        console.log(`[Export Handover] Skipping ${cellRef} (has formula)`);
        return;
      }

      const valueStr = String(value).substring(0, 50);
      console.log(`[Export Handover] Processing ${cellRef}: ${valueStr}`);
      
      // Create an escaped string value
      const escapedValue = String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      const isDateCell = cellRef === 'B2' || cellRef === 'B18';
      const cellType = isDateCell ? 'n' : 's';
      const newCellTag = `<c r="${cellRef}" t="${cellType}"><v>${escapedValue}</v></c>`;

      // Check if cell already exists in any form
      const existsPattern = new RegExp(`<c r="${cellRef}"[^>]*>.*?</c>|<c r="${cellRef}"[^>]*/>`);
      
      if (existsPattern.test(modifiedXml)) {
        // Replace existing cell
        modifiedXml = modifiedXml.replace(existsPattern, newCellTag);
        console.log(`[Export Handover]   ✓ Replaced existing ${cellRef}`);
      } else {
        // Cell doesn't exist - insert it in the appropriate row
        const rowNum = parseInt(cellRef.substring(1), 10);
        const rowStartPattern = new RegExp(`(<row r="${rowNum}"[^>]*>)`);
        
        if (rowStartPattern.test(modifiedXml)) {
          // Find this specific row's closing tag
          const rowStart = modifiedXml.search(rowStartPattern);
          const rowSection = modifiedXml.substring(rowStart);
          const rowEnd = rowSection.search(/<\/row>/);
          
          if (rowEnd !== -1) {
            const insertPos = rowStart + rowEnd;
            modifiedXml = modifiedXml.substring(0, insertPos) + newCellTag + modifiedXml.substring(insertPos);
            console.log(`[Export Handover]   ✓ Inserted ${cellRef} in row ${rowNum}`);
          }
        } else {
          console.log(`[Export Handover]   ⚠ Row ${rowNum} not found for ${cellRef}`);
        }
      }
    });

    console.log('[Export Handover] Replacing sheet2.xml in original ZIP...');

    // Simply update sheet2.xml in the original ZIP (don't recreate)
    originalZip.file('xl/worksheets/sheet2.xml', modifiedXml);

    // Now populate the Jobs sheet (sheet3.xml in the template, NOT sheet1!) with job data
    console.log('[Export Handover] Populating Jobs sheet with', jobs.length, 'jobs...');
    let jobsXml = await originalZip.file('xl/worksheets/sheet3.xml')?.async('string');
    if (jobsXml && jobs.length > 0) {
      // Build job rows as XML
      let jobRowsXml = '';
      let jobRowNum = 2; // Start from row 2 (row 1 is header)
      
      for (const job of jobs) {
        // Create cells for each job: A=jobName, B=factoryNo, C=floors, D=weight, E=sellingPrice
        const cellsXml = [
          `<c r="A${jobRowNum}" t="inlineStr"><is><t>${escapeXml(String(job.job_name || ''))}</t></is></c>`,
          job.factory_no ? `<c r="B${jobRowNum}" t="inlineStr"><is><t>${escapeXml(String(job.factory_no))}</t></is></c>` : `<c r="B${jobRowNum}"/>`,
          job.floors ? `<c r="C${jobRowNum}" t="n"><v>${job.floors}</v></c>` : `<c r="C${jobRowNum}"/>`,
          job.weight ? `<c r="D${jobRowNum}" t="n"><v>${job.weight}</v></c>` : `<c r="D${jobRowNum}"/>`,
          job.selling_price ? `<c r="E${jobRowNum}" t="n"><v>${String(job.selling_price)}</v></c>` : `<c r="E${jobRowNum}"/>`,
        ].join('');
        
        jobRowsXml += `<row r="${jobRowNum}" spans="1:5" x14ac:dyDescent="0.25">${cellsXml}</row>`;
        jobRowNum++;
      }
      
      // Insert job rows before </sheetData>
      jobsXml = jobsXml.replace('</sheetData>', jobRowsXml + '\n</sheetData>');
      
      originalZip.file('xl/worksheets/sheet3.xml', jobsXml);
      console.log('[Export Handover] Jobs sheet (sheet3.xml) populated with', jobs.length, 'rows');
    } else {
      console.log('[Export Handover] Jobs sheet not found or no jobs to populate');
    }

    console.log('[Export Handover] JSZip modifications complete, verifying sheets...');

    // Debug: List all files in the ZIP to verify sheets are present
    const fileList: string[] = [];
    originalZip.forEach(((relativePath, file) => {
      fileList.push(relativePath);
    }));
    console.log('[Export Handover] Files in ZIP:', fileList.filter(f => f.includes('worksheet')).join(', '));

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
  }
}
