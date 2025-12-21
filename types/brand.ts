/**
 * Brand type definition
 * Represents a brand entity with its core properties
 * @since 2025-12-21
 */
export interface BrandType {
  id: number;
  uuid: string;
  name: string;
}

// Re-export as const for runtime validation
export const BRAND_FIELDS = ['id', 'uuid', 'name'] as const;

// Type guard for brand validation
export function isBrandType(obj: any): obj is BrandType {
  return obj && typeof obj.id === 'number' && typeof obj.uuid === 'string' && typeof obj.name === 'string';
}
