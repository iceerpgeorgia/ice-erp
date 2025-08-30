-- DDL generated from Base_Migrate.xlsx (surrogate PKs + audit columns)
DROP TABLE IF EXISTS "Counteragents" CASCADE;
CREATE TABLE "Counteragents" (
  id bigserial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "Timestamp" timestamptz NOT NULL DEFAULT 'nan',
  "Name" text NOT NULL DEFAULT 'nan',
  "Sex" text NOT NULL DEFAULT 'nan',
  "Entity Type" text NOT NULL DEFAULT 'nan',
  "Pension Scheme" boolean NOT NULL DEFAULT 'nan',
  "Tax ID" text NOT NULL DEFAULT 'nan',
  "Country" text NOT NULL DEFAULT 'nan',
  "Address Line 1 :" text NOT NULL DEFAULT 'nan',
  "Address Line 2 :" text NOT NULL DEFAULT 'nan',
  "ZIP Code :" text NOT NULL DEFAULT 'nan',
  "Director" text NOT NULL DEFAULT 'nan',
  "Director ID" text NOT NULL DEFAULT 'nan',
  "SWIFT :" text NOT NULL DEFAULT 'nan',
  "IBAN :" text NOT NULL DEFAULT 'nan',
  "Tel. No :" text NOT NULL DEFAULT 'nan',
  "Counteragent UUID" text NOT NULL DEFAULT 'nan',
  "Email :" text NOT NULL DEFAULT 'nan',
  "Date of incorporation or birth" text NOT NULL DEFAULT 'nan',
  "ORIS ID :" text NOT NULL DEFAULT 'nan',
  "Internal No" text NOT NULL DEFAULT 'nan',
  "Counteragent" text NOT NULL DEFAULT 'nan',
  "Country UUID" text NOT NULL DEFAULT 'nan',
  "Entity Type UUID" text NOT NULL DEFAULT 'nan'
);

DROP TABLE IF EXISTS "Countries" CASCADE;
CREATE TABLE "Countries" (
  id bigserial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "Timestamp" timestamptz NOT NULL DEFAULT 'nan',
  "Country UUID" text NOT NULL DEFAULT 'nan',
  "Country Name English" text NOT NULL DEFAULT 'nan',
  "Country Name Georgian" text NOT NULL DEFAULT 'nan',
  "ISO 2" text NOT NULL DEFAULT 'nan',
  "ISO 3" text NOT NULL DEFAULT 'nan',
  "UN Code" text NOT NULL DEFAULT 'nan',
  "Country" text NOT NULL DEFAULT 'nan'
);

DROP TABLE IF EXISTS "Entity_Types" CASCADE;
CREATE TABLE "Entity_Types" (
  id bigserial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "Timestamp" timestamptz NOT NULL DEFAULT 'nan',
  "Entity Type UUID" text NOT NULL DEFAULT 'nan',
  "Entity Type Name" text NOT NULL DEFAULT 'nan'
);
