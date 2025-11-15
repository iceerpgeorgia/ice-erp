UPDATE public.counteragents c
SET 
  country = (SELECT name_ka FROM public.countries WHERE country_uuid = c.country_uuid::uuid),
  entity_type = (SELECT name_ka FROM public.entity_types WHERE entity_type_uuid = c.entity_type_uuid)
WHERE c.country_uuid IS NOT NULL OR c.entity_type_uuid IS NOT NULL;
