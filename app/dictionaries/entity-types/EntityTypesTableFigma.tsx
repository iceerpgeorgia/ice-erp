'use client';

import { EntityTypesTable } from '@/components/figma/entity-types-table';
import { useEffect, useState } from 'react';

interface EntityTypeRow {
  id: number;
  created_at: string;
  updated_at: string;
  ts: string;
  entity_type_uuid: string;
  code: string;
  name_en: string;
  name_ka: string;
  is_active: boolean;
}

interface EntityTypeRowCamel {
  id: number;
  createdAt: string;
  updatedAt: string;
  ts: string;
  entityTypeUuid: string;
  code: string;
  nameEn: string;
  nameKa: string;
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
          
          return {
            id: Number(row.id),
            createdAt: isSnakeCase ? toYMD((row as EntityTypeRow).created_at) : toYMD((row as EntityTypeRowCamel).createdAt),
            updatedAt: isSnakeCase ? toYMD((row as EntityTypeRow).updated_at) : toYMD((row as EntityTypeRowCamel).updatedAt),
            ts: isSnakeCase ? toISO((row as EntityTypeRow).ts) : toISO((row as EntityTypeRowCamel).ts),
            entityTypeUuid: isSnakeCase ? String((row as EntityTypeRow).entity_type_uuid) : String((row as EntityTypeRowCamel).entityTypeUuid),
            code: String(isSnakeCase ? (row as EntityTypeRow).code : (row as EntityTypeRowCamel).code),
            nameEn: String(isSnakeCase ? (row as EntityTypeRow).name_en : (row as EntityTypeRowCamel).nameEn),
            nameKa: String(isSnakeCase ? (row as EntityTypeRow).name_ka : (row as EntityTypeRowCamel).nameKa),
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
