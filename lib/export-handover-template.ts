import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

/**
 * Export handover using the template-based approach
 * Loads the template, populates placeholders and Jobs sheet data, then exports
 */
export async function exportHandoverFromTemplate({
  jobsData,
  certificateDate,
  counteragentInfo,
  companyName,
  fileName,
}: {
  jobsData: Array<{
    counteragentId?: string;
    factoryNo?: string;
    manufacturerName?: string; // brand name
    weight?: number | string;
    floors?: number;
    nominalAmount?: number;
    gelAmount?: number;
    certificateNo?: string;
    liftCertDate?: Date | string;
  }>;
  certificateDate: Date;
  counteragentInfo: string; // e.g., "შ.პ.ს აკმე ელვატორი"
  companyName: string; // e.g., "შპს აი-სი-ი"
  fileName: string;
}): Promise<{ buffer: Buffer; fileName: string }> {
  // Load template
  const templatePath = path.join(process.cwd(), 'handover template.xlsx');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Handover template not found at ${templatePath}`);
  }

  const templateBuffer = fs.readFileSync(templatePath);
  const workbook = XLSX.read(templateBuffer, { cellFormula: true });

  // Get the Handover sheet
  const handoverSheet = workbook.Sheets['Handover'];
  if (!handoverSheet) {
    throw new Error('Handover sheet not found in template');
  }

  // ============================================
  // 1. Set certificate date in V3
  // ============================================
  const excelDateSerial = dateToExcelSerial(certificateDate);
  if (!handoverSheet['V3']) {
    handoverSheet['V3'] = {};
  }
  handoverSheet['V3'].v = excelDateSerial;
  handoverSheet['V3'].t = 'n'; // number type

  // ============================================
  // 2. Replace placeholder text in Handover sheet
  // ============================================
  // C6: party info - replace placeholder text
  if (handoverSheet['C6']) {
    handoverSheet['C6'].v = counteragentInfo;
    handoverSheet['C6'].t = 's';
  }

  // H69: company info
  if (handoverSheet['H69']) {
    handoverSheet['H69'].v = companyName;
    handoverSheet['H69'].t = 's';
  }

  // ============================================
  // 3. Populate or update Jobs sheet
  // ============================================
  let jobsSheet = workbook.Sheets['Jobs'];
  if (!jobsSheet) {
    // Create Jobs sheet if it doesn't exist
    jobsSheet = {};
    workbook.SheetNames.push('Jobs');
    workbook.Sheets['Jobs'] = jobsSheet;
  }

  // Add headers if they don't exist
  const headers = ['Counteragent ID', 'Factory No', 'Manufacturer', 'Floors', 'Weight', 'Nominal', '', '', '', '', 'GEL Amount', '', 'Date', 'Cert No'];
  for (let i = 0; i < headers.length; i++) {
    const colLetter = String.fromCharCode(65 + i); // A, B, C, etc.
    if (!jobsSheet[`${colLetter}1`]) {
      jobsSheet[`${colLetter}1`] = { v: headers[i], t: 's' };
    }
  }

  // Clear existing job data (rows > 1)
  const cellsToDelete = Object.keys(jobsSheet).filter((key) => {
    if (key === '!ref' || key === '!merges' || key.startsWith('!')) return false;
    const match = key.match(/\d+$/);
    const rowNum = parseInt(match ? match[0] : '0');
    return rowNum > 1;
  });
  cellsToDelete.forEach((key) => {
    delete jobsSheet[key];
  });

  // Populate job data rows starting from row 2
  jobsData.forEach((job, index) => {
    const rowNum = index + 2;

    // A: Counteragent ID
    if (job.counteragentId) {
      jobsSheet[`A${rowNum}`] = { v: job.counteragentId, t: 's' };
    }

    // B: Factory number
    if (job.factoryNo) {
      jobsSheet[`B${rowNum}`] = { v: job.factoryNo, t: 's' };
    }

    // C: Manufacturer name
    if (job.manufacturerName) {
      jobsSheet[`C${rowNum}`] = { v: job.manufacturerName, t: 's' };
    }

    // D: Floors
    if (job.floors !== undefined && job.floors !== null) {
      jobsSheet[`D${rowNum}`] = { v: job.floors, t: 'n' };
    }

    // E: Weight
    if (job.weight !== undefined && job.weight !== null) {
      jobsSheet[`E${rowNum}`] = { v: Number(job.weight), t: 'n' };
    }

    // F: Nominal amount
    if (job.nominalAmount !== undefined && job.nominalAmount !== null) {
      jobsSheet[`F${rowNum}`] = { v: Number(job.nominalAmount), t: 'n', z: '#,##0.00' };
    }

    // K: GEL amount
    if (job.gelAmount !== undefined && job.gelAmount !== null) {
      jobsSheet[`K${rowNum}`] = { v: Number(job.gelAmount), t: 'n', z: '#,##0.00' };
    }

    // M: Certificate date (as Excel serial)
    if (job.liftCertDate) {
      const jobCertDateSerial = dateToExcelSerial(
        typeof job.liftCertDate === 'string' ? new Date(job.liftCertDate) : job.liftCertDate
      );
      jobsSheet[`M${rowNum}`] = { v: jobCertDateSerial, t: 'n' };
    }

    // N: Certificate number
    if (job.certificateNo) {
      jobsSheet[`N${rowNum}`] = { v: job.certificateNo, t: 's' };
    }
  });

  // Update sheet dimensions
  if (jobsData.length > 0) {
    jobsSheet['!ref'] = `A1:N${jobsData.length + 1}`;
  }

  // ============================================
  // 4. Export to buffer
  // ============================================
  const outputBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer',
  });

  return { buffer: outputBuffer, fileName };
}

/**
 * Convert JavaScript Date to Excel serial number
 * Excel serial 1 = Jan 1, 1900
 * Using Lotus 1-2-3 compatibility (Excel epoch)
 */
function dateToExcelSerial(date: Date): number {
  // Epoch: January 1, 1900 is serial 1 in Excel
  const excelEpoch = new Date(1900, 0, 1).getTime();
  const dateTime = date.getTime();

  // Calculate days since epoch
  const daysDiff = Math.floor((dateTime - excelEpoch) / (24 * 60 * 60 * 1000));

  // Excel has a leap year bug: it thinks 1900 is a leap year
  // So if date is after Feb 28, 1900, add 2 to account for the bug
  // (The first day of 1900 is serial 1, not 0)
  const serial = daysDiff + 1;

  // Adjust for Excel's leap year bug (it counts Feb 29, 1900, which doesn't exist)
  if (serial > 60) {
    return serial + 1; // Add 1 for dates after Feb 28, 1900
  }

  return serial;
}

/**
 * Alternative: Get Excel serial from date string (YYYY-MM-DD)
 */
export function dateStringToExcelSerial(dateStr: string): number {
  const date = new Date(dateStr);
  return dateToExcelSerial(date);
}
