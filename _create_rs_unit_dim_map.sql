-- Create RS.ge unit → dimension mapping table
CREATE TABLE IF NOT EXISTS rs_unit_dimension_map (
  id             BIGSERIAL PRIMARY KEY,
  uuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  rs_unit_id     TEXT NOT NULL UNIQUE,
  rs_unit_label  TEXT NOT NULL,
  dimension_uuid UUID REFERENCES dimensions(uuid) ON DELETE SET NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rs_unit_dim_map_dim_uuid_idx ON rs_unit_dimension_map(dimension_uuid);

-- Pre-populate from RS.ge UNIT_ID list (RS_UNIT_MAP) with known dimension bindings
INSERT INTO rs_unit_dimension_map (rs_unit_id, rs_unit_label, dimension_uuid) VALUES
  ('1',  'ც',   'f32683dc-3dcc-4faf-a238-97d223da848e'),  -- ცალი
  ('2',  'კგ',  '97291b1a-f144-419f-83da-04541a58179d'),  -- კგ
  ('3',  'გ',   'ec043a52-1a0f-40c3-b3ed-0a8ed433c2f5'),  -- გრამი
  ('4',  'ლ',   '2a7b3769-e90a-451f-a30c-3cbf285659f4'),  -- ლიტრი
  ('5',  'მლ',  'e827fca5-c231-4de7-91a9-a566934a3d2e'),  -- მილილიტრი
  ('6',  'მ',   '294e4db3-55b8-4437-9232-b86625a7e187'),  -- მეტრი
  ('7',  'კმ',  NULL),                                     -- კილომეტრი (no dimension)
  ('8',  'სმ',  NULL),                                     -- სანტიმეტრი (no dimension)
  ('9',  'მმ',  NULL),                                     -- მილიმეტრი (no dimension)
  ('10', 'მ²',  '8572b430-f3d3-4d9f-af30-73c737f874ee'),  -- მ²
  ('11', 'მ³',  '14fdde93-0ee3-45a6-ad6a-8e13c66fbaad'),  -- მ³
  ('12', 'ჰა',  NULL),                                     -- ჰექტარი (no dimension)
  ('13', 'ტ',   '375876df-adf0-4739-b0cd-9ad4cc0ceb21'),  -- ტონა
  ('14', 'კომ', '2cc43820-1584-4eac-bc2b-6bbf16fe6c2b'),  -- კომპლექტი
  ('15', 'ყ',   'db74eeb2-4ee7-4e48-9850-db10af3c8d5c'),  -- ყუთი
  ('16', 'ბ',   NULL),                                     -- ბოთლი (no dimension)
  ('17', 'კ',   '2cc43820-1584-4eac-bc2b-6bbf16fe6c2b'),  -- კომ (alt)
  ('18', 'პ',   NULL),                                     -- პარტია (no dimension)
  ('19', 'სხვ', 'f9f4bcb1-f01b-4a7f-9b88-10c33444c290'), -- სხვადასხვა
  ('99', '99',  NULL)                                      -- unknown
ON CONFLICT (rs_unit_id) DO NOTHING;
