CREATE TRIGGER trg_counteragents_populate_names
  BEFORE INSERT OR UPDATE OF country_uuid, entity_type_uuid
  ON public.counteragents
  FOR EACH ROW
  EXECUTE FUNCTION public.counteragents_populate_names();
