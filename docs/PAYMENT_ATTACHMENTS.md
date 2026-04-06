# Payment Attachments Implementation

## Overview
Payment attachments are now fully integrated into the payments and payments report UI. Attachments are bound via `payment_id` and stored in Supabase Storage.

## Architecture

### Database Schema
- **attachments** table: Stores file metadata (document type, storage path, file info)
- **attachment_links** table: Polymorphic links connecting attachments to owners (payments via record_uuid)
- **document_types** table: Categorizes attachments (optional FK)

### API Routes
All routes are under `/api/payments/attachments/`:
- **GET** `/api/payments/attachments?paymentId=xxx` - List attachments for a payment
- **POST** `/api/payments/attachments/upload` - Get signed upload URL
- **POST** `/api/payments/attachments/confirm` - Confirm upload and create DB records
- **GET** `/api/payments/attachments/download?bucket=xxx&path=xxx` - Get signed download URL
- **DELETE** `/api/payments/attachments/delete?linkUuid=xxx` - Delete attachment link and file

### Service Layer
`lib/attachments.ts` provides:
- `getPaymentAttachments(paymentId)` - Fetch all attachments for a payment
- `createPaymentAttachment(params)` - Create attachment and link
- `deletePaymentAttachment(linkUuid)` - Remove attachment link
- `getAttachmentDownloadUrl(bucket, path)` - Generate download URL
- `updateAttachment(attachmentUuid, updates)` - Update metadata

### UI Component
`components/figma/payment-attachments.tsx`:
- Reusable attachment manager component
- Dialog with upload form and attachment list
- Upload progress, file preview, delete confirmation
- Integrated badge showing attachment count

## Usage

### In Payment Tables
The `PaymentAttachments` component appears in the Actions column of:
- `/dictionaries/payments` (Payments table)
- `/dictionaries/payments-report` (Payments Report table)

Click the paperclip icon to:
1. **Upload** - Select file → Upload → Automatic storage in `payment-attachments` bucket
2. **View** - See all attachments with file size and metadata
3. **Download** - Click download icon to get signed URL and open file
4. **Delete** - Click trash icon to remove attachment (with confirmation)

### Storage Location
- **Bucket**: `payment-attachments`
- **Path pattern**: `{paymentId}/{timestamp}-{random}-{filename}`

## Supabase Setup Requirements

### 1. Create Storage Bucket
In Supabase dashboard → Storage → Create new bucket:
- Name: `payment-attachments`
- Public: `false` (private bucket, access via signed URLs only)
- File size limit: As per your requirements
- Allowed MIME types: Configure per your needs

### 2. Storage Policies (RLS)
Create policies for secure access:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-attachments');

-- Allow authenticated users to view their organization's files
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-attachments');

-- Allow authenticated users to delete
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payment-attachments');
```

## Database Migration

Run the migration to create tables:
```bash
# If using Prisma migrations
pnpm prisma migrate deploy

# Or run SQL directly
psql $DATABASE_URL < prisma/migrations/20260406150000_add_attachments_base/migration.sql
```

## Extension Points

### Add Attachments to Other Models
To add attachments to other entities (projects, counteragents, etc.):

1. Create similar API routes under `/api/{model}/attachments/`
2. Update `lib/attachments.ts` with model-specific helpers
3. Use `PaymentAttachments` component as template (change owner_table and owner_uuid)

### Document Types
Optionally categorize attachments by setting `document_type_uuid`:
- Invoice
- Contract
- Receipt
- Proof of Payment
- Other

Managed via the `document_types` table (already exists in your schema).

## Security Notes
- All uploads use signed URLs (time-limited, single-use)
- Storage bucket is private (not publicly accessible)
- Files are accessed only via authenticated API routes
- Attachment deletion cleans up both database records and storage files
