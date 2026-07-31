# Handover Template Database Setup Guide

## What Changed
The handover export system now supports storing the template in the database (`attachments` table) instead of relying only on the file system. This provides:
- **Centralized template management** - Update template once, all exports use it
- **Audit trail** - Track who uploaded and when
- **Multi-environment support** - Same template across dev/staging/prod

## How to Enable Database Templates

### Option 1: Upload via Admin UI (Recommended)
1. Go to **Admin → Attachments**
2. Click **Upload** button
3. Select `Handover Tamplate New.xlsx` file from your project root
4. In the form:
   - **Document Type**: Select "**Handover Template**" (dropdown will show this after the latest migration)
   - **File Name**: Should auto-populate as "Handover Tamplate New.xlsx"
   - **Storage Provider**: Keep as "supabase"
5. Click **Save**
6. Verify in attachments list - should show as active

### Option 2: Direct Supabase Upload (For Development)
1. Go to **Supabase Dashboard → Storage**
2. Select the **attachments** bucket
3. Upload `Handover Tamplate New.xlsx`
4. Note the file path (e.g., `handover_1718537400.xlsx`)
5. In Supabase Editor, insert into `document_types` table:
   ```sql
   INSERT INTO attachments (file_name, storage_path, storage_provider, storage_bucket, is_active)
   VALUES (
     'Handover Tamplate New.xlsx',
     'handover_1718537400.xlsx',
     'supabase',
     'attachments',
     true
   )
   RETURNING uuid;
   ```

## Verification

After uploading, test the export:
1. Go to **Handovers** section
2. Select a project
3. Click **Export → Full Template Export**
4. Check the browser console (F12 → Console):
   - Should see: `✓ Template loaded from database, size: XXXXX`
   - If file system fallback used: `Template loaded from file system...`

## Template Content

The template must have these sheets:
- **sheet1**: Handover document (Georgian form with VLOOKUP formulas)
- **sheet2**: Placeholders lookup table (gets populated with project data)
- **sheet3**: Jobs data table template
- Optional: Income Payments, Job Distributions

## Troubleshooting

**Export fails with "Template not found"**
- Check attachments list for "Handover Tamplate New.xlsx"
- Verify document_type is "Handover Template"
- Check is_active = true
- Check storage_provider = "supabase"

**Export uses file system instead of database**
- Check logs: should show "[Export Handover] ✓ Template loaded from database"
- If showing "will try file system fallback", database attachment not found
- Verify attachment was uploaded correctly

**File system fallback seems slow**
- Database retrieval is much faster; consider uploading template
- File system fallback exists for backward compatibility

## Migration Applied
- **Migration**: `20260616120000_add_handover_template_document_type`
- **Status**: Applied to all environments
- **Change**: Added "Handover Template" document type to database

## Next Steps
1. Upload the template file to database using Option 1 or 2
2. Test export on a sample project
3. Verify "Template loaded from database" in browser console
4. (Optional) Remove `Handover Tamplate New.xlsx` from project root once in production
