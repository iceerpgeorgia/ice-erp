// High-fidelity DOCX -> PDF conversion via CloudConvert (LibreOffice engine).
// Used so the printable-form PDF matches the DOCX exactly (fonts, tables, spacing).
// Requires env var CLOUDCONVERT_API_KEY. When unset, callers fall back to the pdfkit renderer.

const CLOUDCONVERT_API = 'https://api.cloudconvert.com/v2';
const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 55_000;

export function isPdfConversionConfigured(): boolean {
  return Boolean(process.env.CLOUDCONVERT_API_KEY);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function convertDocxToPdf(docx: Buffer, filename = 'document.docx'): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    throw new Error('CLOUDCONVERT_API_KEY is not configured');
  }

  const authHeaders = { Authorization: `Bearer ${apiKey}` };

  const jobRes = await fetch(`${CLOUDCONVERT_API}/jobs`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tasks: {
        'import-docx': {
          operation: 'import/base64',
          file: docx.toString('base64'),
          filename,
        },
        'convert-pdf': {
          operation: 'convert',
          input: 'import-docx',
          input_format: 'docx',
          output_format: 'pdf',
          engine: 'libreoffice',
        },
        'export-pdf': {
          operation: 'export/url',
          input: 'convert-pdf',
        },
      },
    }),
  });

  if (!jobRes.ok) {
    throw new Error(`CloudConvert job create failed: ${jobRes.status} ${await jobRes.text()}`);
  }

  const jobJson = await jobRes.json();
  const jobId: string | undefined = jobJson?.data?.id;
  if (!jobId) {
    throw new Error('CloudConvert job id missing from response');
  }

  const deadline = Date.now() + MAX_WAIT_MS;
  let exportTask: any = null;

  while (Date.now() < deadline) {
    await delay(POLL_INTERVAL_MS);

    const statusRes = await fetch(`${CLOUDCONVERT_API}/jobs/${jobId}`, { headers: authHeaders });
    if (!statusRes.ok) continue;

    const statusJson = await statusRes.json();
    const status: string | undefined = statusJson?.data?.status;

    if (status === 'error') {
      throw new Error('CloudConvert job finished with status "error"');
    }
    if (status === 'finished') {
      const tasks: any[] = statusJson?.data?.tasks ?? [];
      exportTask = tasks.find((t) => t?.name === 'export-pdf' && t?.status === 'finished') ?? null;
      break;
    }
  }

  if (!exportTask) {
    throw new Error('CloudConvert conversion timed out before completion');
  }

  const fileUrl: string | undefined = exportTask?.result?.files?.[0]?.url;
  if (!fileUrl) {
    throw new Error('CloudConvert export URL missing from finished task');
  }

  const pdfRes = await fetch(fileUrl);
  if (!pdfRes.ok) {
    throw new Error(`CloudConvert PDF download failed: ${pdfRes.status}`);
  }

  const arrayBuffer = await pdfRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
