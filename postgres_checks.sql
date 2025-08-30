-- Auto-generated CHECKs from data_validation_spec.xlsx
ALTER TABLE "Counteragents" ADD CONSTRAINT "chk_Counteragents_Tax ID_regex" CHECK ("Tax ID" ~ '^[\w\-\.:/]{1,128}$');
ALTER TABLE "Counteragents" ADD CONSTRAINT "chk_Counteragents_Director ID_regex" CHECK ("Director ID" ~ '^[\w\-\.:/]{1,128}$');
ALTER TABLE "Counteragents" ADD CONSTRAINT "chk_Counteragents_IBAN :_regex" CHECK ("IBAN :" ~ '^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$');
ALTER TABLE "Counteragents" ADD CONSTRAINT "chk_Counteragents_Counteragent UUID_regex" CHECK ("Counteragent UUID" ~ '^[\w\-\.:/]{1,128}$');
ALTER TABLE "Counteragents" ADD CONSTRAINT "chk_Counteragents_Email :_regex" CHECK ("Email :" ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
ALTER TABLE "Counteragents" ADD CONSTRAINT "chk_Counteragents_Country UUID_regex" CHECK ("Country UUID" ~ '^[\w\-\.:/]{1,128}$');
ALTER TABLE "Counteragents" ADD CONSTRAINT "chk_Counteragents_Entity Type UUID_regex" CHECK ("Entity Type UUID" ~ '^[\w\-\.:/]{1,128}$');
ALTER TABLE "Countries" ADD CONSTRAINT "chk_Countries_Country UUID_regex" CHECK ("Country UUID" ~ '^[\w\-\.:/]{1,128}$');
ALTER TABLE "Countries" ADD CONSTRAINT "chk_Countries_ISO 2_regex" CHECK ("ISO 2" ~ '^[A-Z]{2,3}$');
ALTER TABLE "Countries" ADD CONSTRAINT "chk_Countries_ISO 3_regex" CHECK ("ISO 3" ~ '^[A-Z]{2,3}$');
ALTER TABLE "Entity Types" ADD CONSTRAINT "chk_Entity Types_Entity Type UUID_regex" CHECK ("Entity Type UUID" ~ '^[\w\-\.:/]{1,128}$');