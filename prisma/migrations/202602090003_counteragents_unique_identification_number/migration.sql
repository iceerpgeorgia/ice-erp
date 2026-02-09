-- Enforce unique identification_number for counteragents
CREATE UNIQUE INDEX IF NOT EXISTS counteragents_identification_number_key
  ON "counteragents"(identification_number);
