#!/usr/bin/env node
/**
 * Import handover template from public/ folder to templates table
 * This makes templates database-driven instead of file-system dependent
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importTemplate() {
  try {
    console.log('[Template Import] Starting import...');

    const templatePath = path.join(__dirname, '../public/handover template.xlsx');
    
    if (!fs.existsSync(templatePath)) {
      console.error('❌ Template file not found at:', templatePath);
      process.exit(1);
    }

    // Read the template file as binary data
    const fileData = fs.readFileSync(templatePath);
    console.log(`[Template Import] Read template file (${fileData.length} bytes)`);

    // Check if template already exists
    const existing = await prisma.templates.findFirst({
      where: {
        type: 'handover',
        is_active: true,
      },
    });

    if (existing) {
      console.log('[Template Import] ⚠ Active handover template already exists (UUID:', existing.uuid, ')');
      console.log('[Template Import] Deactivating existing template...');
      
      // Deactivate the old template
      await prisma.templates.update({
        where: { id: existing.id },
        data: { is_active: false },
      });
    }

    // Insert the new template
    const template = await prisma.templates.create({
      data: {
        name: 'Handover Template',
        description: 'Excel template for handover export with FILTER formulas and placeholder cells',
        type: 'handover',
        file_data: fileData,
        file_name: 'handover template.xlsx',
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        version: 1,
        is_active: true,
        created_by: 'system',
      },
    });

    console.log('[Template Import] ✅ Template imported successfully!');
    console.log('  UUID:', template.uuid);
    console.log('  Name:', template.name);
    console.log('  Type:', template.type);
    console.log('  Size:', fileData.length, 'bytes');
    console.log('  Active:', template.is_active);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing template:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

importTemplate();
