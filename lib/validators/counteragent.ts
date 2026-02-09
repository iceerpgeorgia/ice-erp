export interface CounteragentFormInput {
  name?: string | null;
  identification_number?: string | null;
  entity_type_uuid?: string | null;
  sex?: string | null;
  pension_scheme?: boolean | null;
  country_uuid?: string | null;
  email?: string | null;
}

interface EntityType {
  entityTypeUuid: string;
  entityType: string;
  isNaturalPerson?: boolean;
  isIdExempt?: boolean;
}

export function validateCounteragentInput(
  input: CounteragentFormInput,
  entityTypes: EntityType[] = []
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  // Name required
  if (!input.name || !String(input.name).trim()) {
    errors.name = 'Name is required';
  }

  // Entity type required
  const entity = entityTypes.find(et => et.entityTypeUuid === input.entity_type_uuid);
  if (!input.entity_type_uuid) {
    errors.entity_type_uuid = 'Entity Type is required';
  }

  // ID required unless exempt
  const isIdExempt = !!entity?.isIdExempt;
  if (!isIdExempt && (!input.identification_number || !String(input.identification_number).trim())) {
    errors.identification_number = 'ID Number is required';
  }

  // For natural persons require sex and pension_scheme
  const isNatural = !!entity?.isNaturalPerson;
  if (isNatural) {
    if (!input.sex) errors.sex = 'Sex is required for natural persons';
    if (input.pension_scheme === undefined || input.pension_scheme === null) errors.pension_scheme = 'Pension Scheme is required for natural persons';
  }

  // Country required
  if (!input.country_uuid) errors.country_uuid = 'Country is required';

  // Email format check if provided
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email))) {
    errors.email = 'Invalid email format';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export default validateCounteragentInput;
