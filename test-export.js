const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testExport() {
  // Get first project
  const project = await prisma.projects.findFirst({
    select: { project_uuid: true, project_name: true }
  });

  if (!project) {
    console.error('No projects found');
    process.exit(1);
  }

  console.log('Testing export with project:', project.project_name, '(' + project.project_uuid + ')');
  
  // Make POST request to the export endpoint
  const response = await fetch('http://localhost:3000/api/export/handover-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: `handover-test-${project.project_uuid}.xlsx`,
      projectUuid: project.project_uuid
    })
  });

  if (!response.ok) {
    console.error('Export failed:', response.status, response.statusText);
    const text = await response.text();
    console.error('Response:', text);
    process.exit(1);
  }

  const buffer = await response.arrayBuffer();
  console.log('Export successful, file size:', buffer.byteLength, 'bytes');
  console.log('First 20 bytes:', Buffer.from(buffer).slice(0, 20).toString('hex'));
  console.log('Content-Type header:', response.headers.get('content-type'));
  
  // Save to file for inspection
  const fs = require('fs');
  const outPath = `./export-test-${Date.now()}.xlsx`;
  fs.writeFileSync(outPath, Buffer.from(buffer));
  console.log('Saved to', outPath);

  process.exit(0);
}

testExport().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
