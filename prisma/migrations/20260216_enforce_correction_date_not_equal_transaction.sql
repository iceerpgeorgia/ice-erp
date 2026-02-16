-- Enforce correction_date not equal to transaction_date

CREATE OR REPLACE FUNCTION enforce_correction_date_not_equal_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.correction_date IS NULL OR NEW.transaction_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.correction_date::date = NEW.transaction_date::date THEN
    RAISE EXCEPTION 'correction_date must not equal transaction_date';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bog_correction_date_not_equal ON "GE78BG0000000893486000_BOG_GEL";
DROP TRIGGER IF EXISTS trigger_tbc_correction_date_not_equal ON "GE65TB7856036050100002_TBC_GEL";

CREATE TRIGGER trigger_bog_correction_date_not_equal
  BEFORE INSERT OR UPDATE OF correction_date, transaction_date ON "GE78BG0000000893486000_BOG_GEL"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_correction_date_not_equal_transaction();

CREATE TRIGGER trigger_tbc_correction_date_not_equal
  BEFORE INSERT OR UPDATE OF correction_date, transaction_date ON "GE65TB7856036050100002_TBC_GEL"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_correction_date_not_equal_transaction();
