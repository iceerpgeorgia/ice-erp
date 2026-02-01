'use client';

import { EntityTypesTable } from '@/components/figma/entity-types-table';
import { useEffect, useState } from 'react';

interface EntityTypeRow {
  id: number;
  created_at: string;
  updated_at: string;
  ts: string;
  entity_type_uuid: string;
  name_en: string;
  name_ka: string;
  is_natural_person?: boolean;
  is_id_exempt?: boolean;
  is_active: boolean;
}

interface EntityTypeRowCamel {
  id: number;
  createdAt: string;
  updatedAt: string;
  ts: string;
  entityTypeUuid: string;
  nameEn: string;
  nameKa: string;
  isNaturalPerson?: boolean;
  isIdExempt?: boolean;
  isActive: boolean;
}

// Helper to validate and parse date safely
const toValidDate = (val: any): string => {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  return new Date().toISOString();
};

// Helper to format date as YYYY-MM-DD (simple format)
const toYMD = (val: any): string => {
  const iso = toValidDate(val);
  return iso.split('T')[0];
};

// Helper to ensure ISO format
const toISO = (val: any): string => {
  return toValidDate(val);
};

export default function EntityTypesTableFigma() {
  const [entityTypes, setEntityTypes] = useState<EntityTypeRowCamel[]>([]);

  useEffect(() => {
    fetch('/api/entity-types')
      .then((res) => res.json())
      .then((data: (EntityTypeRow | EntityTypeRowCamel)[]) => {
        const mapped = data.map((row: EntityTypeRow | EntityTypeRowCamel) => {
          // Handle both snake_case (from DB) and camelCase (from API)
          const isSnakeCase = 'entity_type_uuid' in row;
          
          const nameEn = isSnakeCase
            ? String((row as EntityTypeRow).name_en ?? (row as any).nameEn ?? '')
            : String((row as EntityTypeRowCamel).nameEn ?? (row as any).name_en ?? '');
          const nameKa = isSnakeCase
            ? String((row as EntityTypeRow).name_ka ?? (row as any).nameKa ?? '')
            : String((row as EntityTypeRowCamel).nameKa ?? (row as any).name_ka ?? '');

          return {
            id: Number(row.id),
            createdAt: isSnakeCase ? toYMD((row as EntityTypeRow).created_at) : toYMD((row as EntityTypeRowCamel).createdAt),
            updatedAt: isSnakeCase ? toYMD((row as EntityTypeRow).updated_at) : toYMD((row as EntityTypeRowCamel).updatedAt),
            ts: isSnakeCase ? toISO((row as EntityTypeRow).ts) : toISO((row as EntityTypeRowCamel).ts),
            entityTypeUuid: isSnakeCase ? String((row as EntityTypeRow).entity_type_uuid) : String((row as EntityTypeRowCamel).entityTypeUuid),
            nameEn,
            nameKa,
            isNaturalPerson: Boolean((row as any).is_natural_person ?? (row as any).isNaturalPerson ?? false),
            isIdExempt: Boolean((row as any).is_id_exempt ?? (row as any).isIdExempt ?? false),
            isActive: Boolean(isSnakeCase ? (row as EntityTypeRow).is_active : (row as EntityTypeRowCamel).isActive),
          };
        });
        setEntityTypes(mapped);
      })
      .catch((err) => console.error('Failed to fetch entity types:', err));
  }, []);

  return (
    <div className="h-screen pb-8">
      <EntityTypesTable data={entityTypes} />
    </div>
  );
}
