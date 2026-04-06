BEGIN;

CREATE TABLE IF NOT EXISTS attachments (
  id bigserial PRIMARY KEY,
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  document_type_uuid uuid,
  storage_provider text NOT NULL DEFAULT 'supabase',
  storage_bucket text,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size_bytes bigint,
  file_hash_sha256 text,
  metadata jsonb,
  uploaded_by_user_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attachments_uuid_key UNIQUE (uuid),
  CONSTRAINT fk_attachments_document_type_uuid
    FOREIGN KEY (document_type_uuid)
    REFERENCES document_types(uuid)
    ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attachments_storage_location
  ON attachments(storage_provider, storage_bucket, storage_path);

CREATE INDEX IF NOT EXISTS idx_attachments_document_type_uuid
  ON attachments(document_type_uuid);

CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by_user_id
  ON attachments(uploaded_by_user_id);

CREATE INDEX IF NOT EXISTS idx_attachments_created_at
  ON attachments(created_at);

CREATE TABLE IF NOT EXISTS attachment_links (
  id bigserial PRIMARY KEY,
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  attachment_uuid uuid NOT NULL,
  owner_table text NOT NULL,
  owner_uuid uuid NOT NULL,
  owner_field text,
  is_primary boolean NOT NULL DEFAULT false,
  created_by_user_id text,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attachment_links_uuid_key UNIQUE (uuid),
  CONSTRAINT fk_attachment_links_attachment_uuid
    FOREIGN KEY (attachment_uuid)
    REFERENCES attachments(uuid)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attachment_links_owner_binding
  ON attachment_links(attachment_uuid, owner_table, owner_uuid, owner_field);

CREATE INDEX IF NOT EXISTS idx_attachment_links_attachment_uuid
  ON attachment_links(attachment_uuid);

CREATE INDEX IF NOT EXISTS idx_attachment_links_owner
  ON attachment_links(owner_table, owner_uuid);

CREATE INDEX IF NOT EXISTS idx_attachment_links_created_at
  ON attachment_links(created_at);

COMMIT;
