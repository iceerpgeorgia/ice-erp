-- Add Handover Template document type
INSERT INTO "public"."document_types" ("name", "is_active", "require_date", "require_value", "require_currency", "require_document_no", "require_project")
VALUES ('Handover Template', true, false, false, false, false, false)
ON CONFLICT (name) DO NOTHING;
