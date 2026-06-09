/**
 * Converts a Georgian name from nominative to genitive case
 * Formula: Extract first name + convert last name ending
 * 
 * Conversion rules for last name:
 * - ends with "ე" → remove "ე", add "ის"
 * - ends with "ა" → remove "ა", add "ას"
 * - ends with "ი" → remove "ი", add "ის"
 * - ends with "ო" → remove "ო", add "ოს"
 * - other → keep as is
 */
export function toGenitiveCase(name: string | null | undefined): string {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return '';
  }

  const trimmed = name.trim();
  const spaceIndex = trimmed.indexOf(' ');

  // If no space, treat entire string as surname
  if (spaceIndex === -1) {
    return convertLastNameToGenitive(trimmed);
  }

  const firstName = trimmed.substring(0, spaceIndex);
  const lastName = trimmed.substring(spaceIndex + 1).trim();

  if (!lastName) {
    return firstName;
  }

  const genitiveLastName = convertLastNameToGenitive(lastName);
  return `${firstName} ${genitiveLastName}`;
}

/**
 * Converts a Georgian last name to genitive case
 */
function convertLastNameToGenitive(lastName: string): string {
  if (!lastName || lastName.length === 0) {
    return lastName;
  }

  const lastChar = lastName[lastName.length - 1];
  const withoutLastChar = lastName.substring(0, lastName.length - 1);

  switch (lastChar) {
    case 'ე':
      return withoutLastChar + 'ის';
    case 'ა':
      return withoutLastChar + 'ას';
    case 'ი':
      return withoutLastChar + 'ის';
    case 'ო':
      return withoutLastChar + 'ოს';
    default:
      return lastName;
  }
}
