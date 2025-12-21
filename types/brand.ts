/**
 * Brand type definition
 * Represents a brand entity with its core properties
 */
export interface BrandType {
  id: number;
  uuid: string;
  name: string;
}

// Re-export as const for runtime validation
export const BRAND_FIELDS = ['id', 'uuid', 'name'] as const;
